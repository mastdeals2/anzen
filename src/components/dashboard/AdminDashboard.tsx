import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  FileText,
  Users,
  TrendingUp,
  Calendar,
  Eye,
  EyeOff,
  Bell,
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

interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  category: string;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<AdminData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinancials, setShowFinancials] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
      loadTasks();
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

  const loadTasks = async () => {
    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('id, title, deadline, priority, category')
        .eq('is_completed', false)
        .lte('deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('deadline', { ascending: true })
        .limit(5);

      if (error) throw error;
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
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

  const totalUrgentItems = (data?.alerts_summary.critical || 0) +
                           (data?.finance_snapshot.overdue_invoices || 0);

  const totalWarnings = (data?.alerts_summary.warning || 0) +
                        (data?.stock_snapshot.near_expiry || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowFinancials(!showFinancials)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          {showFinancials ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              Hide Amounts
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              Show Amounts
            </>
          )}
        </button>
      </div>

      {/* ATTENTION REQUIRED */}
      <div className={`bg-white rounded-lg border-2 ${totalUrgentItems > 0 ? 'border-red-500' : 'border-gray-200'} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className={`w-5 h-5 ${totalUrgentItems > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Attention Required</h2>
          {totalUrgentItems > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
              {totalUrgentItems}
            </span>
          )}
        </div>

        {totalUrgentItems === 0 && totalPendingApprovals === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">All Clear</p>
            <p className="text-xs text-gray-500 mt-1">No urgent items require attention</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Critical Alerts */}
            {data && data.alerts_summary.critical > 0 && (
              <button
                onClick={() => setCurrentPage('inventory')}
                className="text-left p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-semibold text-red-900">Critical Alerts</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{data.alerts_summary.critical}</p>
                <p className="text-xs text-red-700 mt-1">Out of stock items</p>
              </button>
            )}

            {/* Overdue Invoices */}
            {data && data.finance_snapshot.overdue_invoices > 0 && (
              <button
                onClick={() => setCurrentPage('finance')}
                className="text-left p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-semibold text-red-900">Overdue</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{data.finance_snapshot.overdue_invoices}</p>
                <p className="text-xs text-red-700 mt-1">Unpaid invoices</p>
              </button>
            )}

            {/* Pending Approvals */}
            {totalPendingApprovals > 0 && (
              <button
                onClick={() => setCurrentPage('approvals')}
                className="text-left p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900">Pending Approval</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{totalPendingApprovals}</p>
                <p className="text-xs text-orange-700 mt-1">Awaiting your review</p>
              </button>
            )}

            {/* Low Stock Warning */}
            {data && data.stock_snapshot.low_stock > 0 && (
              <button
                onClick={() => setCurrentPage('inventory')}
                className="text-left p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900">Low Stock</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{data.stock_snapshot.low_stock}</p>
                <p className="text-xs text-orange-700 mt-1">Below minimum level</p>
              </button>
            )}

            {/* Near Expiry */}
            {data && data.stock_snapshot.near_expiry > 0 && (
              <button
                onClick={() => setCurrentPage('batches')}
                className="text-left p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900">Near Expiry</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{data.stock_snapshot.near_expiry}</p>
                <p className="text-xs text-orange-700 mt-1">Within 30 days</p>
              </button>
            )}

            {/* Hot Leads */}
            {data && data.crm_snapshot && data.crm_snapshot.hot_leads > 0 && (
              <button
                onClick={() => setCurrentPage('crm')}
                className="text-left p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">Hot Leads</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{data.crm_snapshot.hot_leads}</p>
                <p className="text-xs text-blue-700 mt-1">High priority inquiries</p>
              </button>
            )}

            {/* Today's Follow-ups */}
            {data && data.crm_snapshot && data.crm_snapshot.todays_appointments > 0 && (
              <button
                onClick={() => setCurrentPage('crm')}
                className="text-left p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">Today's Follow-ups</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{data.crm_snapshot.todays_appointments}</p>
                <p className="text-xs text-blue-700 mt-1">Scheduled appointments</p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* MY WORK TODAY */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">My Work Today</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tasks */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Upcoming Tasks</h3>
            {tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const isOverdue = new Date(task.deadline) < new Date();
                  return (
                    <button
                      key={task.id}
                      onClick={() => setCurrentPage('tasks')}
                      className="w-full text-left p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700' :
                              task.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {task.priority}
                            </span>
                            <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded border border-gray-200">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">No tasks scheduled</p>
              </div>
            )}
          </div>

          {/* Approvals Queue */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Approvals Queue</h3>
            <div className="space-y-2">
              {data && data.pending_approvals.sales_orders > 0 && (
                <button
                  onClick={() => setCurrentPage('approvals')}
                  className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs text-gray-700">Sales Orders</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.pending_approvals.sales_orders}</span>
                </button>
              )}

              {data && data.pending_approvals.delivery_challans > 0 && (
                <button
                  onClick={() => setCurrentPage('approvals')}
                  className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs text-gray-700">Delivery Challans</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.pending_approvals.delivery_challans}</span>
                </button>
              )}

              {data && data.pending_approvals.credit_notes > 0 && (
                <button
                  onClick={() => setCurrentPage('approvals')}
                  className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs text-gray-700">Credit Notes</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.pending_approvals.credit_notes}</span>
                </button>
              )}

              {totalPendingApprovals === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded border border-gray-200">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">No pending approvals</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM OVERVIEW */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-gray-500" />
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide">System Overview</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Sales Today */}
          <button onClick={() => setCurrentPage('sales')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Sales Today</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.sales_snapshot.today_revenue) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{data?.sales_snapshot.today_count || 0} invoices</p>
          </button>

          {/* Bank Balance */}
          <button onClick={() => setCurrentPage('finance')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Bank Balance</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.finance_snapshot.bank_balance) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-gray-500 mt-1">All accounts</p>
          </button>

          {/* Receivables */}
          <button onClick={() => setCurrentPage('finance')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Receivables</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.finance_snapshot.receivables) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Outstanding</p>
          </button>

          {/* Inventory Value */}
          <button onClick={() => setCurrentPage('inventory')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Inventory</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.stock_snapshot.inventory_value) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{data?.stock_snapshot.total_products || 0} products</p>
          </button>

          {/* Active Inquiries */}
          <button onClick={() => setCurrentPage('crm')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">CRM Pipeline</p>
            <p className="text-sm font-bold text-gray-900">{data?.crm_snapshot?.active_inquiries || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active inquiries</p>
          </button>

          {/* Active Users */}
          <button onClick={() => setCurrentPage('settings')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">System Health</p>
            <p className="text-sm font-bold text-gray-900">{data?.system_health.active_users || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active users</p>
          </button>
        </div>
      </div>
    </div>
  );
}
