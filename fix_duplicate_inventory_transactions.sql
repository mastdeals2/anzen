/*
  # Fix Duplicate Inventory Transactions Causing Negative Opening Stock

  ## Problem
  The negative opening stock in Inventory Movement report is caused by DUPLICATE transactions:
  - Delivery Challan creates an inventory transaction (-100)
  - Later, Sales Invoice ALSO creates a transaction for the same items (-100)
  - Result: Double deduction (-200 total instead of -100)

  ## Examples Found
  - PROD-0001 (Lidocaine): DC deducted 100, Invoice deducted 100 again = -100 opening
  - PROD-0005 (Domperidone): Multiple duplicate sales = -75 opening
  - PROD-0007 (Ammonium Chloride): DC + duplicate invoices = -3000 opening
  - PROD-0013 (Ketoconazole): 150 in, 300 out (duplicate) = -150 closing

  ## Solution
  1. Identify transactions where BOTH delivery_challan AND sale exist for same items
  2. Keep the delivery_challan transaction (first/original)
  3. Delete the duplicate sale transaction

  ## Safety
  This script only removes duplicates created by the double-deduction bug.
  It does NOT affect legitimate transactions.
*/

-- Step 1: Find duplicate sale transactions that have matching delivery challan
-- (These are the ones that cause double deduction)
SELECT
  it.id,
  it.transaction_date,
  it.transaction_type,
  it.reference_number,
  it.quantity,
  p.product_code,
  p.product_name,
  it.created_at
FROM inventory_transactions it
JOIN products p ON p.id = it.product_id
WHERE it.transaction_type = 'sale'
  AND it.reference_number IN (
    SELECT DISTINCT reference_number
    FROM inventory_transactions
    WHERE transaction_type = 'delivery_challan'
  )
ORDER BY it.reference_number, p.product_code;

-- Step 2: Delete the duplicate sale transactions
-- IMPORTANT: Run this ONLY after reviewing the SELECT results above
/*
DELETE FROM inventory_transactions
WHERE id IN (
  SELECT it.id
  FROM inventory_transactions it
  WHERE it.transaction_type = 'sale'
    AND it.reference_number IN (
      SELECT DISTINCT reference_number
      FROM inventory_transactions
      WHERE transaction_type = 'delivery_challan'
    )
);
*/

-- Step 3: Verify the fix by checking opening balances
SELECT
  p.product_code,
  p.product_name,
  SUM(CASE WHEN it.transaction_date < '2025-12-01' THEN it.quantity ELSE 0 END) as opening_balance_before_dec,
  SUM(CASE WHEN it.quantity > 0 THEN it.quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN it.quantity < 0 THEN ABS(it.quantity) ELSE 0 END) as total_out
FROM products p
LEFT JOIN inventory_transactions it ON it.product_id = p.id
WHERE p.product_code IN ('PROD-0001', 'PROD-0005', 'PROD-0007', 'PROD-0013')
GROUP BY p.id, p.product_code, p.product_name
ORDER BY p.product_code;
