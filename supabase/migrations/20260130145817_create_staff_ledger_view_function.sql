/*
  # Staff Ledger View Function
  
  Creates an RPC function to view individual staff member ledgers showing:
  - All loans given
  - All repayments made
  - All salary advances
  - Running balance
*/

CREATE OR REPLACE FUNCTION get_staff_ledger(
  p_staff_name TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NOW()::DATE
)
RETURNS TABLE (
  transaction_date DATE,
  transaction_type TEXT,
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
  v_running_balance DECIMAL(15,2) := 0;
BEGIN
  RETURN QUERY
  WITH transactions AS (
    -- Staff loans (debit - money given to staff)
    SELECT 
      sl.loan_date as trans_date,
      'Loan Given' as trans_type,
      sl.loan_number as ref_num,
      COALESCE(sl.description, 'Loan given to ' || sl.staff_name) as desc_text,
      sl.loan_amount as dr,
      0::DECIMAL(15,2) as cr
    FROM staff_loans sl
    WHERE LOWER(sl.staff_name) = LOWER(p_staff_name)
      AND sl.loan_date >= COALESCE(p_start_date, '1900-01-01'::DATE)
      AND sl.loan_date <= p_end_date

    UNION ALL

    -- Loan repayments (credit - money received from staff)
    SELECT 
      slr.repayment_date as trans_date,
      'Loan Repayment' as trans_type,
      slr.repayment_number as ref_num,
      COALESCE(slr.description, 'Loan repayment') as desc_text,
      0::DECIMAL(15,2) as dr,
      slr.amount as cr
    FROM staff_loan_repayments slr
    JOIN staff_loans sl ON slr.loan_id = sl.id
    WHERE LOWER(sl.staff_name) = LOWER(p_staff_name)
      AND slr.repayment_date >= COALESCE(p_start_date, '1900-01-01'::DATE)
      AND slr.repayment_date <= p_end_date

    UNION ALL

    -- Salary advances (debit - money given to staff)
    SELECT 
      sa.advance_date as trans_date,
      'Salary Advance' as trans_type,
      sa.advance_number as ref_num,
      COALESCE(sa.description, 'Salary advance to ' || sa.staff_name) as desc_text,
      sa.advance_amount as dr,
      0::DECIMAL(15,2) as cr
    FROM staff_advances sa
    WHERE LOWER(sa.staff_name) = LOWER(p_staff_name)
      AND sa.advance_date >= COALESCE(p_start_date, '1900-01-01'::DATE)
      AND sa.advance_date <= p_end_date

    ORDER BY trans_date, ref_num
  )
  SELECT 
    t.trans_date,
    t.trans_type,
    t.ref_num,
    t.desc_text,
    t.dr,
    t.cr,
    SUM(t.dr - t.cr) OVER (ORDER BY t.trans_date, t.ref_num ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as bal
  FROM transactions t;
END;
$$;

-- Create function to get all staff members with outstanding balances
CREATE OR REPLACE FUNCTION get_staff_outstanding_balances()
RETURNS TABLE (
  staff_name TEXT,
  total_loans DECIMAL(15,2),
  total_repayments DECIMAL(15,2),
  total_advances DECIMAL(15,2),
  outstanding_balance DECIMAL(15,2),
  last_transaction_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH staff_summary AS (
    SELECT 
      sl.staff_name,
      SUM(sl.loan_amount) as loans,
      SUM(sl.amount_repaid) as repayments,
      MAX(sl.loan_date) as last_loan_date
    FROM staff_loans sl
    GROUP BY sl.staff_name

    UNION ALL

    SELECT 
      sa.staff_name,
      0 as loans,
      0 as repayments,
      MAX(sa.advance_date) as last_loan_date
    FROM staff_advances sa
    GROUP BY sa.staff_name
  ),
  advances_summary AS (
    SELECT 
      staff_name,
      SUM(advance_amount - COALESCE(amount_deducted, 0)) as total_adv
    FROM staff_advances
    GROUP BY staff_name
  )
  SELECT 
    ss.staff_name,
    COALESCE(SUM(ss.loans), 0) as total_loans,
    COALESCE(SUM(ss.repayments), 0) as total_repayments,
    COALESCE(MAX(adv.total_adv), 0) as total_advances,
    COALESCE(SUM(ss.loans) - SUM(ss.repayments), 0) + COALESCE(MAX(adv.total_adv), 0) as outstanding_balance,
    MAX(ss.last_loan_date) as last_transaction_date
  FROM staff_summary ss
  LEFT JOIN advances_summary adv ON LOWER(ss.staff_name) = LOWER(adv.staff_name)
  GROUP BY ss.staff_name
  HAVING (COALESCE(SUM(ss.loans) - SUM(ss.repayments), 0) + COALESCE(MAX(adv.total_adv), 0)) != 0
  ORDER BY outstanding_balance DESC;
END;
$$;

COMMENT ON FUNCTION get_staff_ledger IS 'Get complete ledger for individual staff member showing loans, repayments, and advances';
COMMENT ON FUNCTION get_staff_outstanding_balances IS 'Get summary of all staff members with outstanding loan/advance balances';

SELECT 'Staff ledger functions created successfully' as status;
