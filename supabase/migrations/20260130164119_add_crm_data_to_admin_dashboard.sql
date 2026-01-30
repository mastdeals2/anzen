/*
  # Add CRM Data to Admin Dashboard
  
  1. Updates
    - Adds CRM snapshot to `get_admin_dashboard_data` function
    - Includes upcoming reminders count (next 7 days)
    - Includes today's appointments
    - Includes active inquiries count
    - Includes hot leads count (Hot temperature inquiries)
  
  2. CRM Metrics
    - Upcoming reminders: Tasks/reminders due in next 7 days
    - Today's appointments: Reminders with type 'follow_up' due today
    - Active inquiries: Open inquiries (status not 'closed', 'lost', 'converted')
    - Hot leads: Inquiries with temperature = 'Hot'
*/

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
  v_crm_snapshot jsonb;
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
  
  -- CRM snapshot
  SELECT jsonb_build_object(
    'upcoming_reminders', (
      SELECT COUNT(*)
      FROM crm_reminders
      WHERE is_completed = false
        AND due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
    ),
    'todays_appointments', (
      SELECT COUNT(*)
      FROM crm_reminders
      WHERE is_completed = false
        AND DATE(due_date) = CURRENT_DATE
        AND reminder_type = 'follow_up'
    ),
    'active_inquiries', (
      SELECT COUNT(*)
      FROM crm_inquiries
      WHERE status NOT IN ('closed', 'lost', 'converted')
    ),
    'hot_leads', (
      SELECT COUNT(*)
      FROM crm_inquiries
      WHERE temperature = 'Hot'
        AND status NOT IN ('closed', 'lost', 'converted')
    )
  ) INTO v_crm_snapshot;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'sales_snapshot', v_sales_snapshot,
    'finance_snapshot', v_finance_snapshot,
    'stock_snapshot', v_stock_snapshot,
    'alerts_summary', v_alerts_summary,
    'pending_approvals', v_pending_approvals,
    'system_health', v_system_health,
    'crm_snapshot', v_crm_snapshot
  );
  
  RETURN v_result;
END;
$$;
