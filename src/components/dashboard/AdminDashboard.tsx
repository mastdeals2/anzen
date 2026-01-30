import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { DashboardWidget } from './DashboardWidget';
import { TasksSummaryWidget } from './TasksSummaryWidget';
import {
  TrendingUp,
  Wallet,
  Package,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  Activity,
} from 'lucide-react';

interface AdminData {
  sales_snapshot: {
    today_revenue: number;
    today_count: number;
    month_revenue: number;
    pending_orders: number;
  };
  finance_snapshot: {
    bank_balance: number;
    receivables: number;
    payables: number;
    overdue_invoices: number;
  };
  stock_snapshot: {
    total_products: number;
    low_stock: number;
    near_expiry: number;
    inventory_value: number;
  };
  alerts_summary: {
    critical: number;
    warning: number;
    info: number;
  };
  pending_approvals: {
    sales_orders: number;
    delivery_challans: number;
    credit_notes: number;
    material_returns: number;
  };
  system_health: {
    active_users: number;
    active_customers: number;
    active_products: number;
    unread_notifications: number;
  };
  crm_snapshot?: {
    upcoming_reminders: number;
    todays_appointments: number;
    active_inquiries: number;
    hot_leads: number;
  };
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;

    try {
      const { data: result, error } = await supabase.rpc('get_admin_dashboard_data', {
        p_user_id: profile.id,
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const totalPendingApprovals = data
    ? data.pending_approvals.sales_orders +
      data.pending_approvals.delivery_challans +
      data.pending_approvals.credit_notes +
      data.pending_approvals.material_returns
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Welcome back, {profile?.full_name}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <DashboardWidget
          title="Today's Sales"
          value={data ? formatCurrency(data.sales_snapshot.today_revenue) : '-'}
          subtitle={`${data?.sales_snapshot.today_count || 0} invoices`}
          icon={TrendingUp}
          color="green"
          loading={loading}
          onClick={() => setCurrentPage('sales')}
        />

        <DashboardWidget
          title="Bank Balance"
          value={data ? formatCurrency(data.finance_snapshot.bank_balance) : '-'}
          subtitle="All accounts"
          icon={Wallet}
          color="blue"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Inventory Value"
          value={data ? formatCurrency(data.stock_snapshot.inventory_value) : '-'}
          subtitle={`${data?.stock_snapshot.total_products || 0} products`}
          icon={Package}
          color="purple"
          loading={loading}
          onClick={() => setCurrentPage('inventory')}
        />

        <DashboardWidget
          title="Pending Approvals"
          value={totalPendingApprovals}
          subtitle="Requires action"
          icon={CheckCircle2}
          color="yellow"
          loading={loading}
          onClick={() => setCurrentPage('approvals')}
        />

        <DashboardWidget
          title="Hot Leads"
          value={data?.crm_snapshot?.hot_leads || 0}
          subtitle="High priority"
          icon={TrendingUp}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('crm')}
        />

        <DashboardWidget
          title="Today's Appointments"
          value={data?.crm_snapshot?.todays_appointments || 0}
          subtitle="Follow-ups due"
          icon={Activity}
          color="emerald"
          loading={loading}
          onClick={() => setCurrentPage('crm')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold">Sales Performance</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-100">Today</span>
              <span className="text-sm font-bold">
                {data ? formatCurrency(data.sales_snapshot.today_revenue) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-100">This Month</span>
              <span className="text-sm font-bold">
                {data ? formatCurrency(data.sales_snapshot.month_revenue) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="text-xs text-blue-100">Pending Orders</span>
              <span className="text-sm font-bold">
                {data?.sales_snapshot.pending_orders || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold">Financial Position</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Receivables</span>
              <span className="text-sm font-bold">
                {data ? formatCurrency(data.finance_snapshot.receivables) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-100">Payables</span>
              <span className="text-sm font-bold">
                {data ? formatCurrency(data.finance_snapshot.payables) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="text-xs text-emerald-100">Overdue Invoices</span>
              <span className="text-sm font-bold">
                {data?.finance_snapshot.overdue_invoices || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold">Stock Status</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-orange-100">Low Stock Items</span>
              <span className="text-sm font-bold">
                {data?.stock_snapshot.low_stock || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-orange-100">Near Expiry</span>
              <span className="text-sm font-bold">
                {data?.stock_snapshot.near_expiry || 0}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="text-xs text-orange-100">Active Products</span>
              <span className="text-sm font-bold">
                {data?.stock_snapshot.total_products || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold">CRM Overview</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-100">Active Inquiries</span>
              <span className="text-sm font-bold">
                {data?.crm_snapshot?.active_inquiries || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-100">Upcoming Reminders</span>
              <span className="text-sm font-bold">
                {data?.crm_snapshot?.upcoming_reminders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
              <span className="text-xs text-red-100">Hot Leads</span>
              <span className="text-sm font-bold">
                {data?.crm_snapshot?.hot_leads || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TasksSummaryWidget />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-900">System Alerts</h3>
            </div>

            <div className="space-y-2">
              {data && data.alerts_summary.critical > 0 && (
                <div className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs font-medium text-red-900">Critical</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">
                    {data.alerts_summary.critical}
                  </span>
                </div>
              )}

              {data && data.alerts_summary.warning > 0 && (
                <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-xs font-medium text-orange-900">Warning</span>
                  </div>
                  <span className="text-sm font-bold text-orange-600">
                    {data.alerts_summary.warning}
                  </span>
                </div>
              )}

              {data && data.alerts_summary.info > 0 && (
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">Info</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">
                    {data.alerts_summary.info}
                  </span>
                </div>
              )}

              {data &&
                data.alerts_summary.critical === 0 &&
                data.alerts_summary.warning === 0 &&
                data.alerts_summary.info === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-gray-600">All Clear!</p>
                    <p className="text-xs text-gray-500 mt-0.5">No system alerts</p>
                  </div>
                )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">System Health</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Active Users</span>
                <span className="text-sm font-bold text-gray-900">
                  {data?.system_health.active_users || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Active Customers</span>
                <span className="text-sm font-bold text-gray-900">
                  {data?.system_health.active_customers || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Active Products</span>
                <span className="text-sm font-bold text-gray-900">
                  {data?.system_health.active_products || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
