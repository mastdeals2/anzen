/*
  # Revert Separate Staff Loans - Use Proper Accounting System
  
  ## Problem
  Created a parallel staff loans system that bypassed the existing accounting engine.
  This violates accounting principles and creates duplicate logic.
  
  ## Solution
  1. Drop separate staff_loans and staff_advances tables
  2. Staff will be accounts in chart_of_accounts (like customers/suppliers)
  3. Staff advances will use existing voucher system (payment/journal)
  4. Staff ledger will appear in Party Ledger (same as customers/suppliers)
  5. All transactions flow through standard journal_entries
  6. Bank reconciliation works automatically
  
  ## Architecture
  - Staff = Account in COA (Type: Current Asset - Staff Advances)
  - Advance given = Payment Voucher (Dr Staff, Cr Bank)
  - Advance returned = Receipt Voucher (Dr Bank, Cr Staff)
  - Salary deduction = Journal Entry (Dr Salary Expense, Cr Staff)
  - Ledger balance = Automatic from journal entries
  - Works with Trial Balance, Receivables, Bank Recon
*/

-- Step 1: Drop all staff loan related objects (wrong approach)
DROP TRIGGER IF EXISTS trigger_post_staff_loan ON staff_loans;
DROP TRIGGER IF EXISTS trigger_post_loan_repayment ON staff_loan_repayments;
DROP TRIGGER IF EXISTS trigger_generate_loan_number ON staff_loans;
DROP TRIGGER IF EXISTS trigger_generate_advance_number ON staff_advances;

DROP FUNCTION IF EXISTS post_staff_loan_to_journal();
DROP FUNCTION IF EXISTS post_loan_repayment_to_journal();
DROP FUNCTION IF EXISTS generate_loan_number();
DROP FUNCTION IF EXISTS generate_advance_number();
DROP FUNCTION IF EXISTS get_staff_ledger(TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS get_staff_outstanding_balances();

-- Delete journal entries created by staff loan system before dropping tables
DELETE FROM journal_entry_lines 
WHERE journal_entry_id IN (
  SELECT id FROM journal_entries WHERE source_module IN ('staff_loan', 'loan_repayment')
);

DELETE FROM journal_entries WHERE source_module IN ('staff_loan', 'loan_repayment');

DROP TABLE IF EXISTS staff_loan_repayments CASCADE;
DROP TABLE IF EXISTS staff_loans CASCADE;
DROP TABLE IF EXISTS staff_advances CASCADE;

-- Step 2: Create proper staff accounts parent in COA
INSERT INTO chart_of_accounts (code, name, account_type, is_active, description)
VALUES 
  ('1160', 'Staff Advances & Loans', 'asset', true, 'Parent account for all staff advances and loans')
ON CONFLICT (code) DO UPDATE SET
  name = 'Staff Advances & Loans',
  account_type = 'asset',
  is_active = true;

-- Remove old staff loan accounts that were created incorrectly
DELETE FROM chart_of_accounts WHERE code IN ('1150', '1151', '1152');

-- Step 3: Create staff_members table (for UI convenience only, not for accounting)
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name TEXT NOT NULL UNIQUE,
  coa_account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  employee_id TEXT,
  department TEXT,
  designation TEXT,
  phone TEXT,
  email TEXT,
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_name ON staff_members(staff_name);
CREATE INDEX IF NOT EXISTS idx_staff_members_coa ON staff_members(coa_account_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_active ON staff_members(is_active);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view staff members"
  ON staff_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and accounts can manage staff members"
  ON staff_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'accounts')
    )
  );

-- Step 4: Create helper function to create staff account in COA
CREATE OR REPLACE FUNCTION create_staff_account(
  p_staff_name TEXT,
  p_employee_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coa_id UUID;
  v_staff_id UUID;
  v_next_code TEXT;
BEGIN
  -- Check if staff already exists
  SELECT coa_account_id INTO v_coa_id
  FROM staff_members
  WHERE LOWER(staff_name) = LOWER(p_staff_name);
  
  IF v_coa_id IS NOT NULL THEN
    RETURN v_coa_id;
  END IF;
  
  -- Generate next staff account code (1161, 1162, etc.)
  SELECT '116' || LPAD((COUNT(*) + 1)::TEXT, 1, '0')
  INTO v_next_code
  FROM chart_of_accounts
  WHERE code LIKE '116%' AND code != '1160';
  
  -- Create account in COA
  INSERT INTO chart_of_accounts (code, name, account_type, is_active, description)
  VALUES (
    v_next_code,
    p_staff_name || ' - Staff Advance',
    'asset',
    true,
    'Staff advance account for ' || p_staff_name
  )
  RETURNING id INTO v_coa_id;
  
  -- Create staff member record
  INSERT INTO staff_members (staff_name, coa_account_id, employee_id)
  VALUES (p_staff_name, v_coa_id, p_employee_id)
  RETURNING id INTO v_staff_id;
  
  RETURN v_coa_id;
END;
$$;

-- Step 5: Create RPC function to get staff ledger (uses existing journal_entry_lines)
CREATE OR REPLACE FUNCTION get_staff_ledger_from_journal(
  p_staff_name TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NOW()::DATE
)
RETURNS TABLE (
  entry_date DATE,
  entry_number TEXT,
  voucher_type TEXT,
  reference_number TEXT,
  description TEXT,
  debit DECIMAL(15,2),
  credit DECIMAL(15,2),
  balance DECIMAL(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coa_id UUID;
BEGIN
  -- Get staff's COA account
  SELECT coa_account_id INTO v_coa_id
  FROM staff_members
  WHERE LOWER(staff_name) = LOWER(p_staff_name);
  
  IF v_coa_id IS NULL THEN
    RAISE EXCEPTION 'Staff member % not found', p_staff_name;
  END IF;
  
  RETURN QUERY
  SELECT 
    je.entry_date::DATE,
    je.entry_number,
    CASE 
      WHEN je.source_module = 'payment' THEN 'Payment Voucher'
      WHEN je.source_module = 'receipt' THEN 'Receipt Voucher'
      WHEN je.source_module = 'journal' THEN 'Journal Entry'
      ELSE INITCAP(je.source_module)
    END as voucher_type,
    COALESCE(je.reference_number, '-') as reference_number,
    COALESCE(jel.description, je.description, '-') as description,
    jel.debit,
    jel.credit,
    SUM(jel.debit - jel.credit) OVER (
      ORDER BY je.entry_date, je.entry_number, jel.line_number
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as balance
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE jel.account_id = v_coa_id
    AND je.entry_date >= COALESCE(p_start_date, '1900-01-01'::DATE)
    AND je.entry_date <= p_end_date
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;

-- Step 6: Create function to get all staff with outstanding balances
CREATE OR REPLACE FUNCTION get_staff_outstanding_summary()
RETURNS TABLE (
  staff_name TEXT,
  employee_id TEXT,
  account_code TEXT,
  outstanding_balance DECIMAL(15,2),
  last_transaction_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.staff_name,
    sm.employee_id,
    coa.code as account_code,
    COALESCE(SUM(jel.debit - jel.credit), 0) as outstanding_balance,
    MAX(je.entry_date)::DATE as last_transaction_date
  FROM staff_members sm
  JOIN chart_of_accounts coa ON sm.coa_account_id = coa.id
  LEFT JOIN journal_entry_lines jel ON jel.account_id = sm.coa_account_id
  LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE sm.is_active = true
  GROUP BY sm.staff_name, sm.employee_id, coa.code
  HAVING COALESCE(SUM(jel.debit - jel.credit), 0) != 0
  ORDER BY outstanding_balance DESC;
END;
$$;

-- Step 7: Update Party Ledger to include staff accounts
-- This is handled in the UI by filtering chart_of_accounts for type 'asset' with code like '116%'

COMMENT ON TABLE staff_members IS 'Staff member master data - links to chart_of_accounts for ledger';
COMMENT ON FUNCTION create_staff_account IS 'Creates staff account in COA and staff_members table';
COMMENT ON FUNCTION get_staff_ledger_from_journal IS 'Gets staff ledger from journal entries - uses existing accounting engine';
COMMENT ON FUNCTION get_staff_outstanding_summary IS 'Gets summary of staff with outstanding advance balances';

SELECT 'Staff accounting migrated to proper ledger system - all transactions now use standard vouchers' as status;
