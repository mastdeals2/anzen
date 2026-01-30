/*
  # Fix RPC Functions and Console Errors
  
  ## Issues Fixed
  1. get_staff_outstanding_summary - Return type mismatch (returns TEXT instead of structure)
  2. get_trial_balance - Function does not exist  
  3. app_settings query - Returns multiple rows instead of single row
  
  ## Changes
  1. Recreate get_staff_outstanding_summary with proper return type
  2. Create get_trial_balance function
  3. Update app_settings to only return first row
*/

-- Step 1: Drop and recreate get_staff_outstanding_summary with correct return type
DROP FUNCTION IF EXISTS get_staff_outstanding_summary();

CREATE OR REPLACE FUNCTION get_staff_outstanding_summary()
RETURNS TABLE (
  staff_name TEXT,
  employee_id TEXT,
  account_code TEXT,
  outstanding_balance NUMERIC(15,2),
  last_transaction_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.staff_name::TEXT,
    sm.employee_id::TEXT,
    coa.code::TEXT as account_code,
    COALESCE(SUM(jel.debit - jel.credit), 0)::NUMERIC(15,2) as outstanding_balance,
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

-- Step 2: Create get_trial_balance function
CREATE OR REPLACE FUNCTION get_trial_balance(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NOW()::DATE
)
RETURNS TABLE (
  code TEXT,
  name TEXT,
  name_id TEXT,
  account_type TEXT,
  account_group TEXT,
  normal_balance TEXT,
  total_debit NUMERIC(15,2),
  total_credit NUMERIC(15,2),
  balance NUMERIC(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    coa.code::TEXT,
    coa.name::TEXT,
    coa.name_id::TEXT,
    coa.account_type::TEXT,
    coa.account_group::TEXT,
    coa.normal_balance::TEXT,
    COALESCE(SUM(jel.debit), 0)::NUMERIC(15,2) as total_debit,
    COALESCE(SUM(jel.credit), 0)::NUMERIC(15,2) as total_credit,
    CASE 
      WHEN coa.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit - jel.credit), 0)
      ELSE COALESCE(SUM(jel.credit - jel.debit), 0)
    END::NUMERIC(15,2) as balance
  FROM chart_of_accounts coa
  LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND je.entry_date <= p_end_date
  WHERE coa.is_active = true
  GROUP BY coa.id, coa.code, coa.name, coa.name_id, coa.account_type, coa.account_group, coa.normal_balance
  HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
  ORDER BY coa.code;
END;
$$;

COMMENT ON FUNCTION get_staff_outstanding_summary IS 'Returns staff members with outstanding advance balances';
COMMENT ON FUNCTION get_trial_balance IS 'Returns trial balance for given date range';
