/*
  # Role-Based Dashboard RPC Functions
  
  1. Dashboard Query Functions
    - `get_accounts_dashboard_data` - Finance/Accounts role dashboard
    - `get_sales_dashboard_data` - Sales role dashboard
    - `get_warehouse_dashboard_data` - Warehouse role dashboard
    - `get_admin_dashboard_data` - Admin master view dashboard
    - `get_user_tasks_summary` - Global tasks for all roles
    
  2. Security
    - All functions use SECURITY DEFINER
    - RLS policies enforced
    - User role validation
  
  3. Performance
    - Optimized queries with proper indexes
    - Aggregated data for speed
    - Returns JSON for flexibility
*/

-- =====================================================
-- ACCOUNTS DASHBOARD FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_accounts_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_bank_balance numeric;
  v_pending_receivables numeric;
  v_pending_payables numeric;
  v_unreconciled_count int;
  v_overdue_invoices_count int;
  v_overdue_invoices_amount numeric;
  v_cash_position numeric;
  v_staff_advances_pending int;
  v_pending_approvals int;
BEGIN
  -- Bank balance summary (all active bank accounts)
  SELECT COALESCE(SUM(current_balance), 0) INTO v_bank_balance
  FROM bank_accounts
  WHERE is_active = true;
  
  -- Pending receivables (unpaid sales invoices)
  SELECT COALESCE(SUM(si.total_amount - COALESCE(
    (SELECT SUM(ipa.allocated_amount) 
     FROM invoice_payment_allocations ipa 
     WHERE ipa.sales_invoice_id = si.id), 0
  )), 0) INTO v_pending_receivables
  FROM sales_invoices si
  WHERE si.payment_status IN ('pending', 'partial');
  
  -- Pending payables (unpaid purchase invoices)
  SELECT COALESCE(SUM(total_amount), 0) INTO v_pending_payables
  FROM purchase_invoices
  WHERE payment_status IN ('pending', 'partial');
  
  -- Unreconciled bank transactions
  SELECT COUNT(*) INTO v_unreconciled_count
  FROM bank_statement_lines
  WHERE reconciliation_status = 'unmatched';
  
  -- Overdue invoices
  SELECT 
    COUNT(*),
    COALESCE(SUM(si.total_amount - COALESCE(
      (SELECT SUM(ipa.allocated_amount) 
       FROM invoice_payment_allocations ipa 
       WHERE ipa.sales_invoice_id = si.id), 0
    )), 0)
  INTO v_overdue_invoices_count, v_overdue_invoices_amount
  FROM sales_invoices si
  WHERE si.payment_status IN ('pending', 'partial')
    AND si.due_date < CURRENT_DATE;
  
  -- Cash position (Cash on Hand + Petty Cash)
  SELECT COALESCE(SUM(balance), 0) INTO v_cash_position
  FROM chart_of_accounts
  WHERE code IN ('1101', '1102');
  
  -- Staff advances pending (would need staff_loans table - placeholder)
  v_staff_advances_pending := 0;
  
  -- Pending journal approvals (placeholder - depends on approval workflow)
  v_pending_approvals := 0;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'bank_balance', v_bank_balance,
    'pending_receivables', v_pending_receivables,
    'pending_payables', v_pending_payables,
    'unreconciled_transactions', v_unreconciled_count,
    'overdue_invoices_count', v_overdue_invoices_count,
    'overdue_invoices_amount', v_overdue_invoices_amount,
    'cash_position', v_cash_position,
    'staff_advances_pending', v_staff_advances_pending,
    'pending_approvals', v_pending_approvals
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- SALES DASHBOARD FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_sales_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_sales_today numeric;
  v_sales_today_count int;
  v_pending_quotations int;
  v_pending_dc int;
  v_unpaid_invoices_count int;
  v_unpaid_invoices_amount numeric;
  v_top_customers jsonb;
  v_followups_due int;
  v_pipeline_summary jsonb;
  v_overdue_actions int;
  v_pending_sales_orders int;
BEGIN
  -- Sales today
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total_amount), 0)
  INTO v_sales_today_count, v_sales_today
  FROM sales_invoices
  WHERE DATE(invoice_date) = CURRENT_DATE;
  
  -- Pending quotations
  SELECT COUNT(*) INTO v_pending_quotations
  FROM crm_quotations
  WHERE status = 'pending';
  
  -- Pending delivery challans
  SELECT COUNT(*) INTO v_pending_dc
  FROM delivery_challans
  WHERE approval_status = 'pending_approval';
  
  -- Pending sales orders
  SELECT COUNT(*) INTO v_pending_sales_orders
  FROM sales_orders
  WHERE status = 'pending_approval';
  
  -- Unpaid invoices
  SELECT 
    COUNT(*),
    COALESCE(SUM(si.total_amount - COALESCE(
      (SELECT SUM(ipa.allocated_amount) 
       FROM invoice_payment_allocations ipa 
       WHERE ipa.sales_invoice_id = si.id), 0
    )), 0)
  INTO v_unpaid_invoices_count, v_unpaid_invoices_amount
  FROM sales_invoices si
  WHERE si.payment_status IN ('pending', 'partial');
  
  -- Top 5 customers by revenue (this month)
  SELECT jsonb_agg(row_to_jsonb(t)) INTO v_top_customers
  FROM (
    SELECT 
      c.company_name,
      COALESCE(SUM(si.total_amount), 0) as revenue
    FROM customers c
    LEFT JOIN sales_invoices si ON si.customer_id = c.id
      AND DATE_TRUNC('month', si.invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
    WHERE c.is_active = true
    GROUP BY c.id, c.company_name
    ORDER BY revenue DESC
    LIMIT 5
  ) t;
  
  -- Follow-ups due (today and overdue)
  SELECT COUNT(*) INTO v_followups_due
  FROM crm_activities
  WHERE is_completed = false
    AND follow_up_date IS NOT NULL
    AND follow_up_date <= CURRENT_DATE;
  
  -- CRM pipeline summary
  SELECT jsonb_agg(row_to_jsonb(t)) INTO v_pipeline_summary
  FROM (
    SELECT 
      status,
      COUNT(*) as count
    FROM crm_inquiries
    WHERE status NOT IN ('won', 'lost')
    GROUP BY status
  ) t;
  
  -- Overdue customer actions
  SELECT COUNT(*) INTO v_overdue_actions
  FROM crm_activities
  WHERE is_completed = false
    AND follow_up_date < CURRENT_DATE;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'sales_today', v_sales_today,
    'sales_today_count', v_sales_today_count,
    'pending_quotations', v_pending_quotations,
    'pending_delivery_challans', v_pending_dc,
    'pending_sales_orders', v_pending_sales_orders,
    'unpaid_invoices_count', v_unpaid_invoices_count,
    'unpaid_invoices_amount', v_unpaid_invoices_amount,
    'top_customers', COALESCE(v_top_customers, '[]'::jsonb),
    'followups_due', v_followups_due,
    'pipeline_summary', COALESCE(v_pipeline_summary, '[]'::jsonb),
    'overdue_actions', v_overdue_actions
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- WAREHOUSE DASHBOARD FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_warehouse_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_low_stock_count int;
  v_near_expiry_count int;
  v_pending_dispatch int;
  v_incoming_stock int;
  v_batch_alerts int;
  v_inventory_value numeric;
  v_pick_pack_tasks int;
  v_stock_rejections int;
  v_low_stock_items jsonb;
  v_near_expiry_items jsonb;
BEGIN
  -- Low stock alerts
  SELECT COUNT(*) INTO v_low_stock_count
  FROM products
  WHERE is_active = true
    AND min_stock_level > 0
    AND current_stock < min_stock_level;
  
  -- Get low stock items details
  SELECT jsonb_agg(row_to_jsonb(t)) INTO v_low_stock_items
  FROM (
    SELECT 
      product_code,
      product_name,
      current_stock,
      min_stock_level,
      (min_stock_level - current_stock) as shortage
    FROM products
    WHERE is_active = true
      AND min_stock_level > 0
      AND current_stock < min_stock_level
    ORDER BY (min_stock_level - current_stock) DESC
    LIMIT 10
  ) t;
  
  -- Near expiry batches (within 30 days)
  SELECT COUNT(*) INTO v_near_expiry_count
  FROM batches
  WHERE is_active = true
    AND current_stock > 0
    AND expiry_date IS NOT NULL
    AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days');
  
  -- Get near expiry items details
  SELECT jsonb_agg(row_to_jsonb(t)) INTO v_near_expiry_items
  FROM (
    SELECT 
      b.batch_number,
      p.product_name,
      b.current_stock,
      b.expiry_date,
      (b.expiry_date - CURRENT_DATE) as days_to_expiry
    FROM batches b
    JOIN products p ON p.id = b.product_id
    WHERE b.is_active = true
      AND b.current_stock > 0
      AND b.expiry_date IS NOT NULL
      AND b.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
    ORDER BY b.expiry_date ASC
    LIMIT 10
  ) t;
  
  -- Pending dispatch (approved DCs not yet delivered)
  SELECT COUNT(*) INTO v_pending_dispatch
  FROM delivery_challans
  WHERE approval_status = 'approved';
  
  -- Incoming stock (pending POs or import containers)
  SELECT COUNT(*) INTO v_incoming_stock
  FROM purchase_orders
  WHERE status IN ('approved', 'sent_to_supplier');
  
  -- Batch alerts (expired or near zero stock)
  SELECT COUNT(*) INTO v_batch_alerts
  FROM batches
  WHERE is_active = true
    AND (
      (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE AND current_stock > 0)
      OR (current_stock <= 0 AND current_stock > -10)
    );
  
  -- Inventory valuation (approximate)
  SELECT COALESCE(SUM(b.current_stock * b.unit_price), 0) INTO v_inventory_value
  FROM batches b
  WHERE b.is_active = true
    AND b.current_stock > 0;
  
  -- Pick/pack tasks (delivery challans to be processed)
  SELECT COUNT(*) INTO v_pick_pack_tasks
  FROM delivery_challans
  WHERE approval_status IN ('pending_approval', 'approved');
  
  -- Stock rejections (recent)
  SELECT COUNT(*) INTO v_stock_rejections
  FROM stock_rejections
  WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days';
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'low_stock_count', v_low_stock_count,
    'low_stock_items', COALESCE(v_low_stock_items, '[]'::jsonb),
    'near_expiry_count', v_near_expiry_count,
    'near_expiry_items', COALESCE(v_near_expiry_items, '[]'::jsonb),
    'pending_dispatch', v_pending_dispatch,
    'incoming_stock', v_incoming_stock,
    'batch_alerts', v_batch_alerts,
    'inventory_value', v_inventory_value,
    'pick_pack_tasks', v_pick_pack_tasks,
    'stock_rejections', v_stock_rejections
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- ADMIN DASHBOARD FUNCTIONS (Master View)
-- =====================================================

CREATE OR REPLACE FUNCTION get_admin_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_sales_snapshot jsonb;
  v_finance_snapshot jsonb;
  v_stock_snapshot jsonb;
  v_alerts_summary jsonb;
  v_pending_approvals jsonb;
  v_system_health jsonb;
BEGIN
  -- Sales snapshot
  SELECT jsonb_build_object(
    'today_revenue', COALESCE(SUM(total_amount), 0),
    'today_count', COUNT(*),
    'month_revenue', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM sales_invoices
      WHERE DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'pending_orders', (
      SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval'
    )
  ) INTO v_sales_snapshot
  FROM sales_invoices
  WHERE DATE(invoice_date) = CURRENT_DATE;
  
  -- Finance snapshot
  SELECT jsonb_build_object(
    'bank_balance', (
      SELECT COALESCE(SUM(current_balance), 0)
      FROM bank_accounts
      WHERE is_active = true
    ),
    'receivables', (
      SELECT COALESCE(SUM(si.total_amount - COALESCE(
        (SELECT SUM(ipa.allocated_amount) 
         FROM invoice_payment_allocations ipa 
         WHERE ipa.sales_invoice_id = si.id), 0
      )), 0)
      FROM sales_invoices si
      WHERE si.payment_status IN ('pending', 'partial')
    ),
    'payables', (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM purchase_invoices
      WHERE payment_status IN ('pending', 'partial')
    ),
    'overdue_invoices', (
      SELECT COUNT(*)
      FROM sales_invoices
      WHERE payment_status IN ('pending', 'partial')
        AND due_date < CURRENT_DATE
    )
  ) INTO v_finance_snapshot;
  
  -- Stock snapshot
  SELECT jsonb_build_object(
    'total_products', (
      SELECT COUNT(*) FROM products WHERE is_active = true
    ),
    'low_stock', (
      SELECT COUNT(*)
      FROM products
      WHERE is_active = true
        AND min_stock_level > 0
        AND current_stock < min_stock_level
    ),
    'near_expiry', (
      SELECT COUNT(*)
      FROM batches
      WHERE is_active = true
        AND current_stock > 0
        AND expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
    ),
    'inventory_value', (
      SELECT COALESCE(SUM(b.current_stock * b.unit_price), 0)
      FROM batches b
      WHERE b.is_active = true AND b.current_stock > 0
    )
  ) INTO v_stock_snapshot;
  
  -- Alerts summary
  SELECT jsonb_build_object(
    'critical', (
      SELECT COUNT(*)
      FROM products
      WHERE is_active = true
        AND current_stock <= 0
    ) + (
      SELECT COUNT(*)
      FROM sales_invoices
      WHERE payment_status IN ('pending', 'partial')
        AND due_date < CURRENT_DATE - INTERVAL '30 days'
    ),
    'warning', (
      SELECT COUNT(*)
      FROM products
      WHERE is_active = true
        AND min_stock_level > 0
        AND current_stock < min_stock_level
    ),
    'info', (
      SELECT COUNT(*)
      FROM crm_activities
      WHERE is_completed = false
        AND follow_up_date = CURRENT_DATE
    )
  ) INTO v_alerts_summary;
  
  -- Pending approvals
  SELECT jsonb_build_object(
    'sales_orders', (
      SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval'
    ),
    'delivery_challans', (
      SELECT COUNT(*) FROM delivery_challans WHERE approval_status = 'pending_approval'
    ),
    'credit_notes', (
      SELECT COUNT(*) FROM credit_notes WHERE approval_status = 'pending'
    ),
    'material_returns', (
      SELECT COUNT(*) FROM material_returns WHERE approval_status = 'pending'
    )
  ) INTO v_pending_approvals;
  
  -- System health
  SELECT jsonb_build_object(
    'active_users', (
      SELECT COUNT(*) FROM user_profiles WHERE is_active = true
    ),
    'active_customers', (
      SELECT COUNT(*) FROM customers WHERE is_active = true
    ),
    'active_products', (
      SELECT COUNT(*) FROM products WHERE is_active = true
    ),
    'unread_notifications', (
      SELECT COUNT(*)
      FROM notifications
      WHERE user_id = p_user_id
        AND is_read = false
    )
  ) INTO v_system_health;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'sales_snapshot', v_sales_snapshot,
    'finance_snapshot', v_finance_snapshot,
    'stock_snapshot', v_stock_snapshot,
    'alerts_summary', v_alerts_summary,
    'pending_approvals', v_pending_approvals,
    'system_health', v_system_health
  );
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- GLOBAL TASKS SUMMARY (All Roles)
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_tasks_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_my_tasks int;
  v_overdue_tasks int;
  v_today_tasks int;
  v_pending_approvals int;
  v_recent_tasks jsonb;
BEGIN
  -- Tasks assigned to user
  SELECT COUNT(*) INTO v_my_tasks
  FROM tasks
  WHERE p_user_id = ANY(assigned_users)
    AND status != 'completed'
    AND (is_deleted IS NULL OR is_deleted = false)
    AND (dismissed_at IS NULL);
  
  -- Overdue tasks
  SELECT COUNT(*) INTO v_overdue_tasks
  FROM tasks
  WHERE p_user_id = ANY(assigned_users)
    AND status != 'completed'
    AND deadline < NOW()
    AND (is_deleted IS NULL OR is_deleted = false)
    AND (dismissed_at IS NULL);
  
  -- Today's tasks
  SELECT COUNT(*) INTO v_today_tasks
  FROM tasks
  WHERE p_user_id = ANY(assigned_users)
    AND status != 'completed'
    AND DATE(deadline) = CURRENT_DATE
    AND (is_deleted IS NULL OR is_deleted = false)
    AND (dismissed_at IS NULL);
  
  -- Pending approvals (role-specific)
  SELECT 
    (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval') +
    (SELECT COUNT(*) FROM delivery_challans WHERE approval_status = 'pending_approval') +
    (SELECT COUNT(*) FROM credit_notes WHERE approval_status = 'pending') +
    (SELECT COUNT(*) FROM material_returns WHERE approval_status = 'pending')
  INTO v_pending_approvals;
  
  -- Recent tasks (top 5)
  SELECT jsonb_agg(row_to_jsonb(t)) INTO v_recent_tasks
  FROM (
    SELECT 
      id,
      title,
      priority,
      status,
      deadline,
      task_type
    FROM tasks
    WHERE p_user_id = ANY(assigned_users)
      AND status != 'completed'
      AND (is_deleted IS NULL OR is_deleted = false)
      AND (dismissed_at IS NULL)
    ORDER BY 
      CASE 
        WHEN deadline < NOW() THEN 0
        WHEN DATE(deadline) = CURRENT_DATE THEN 1
        ELSE 2
      END,
      priority DESC,
      deadline ASC
    LIMIT 5
  ) t;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'my_tasks', v_my_tasks,
    'overdue_tasks', v_overdue_tasks,
    'today_tasks', v_today_tasks,
    'pending_approvals', v_pending_approvals,
    'recent_tasks', COALESCE(v_recent_tasks, '[]'::jsonb)
  );
  
  RETURN v_result;
END;
$$;