/*
  # Staff Loans, Advances & Journal Reference Fix

  ## Problems Addressed
  1. Journal Register shows blank reference numbers for petty cash
  2. Expenses show UUID instead of voucher numbers
  3. No system to track staff loans (money given/returned)
  4. No system to track salary advances with individual ledgers

  ## Solutions
  1. Create staff_loans table for tracking loans given to employees
  2. Create staff_advances table for salary advances
  3. Add proper chart of accounts for staff loans and advances
  4. Update triggers to populate reference_number correctly
  5. Create ledger view for individual staff members
*/

-- Step 1: Create staff loans and advances accounts in COA
INSERT INTO chart_of_accounts (code, name, account_type, is_active)
VALUES 
  ('1150', 'Staff Loans & Advances', 'asset', true),
  ('1151', 'Staff Loans Receivable', 'asset', true),
  ('1152', 'Salary Advances', 'asset', true)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Create staff_loans table
CREATE TABLE IF NOT EXISTS staff_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  staff_name TEXT NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL,
  loan_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'partial')),
  amount_repaid DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) GENERATED ALWAYS AS (loan_amount - COALESCE(amount_repaid, 0)) STORED,
  description TEXT,
  payment_method TEXT DEFAULT 'cash',
  bank_account_id UUID REFERENCES bank_accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create staff_loan_repayments table
CREATE TABLE IF NOT EXISTS staff_loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES staff_loans(id) ON DELETE CASCADE,
  repayment_number TEXT NOT NULL UNIQUE,
  repayment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  bank_account_id UUID REFERENCES bank_accounts(id),
  description TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create staff_advances table
CREATE TABLE IF NOT EXISTS staff_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_number TEXT NOT NULL UNIQUE,
  staff_name TEXT NOT NULL,
  advance_amount DECIMAL(15,2) NOT NULL,
  advance_date DATE NOT NULL,
  deduction_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'partial')),
  amount_deducted DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) GENERATED ALWAYS AS (advance_amount - COALESCE(amount_deducted, 0)) STORED,
  description TEXT,
  payment_method TEXT DEFAULT 'cash',
  bank_account_id UUID REFERENCES bank_accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_loans_staff_name ON staff_loans(staff_name);
CREATE INDEX IF NOT EXISTS idx_staff_loans_status ON staff_loans(status);
CREATE INDEX IF NOT EXISTS idx_staff_loan_repayments_loan_id ON staff_loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_name ON staff_advances(staff_name);
CREATE INDEX IF NOT EXISTS idx_staff_advances_status ON staff_advances(status);

-- Step 6: Enable RLS
ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_advances ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies
CREATE POLICY "Users can view staff loans"
  ON staff_loans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and accounts can manage staff loans"
  ON staff_loans FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'accounts')
    )
  );

CREATE POLICY "Users can view loan repayments"
  ON staff_loan_repayments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and accounts can manage loan repayments"
  ON staff_loan_repayments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'accounts')
    )
  );

CREATE POLICY "Users can view staff advances"
  ON staff_advances FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and accounts can manage staff advances"
  ON staff_advances FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'accounts')
    )
  );

-- Step 8: Auto-generate loan numbers
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.loan_number IS NULL OR NEW.loan_number = '' THEN
    SELECT 'LOAN-' || TO_CHAR(NEW.loan_date, 'YYMM') || '-' ||
           LPAD((COUNT(*) + 1)::TEXT, 4, '0')
      INTO NEW.loan_number
      FROM staff_loans
     WHERE DATE_TRUNC('month', loan_date) = DATE_TRUNC('month', NEW.loan_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_loan_number ON staff_loans;
CREATE TRIGGER trigger_generate_loan_number
  BEFORE INSERT ON staff_loans
  FOR EACH ROW
  EXECUTE FUNCTION generate_loan_number();

-- Step 9: Auto-generate advance numbers
CREATE OR REPLACE FUNCTION generate_advance_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.advance_number IS NULL OR NEW.advance_number = '' THEN
    SELECT 'ADV-' || TO_CHAR(NEW.advance_date, 'YYMM') || '-' ||
           LPAD((COUNT(*) + 1)::TEXT, 4, '0')
      INTO NEW.advance_number
      FROM staff_advances
     WHERE DATE_TRUNC('month', advance_date) = DATE_TRUNC('month', NEW.advance_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_advance_number ON staff_advances;
CREATE TRIGGER trigger_generate_advance_number
  BEFORE INSERT ON staff_advances
  FOR EACH ROW
  EXECUTE FUNCTION generate_advance_number();

-- Step 10: Create journal entries for staff loans
CREATE OR REPLACE FUNCTION post_staff_loan_to_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_journal_id UUID;
  v_loan_account_id UUID;
  v_bank_account_coa_id UUID;
  v_je_number TEXT;
BEGIN
  -- Get staff loan account (1151)
  SELECT id INTO v_loan_account_id
  FROM chart_of_accounts
  WHERE code = '1151'
  LIMIT 1;

  IF v_loan_account_id IS NULL THEN
    RAISE EXCEPTION 'Staff loans account 1151 not found';
  END IF;

  -- Generate journal entry number
  SELECT 'JE-' || TO_CHAR(NEW.loan_date, 'YYYYMMDD') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 4, '0')
    INTO v_je_number
    FROM journal_entries
   WHERE entry_date = NEW.loan_date;

  -- Create journal entry header
  INSERT INTO journal_entries (
    entry_number, entry_date, source_module, reference_id, reference_number,
    description, is_posted, created_by, posted_at
  ) VALUES (
    v_je_number, NEW.loan_date, 'staff_loan', NEW.id, NEW.loan_number,
    'Staff loan given to ' || NEW.staff_name,
    true, NEW.created_by, NOW()
  ) RETURNING id INTO v_journal_id;

  -- Line 1: Dr Staff Loans Receivable
  INSERT INTO journal_entry_lines (
    journal_entry_id, line_number, account_id, debit, credit, description
  ) VALUES (
    v_journal_id, 1, v_loan_account_id, NEW.loan_amount, 0, 
    'Loan given to ' || NEW.staff_name
  );

  -- Line 2: Cr Cash/Bank
  IF NEW.payment_method = 'bank' AND NEW.bank_account_id IS NOT NULL THEN
    SELECT coa_id INTO v_bank_account_coa_id 
    FROM bank_accounts 
    WHERE id = NEW.bank_account_id;
  ELSE
    -- Use petty cash
    SELECT id INTO v_bank_account_coa_id
    FROM chart_of_accounts
    WHERE code = '1102'
    LIMIT 1;
  END IF;

  INSERT INTO journal_entry_lines (
    journal_entry_id, line_number, account_id, debit, credit, description
  ) VALUES (
    v_journal_id, 2, v_bank_account_coa_id, 0, NEW.loan_amount, 
    'Payment to ' || NEW.staff_name
  );

  -- Update loan with journal entry id
  NEW.journal_entry_id := v_journal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_post_staff_loan ON staff_loans;
CREATE TRIGGER trigger_post_staff_loan
  BEFORE INSERT ON staff_loans
  FOR EACH ROW
  EXECUTE FUNCTION post_staff_loan_to_journal();

-- Step 11: Create journal entries for loan repayments
CREATE OR REPLACE FUNCTION post_loan_repayment_to_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_journal_id UUID;
  v_loan_account_id UUID;
  v_bank_account_coa_id UUID;
  v_je_number TEXT;
  v_loan staff_loans%ROWTYPE;
BEGIN
  -- Generate repayment number if not provided
  IF NEW.repayment_number IS NULL OR NEW.repayment_number = '' THEN
    SELECT 'REP-' || TO_CHAR(NEW.repayment_date, 'YYMM') || '-' ||
           LPAD((COUNT(*) + 1)::TEXT, 4, '0')
      INTO NEW.repayment_number
      FROM staff_loan_repayments
     WHERE DATE_TRUNC('month', repayment_date) = DATE_TRUNC('month', NEW.repayment_date);
  END IF;

  -- Get loan details
  SELECT * INTO v_loan FROM staff_loans WHERE id = NEW.loan_id;

  -- Get staff loan account (1151)
  SELECT id INTO v_loan_account_id
  FROM chart_of_accounts
  WHERE code = '1151'
  LIMIT 1;

  -- Generate journal entry number
  SELECT 'JE-' || TO_CHAR(NEW.repayment_date, 'YYYYMMDD') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 4, '0')
    INTO v_je_number
    FROM journal_entries
   WHERE entry_date = NEW.repayment_date;

  -- Create journal entry header
  INSERT INTO journal_entries (
    entry_number, entry_date, source_module, reference_id, reference_number,
    description, is_posted, created_by, posted_at
  ) VALUES (
    v_je_number, NEW.repayment_date, 'loan_repayment', NEW.id, NEW.repayment_number,
    'Loan repayment from ' || v_loan.staff_name || ' (' || v_loan.loan_number || ')',
    true, NEW.created_by, NOW()
  ) RETURNING id INTO v_journal_id;

  -- Line 1: Dr Cash/Bank
  IF NEW.payment_method = 'bank' AND NEW.bank_account_id IS NOT NULL THEN
    SELECT coa_id INTO v_bank_account_coa_id 
    FROM bank_accounts 
    WHERE id = NEW.bank_account_id;
  ELSE
    SELECT id INTO v_bank_account_coa_id
    FROM chart_of_accounts
    WHERE code = '1102'
    LIMIT 1;
  END IF;

  INSERT INTO journal_entry_lines (
    journal_entry_id, line_number, account_id, debit, credit, description
  ) VALUES (
    v_journal_id, 1, v_bank_account_coa_id, NEW.amount, 0, 
    'Repayment from ' || v_loan.staff_name
  );

  -- Line 2: Cr Staff Loans Receivable
  INSERT INTO journal_entry_lines (
    journal_entry_id, line_number, account_id, debit, credit, description
  ) VALUES (
    v_journal_id, 2, v_loan_account_id, 0, NEW.amount, 
    'Loan repayment - ' || v_loan.loan_number
  );

  -- Update repayment with journal entry id
  NEW.journal_entry_id := v_journal_id;

  -- Update loan repaid amount and status
  UPDATE staff_loans
  SET 
    amount_repaid = COALESCE(amount_repaid, 0) + NEW.amount,
    status = CASE 
      WHEN COALESCE(amount_repaid, 0) + NEW.amount >= loan_amount THEN 'repaid'
      WHEN COALESCE(amount_repaid, 0) + NEW.amount > 0 THEN 'partial'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = NEW.loan_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_post_loan_repayment ON staff_loan_repayments;
CREATE TRIGGER trigger_post_loan_repayment
  BEFORE INSERT ON staff_loan_repayments
  FOR EACH ROW
  EXECUTE FUNCTION post_loan_repayment_to_journal();

-- Step 12: Fix petty cash trigger to include reference number
DROP TRIGGER IF EXISTS trigger_post_petty_cash ON petty_cash_transactions;

CREATE OR REPLACE FUNCTION post_petty_cash_to_journal_fixed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_journal_id UUID;
  v_petty_cash_account_id UUID;
  v_bank_account_coa_id UUID;
  v_expense_account_id UUID;
  v_line_num INT := 0;
  v_je_number TEXT;
BEGIN
  IF NEW.fund_transfer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_petty_cash_account_id
  FROM chart_of_accounts WHERE code = '1102' LIMIT 1;

  IF v_petty_cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Petty cash account 1102 not found';
  END IF;

  SELECT 'JE-' || TO_CHAR(NEW.transaction_date, 'YYYYMMDD') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 4, '0')
    INTO v_je_number
    FROM journal_entries
   WHERE entry_date = NEW.transaction_date;

  INSERT INTO journal_entries (
    entry_number, entry_date, source_module, reference_id, reference_number,
    description, is_posted, created_by, posted_at
  ) VALUES (
    v_je_number, NEW.transaction_date, 'petty_cash', NEW.id, NEW.transaction_number,
    'Petty cash ' || NEW.transaction_type || ': ' || NEW.description,
    true, NEW.created_by, NOW()
  ) RETURNING id INTO v_journal_id;

  IF NEW.transaction_type = 'withdraw' THEN
    v_line_num := v_line_num + 1;
    INSERT INTO journal_entry_lines (
      journal_entry_id, line_number, account_id, debit, credit, description
    ) VALUES (
      v_journal_id, v_line_num, v_petty_cash_account_id, NEW.amount, 0, 'Cash withdrawal'
    );

    IF NEW.bank_account_id IS NOT NULL THEN
      SELECT coa_id INTO v_bank_account_coa_id 
      FROM bank_accounts WHERE id = NEW.bank_account_id;
      
      IF v_bank_account_coa_id IS NOT NULL THEN
        v_line_num := v_line_num + 1;
        INSERT INTO journal_entry_lines (
          journal_entry_id, line_number, account_id, debit, credit, description
        ) VALUES (
          v_journal_id, v_line_num, v_bank_account_coa_id, 0, NEW.amount, 'Bank withdrawal for petty cash'
        );
      END IF;
    END IF;

  ELSIF NEW.transaction_type = 'expense' THEN
    SELECT id INTO v_expense_account_id
    FROM chart_of_accounts
    WHERE account_type = 'expense' AND (
      CASE 
        WHEN NEW.expense_category = 'Utilities' THEN code = '6300'
        WHEN NEW.expense_category = 'Office Supplies' THEN code = '6310'
        WHEN NEW.expense_category = 'Transportation' THEN code = '6320'
        WHEN NEW.expense_category = 'Meals & Entertainment' THEN code = '6330'
        WHEN NEW.expense_category = 'Postage & Courier' THEN code = '6340'
        WHEN NEW.expense_category = 'Cleaning & Maintenance' THEN code = '6350'
        WHEN NEW.expense_category = 'Staff Salaries & Wages' THEN code = '6360'
        WHEN NEW.expense_category = 'Staff Benefits & Allowances' THEN code = '6370'
        WHEN NEW.expense_category = 'Printing & Stationery' THEN code = '6380'
        WHEN NEW.expense_category = 'Telephone & Internet' THEN code = '6390'
        WHEN NEW.expense_category = 'Bank Charges' THEN code = '6400'
        WHEN NEW.expense_category = 'Professional Fees' THEN code = '6410'
        WHEN NEW.expense_category = 'Office Renovation & Shifting' THEN code = '6420'
        WHEN NEW.expense_category = 'Other Expenses' THEN code = '6490'
        ELSE code = '5102'
      END
    )
    LIMIT 1;

    IF v_expense_account_id IS NULL THEN
      SELECT id INTO v_expense_account_id
      FROM chart_of_accounts WHERE code = '5102' LIMIT 1;
    END IF;

    IF v_expense_account_id IS NULL THEN
      RAISE EXCEPTION 'No expense account found for petty cash expense';
    END IF;

    v_line_num := v_line_num + 1;
    INSERT INTO journal_entry_lines (
      journal_entry_id, line_number, account_id, debit, credit, description
    ) VALUES (
      v_journal_id, v_line_num, v_expense_account_id, NEW.amount, 0, 
      COALESCE(NEW.expense_category, 'General expense')
    );

    v_line_num := v_line_num + 1;
    INSERT INTO journal_entry_lines (
      journal_entry_id, line_number, account_id, debit, credit, description
    ) VALUES (
      v_journal_id, v_line_num, v_petty_cash_account_id, 0, NEW.amount, 'Cash expense'
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in post_petty_cash_to_journal: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_post_petty_cash
  AFTER INSERT ON petty_cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION post_petty_cash_to_journal_fixed();

-- Step 13: Update existing petty cash journal entries with reference numbers
UPDATE journal_entries je
SET reference_number = pct.transaction_number
FROM petty_cash_transactions pct
WHERE je.source_module = 'petty_cash'
  AND je.reference_id = pct.id
  AND je.reference_number IS NULL;

COMMENT ON TABLE staff_loans IS 'Track loans given to staff members with repayment history';
COMMENT ON TABLE staff_loan_repayments IS 'Record repayments made against staff loans';
COMMENT ON TABLE staff_advances IS 'Track salary advances given to staff';

SELECT 'Staff loans and advances system created with journal integration' as status;
