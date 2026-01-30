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
  task_type: string;
}

interface Reminder {
  id: string;
  title: string;
  due_date: string;
  reminder_type: string;
  inquiry_id?: string;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<AdminData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFinancials, setShowFinancials] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
      loadTasksAndReminders();
    }
  }, [profile?.id]);

  const loadTasksAndReminders = async () => {
    try {
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [tasksRes, remindersRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, deadline, priority, task_type')
          .not('status', 'eq', 'completed')
          .lte('deadline', weekFromNow)
          .order('deadline', { ascending: true })
          .limit(5),
        supabase
          .from('crm_reminders')
          .select('id, title, due_date, reminder_type, inquiry_id')
          .eq('is_completed', false)
          .lte('due_date', weekFromNow)
          .order('due_date', { ascending: true })
          .limit(5)
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (remindersRes.data) setReminders(remindersRes.data);
    } catch (error) {
      console.error('Error loading tasks/reminders:', error);
    }
  };

  const loadDashboardData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: result, error } = await supabase.rpc('get_admin_dashboard_data', {
        p_user_id: profile.id,
      });

      if (error) {
        console.warn('RPC call failed, using fallback:', error);
        await loadManualData();
        return;
      }

      setData(result);
    } catch (error) {
      console.error('Dashboard error, using fallback:', error);
      await loadManualData();
    } finally {
      setLoading(false);
    }
  };

  const loadManualData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        salesTodayData,
        salesMonthData,
        pendingOrdersData,
        banksData,
        receivablesData,
        overdueData,
        productsData,
        batchesData,
        dcApprovalsData,
        creditNotesData,
        materialReturnsData,
        usersData,
        customersData,
        inquiriesData,
        remindersData,
        todayRemindersData
      ] = await Promise.all([
        supabase.from('sales_invoices').select('total_amount').eq('invoice_date', today),
        supabase.from('sales_invoices').select('total_amount').gte('invoice_date', firstDayOfMonth),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('bank_accounts').select('current_balance').eq('is_active', true),
        supabase.from('sales_invoices').select('total_amount').in('payment_status', ['pending', 'partial']),
        supabase.from('sales_invoices').select('*', { count: 'exact', head: true }).in('payment_status', ['pending', 'partial']).lt('due_date', today),
        supabase.from('products').select('id, current_stock').eq('is_active', true),
        supabase.from('batches').select('current_stock, cost_per_unit, expiry_date').eq('is_active', true).gt('current_stock', 0),
        supabase.from('delivery_challans').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_approval'),
        supabase.from('credit_notes').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_approval'),
        supabase.from('material_returns').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_approval'),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('crm_inquiries').select('*', { count: 'exact', head: true }).not('status', 'in', '(closed,lost,converted)'),
        supabase.from('crm_reminders').select('*', { count: 'exact', head: true }).eq('is_completed', false).gte('due_date', today).lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('crm_reminders').select('*', { count: 'exact', head: true }).eq('is_completed', false).gte('due_date', today).lt('due_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      ]);

      const salesTodayTotal = salesTodayData.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
      const salesMonthTotal = salesMonthData.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
      const bankTotal = banksData.data?.reduce((sum, b) => sum + (b.current_balance || 0), 0) || 0;
      const receivablesTotal = receivablesData.data?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;

      const inventoryValue = batchesData.data?.reduce((sum, b) => sum + ((b.current_stock || 0) * (b.cost_per_unit || 0)), 0) || 0;
      const nearExpiry = batchesData.data?.filter(b => {
        const expiryDate = new Date(b.expiry_date);
        const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return expiryDate <= thirtyDays;
      }).length || 0;

      const outOfStock = productsData.data?.filter(p => (p.current_stock || 0) <= 0).length || 0;
      const lowStock = productsData.data?.filter(p => (p.current_stock || 0) > 0 && (p.current_stock || 0) < 10).length || 0;

      setData({
        sales_snapshot: {
          today_revenue: salesTodayTotal,
          today_count: salesTodayData.data?.length || 0,
          month_revenue: salesMonthTotal,
          pending_orders: pendingOrdersData.count || 0
        },
        finance_snapshot: {
          bank_balance: bankTotal,
          receivables: receivablesTotal,
          payables: 0,
          overdue_invoices: overdueData.count || 0
        },
        stock_snapshot: {
          total_products: productsData.count || 0,
          low_stock: lowStock,
          near_expiry: nearExpiry,
          inventory_value: inventoryValue
        },
        alerts_summary: {
          critical: outOfStock,
          warning: lowStock,
          info: remindersData.count || 0
        },
        pending_approvals: {
          sales_orders: pendingOrdersData.count || 0,
          delivery_challans: dcApprovalsData.count || 0,
          credit_notes: creditNotesData.count || 0,
          material_returns: materialReturnsData.count || 0
        },
        system_health: {
          active_users: usersData.count || 0,
          active_customers: customersData.count || 0,
          active_products: productsData.count || 0,
          unread_notifications: 0
        },
        crm_snapshot: {
          active_inquiries: inquiriesData.count || 0,
          hot_leads: 0,
          upcoming_reminders: remindersData.count || 0,
          todays_appointments: todayRemindersData.count || 0
        }
      });
    } catch (err) {
      console.error('Manual load failed:', err);
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

      {/* ATTENTION - Compact Version */}
      {(totalUrgentItems > 0 || totalPendingApprovals > 0) && (
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-600" />
              <h2 className="text-xs font-bold text-gray-900 uppercase">Attention</h2>
            </div>
            {totalUrgentItems > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
                {totalUrgentItems}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {data && data.alerts_summary.critical > 0 && (
              <button
                onClick={() => setCurrentPage('inventory')}
                className="text-left p-2 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition"
              >
                <p className="text-lg font-bold text-red-600">{data.alerts_summary.critical}</p>
                <p className="text-xs text-red-700">Out of stock</p>
              </button>
            )}

            {data && data.finance_snapshot.overdue_invoices > 0 && (
              <button
                onClick={() => setCurrentPage('finance')}
                className="text-left p-2 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition"
              >
                <p className="text-lg font-bold text-red-600">{data.finance_snapshot.overdue_invoices}</p>
                <p className="text-xs text-red-700">Overdue</p>
              </button>
            )}

            {totalPendingApprovals > 0 && (
              <button
                onClick={() => setCurrentPage('approvals')}
                className="text-left p-2 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition"
              >
                <p className="text-lg font-bold text-orange-600">{totalPendingApprovals}</p>
                <p className="text-xs text-orange-700">Approvals</p>
              </button>
            )}

            {data && data.stock_snapshot.low_stock > 0 && (
              <button
                onClick={() => setCurrentPage('inventory')}
                className="text-left p-2 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition"
              >
                <p className="text-lg font-bold text-orange-600">{data.stock_snapshot.low_stock}</p>
                <p className="text-xs text-orange-700">Low stock</p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MY WORK TODAY */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">My Work Today</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                <p className="text-xs text-gray-600">You're clear today</p>
                <p className="text-xs text-gray-400 mt-1">Consider reviewing pipeline</p>
              </div>
            )}
          </div>

          {/* Reminders & Appointments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Follow-ups & Reminders</h3>
            {reminders.length > 0 ? (
              <div className="space-y-2">
                {reminders.map((reminder) => {
                  const isToday = new Date(reminder.due_date).toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={reminder.id}
                      onClick={() => setCurrentPage('crm')}
                      className="w-full text-left p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{reminder.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isToday ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {reminder.reminder_type}
                            </span>
                            <span className={`text-xs ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                              {new Date(reminder.due_date).toLocaleDateString()}
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
                <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-600">No appointments</p>
                <p className="text-xs text-gray-400 mt-1">Schedule follow-ups</p>
              </div>
            )}
          </div>

          {/* Approvals Queue */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Pending Approvals</h3>
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

              {data && data.pending_approvals.material_returns > 0 && (
                <button
                  onClick={() => setCurrentPage('approvals')}
                  className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs text-gray-700">Material Returns</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{data.pending_approvals.material_returns}</span>
                </button>
              )}

              {totalPendingApprovals === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded border border-gray-200">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">All approved</p>
                  <p className="text-xs text-gray-400 mt-1">No pending reviews</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS - Show when dashboard is calm */}
      {totalUrgentItems === 0 && totalPendingApprovals === 0 && tasks.length === 0 && reminders.length === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Quick Actions</h2>
            <span className="ml-auto text-xs text-gray-500">All clear - stay productive</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <button
              onClick={() => setCurrentPage('crm')}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition text-left"
            >
              <Users className="w-4 h-4 text-blue-600 mb-1" />
              <p className="text-xs font-medium text-gray-900">New Inquiry</p>
            </button>
            <button
              onClick={() => setCurrentPage('tasks')}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition text-left"
            >
              <CheckCircle2 className="w-4 h-4 text-green-600 mb-1" />
              <p className="text-xs font-medium text-gray-900">Add Task</p>
            </button>
            <button
              onClick={() => setCurrentPage('finance')}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition text-left"
            >
              <FileText className="w-4 h-4 text-orange-600 mb-1" />
              <p className="text-xs font-medium text-gray-900">Record Expense</p>
            </button>
            <button
              onClick={() => setCurrentPage('sales')}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition text-left"
            >
              <FileText className="w-4 h-4 text-gray-600 mb-1" />
              <p className="text-xs font-medium text-gray-900">Create Invoice</p>
            </button>
            <button
              onClick={() => setCurrentPage('crm')}
              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition text-left"
            >
              <TrendingUp className="w-4 h-4 text-gray-600 mb-1" />
              <p className="text-xs font-medium text-gray-900">View Pipeline</p>
            </button>
          </div>
        </div>
      )}

      {/* SYSTEM INSIGHTS */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-gray-500" />
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide">System Insights</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Sales Today */}
          <button onClick={() => setCurrentPage('sales')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Sales Today</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.sales_snapshot.today_revenue) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-green-600 mt-1">
              {data?.sales_snapshot.today_count || 0 > 0 ? `${data?.sales_snapshot.today_count} invoices` : 'No sales yet'}
            </p>
          </button>

          {/* Bank Balance */}
          <button onClick={() => setCurrentPage('finance')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Bank Balance</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.finance_snapshot.bank_balance) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-blue-600 mt-1">
              {data && data.finance_snapshot.bank_balance > 0 ? 'Healthy' : 'Check balance'}
            </p>
          </button>

          {/* Receivables */}
          <button onClick={() => setCurrentPage('finance')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Receivables</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.finance_snapshot.receivables) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-orange-600 mt-1">
              {data && data.finance_snapshot.receivables > 0 ? 'Track collection' : 'All clear'}
            </p>
          </button>

          {/* Inventory */}
          <button onClick={() => setCurrentPage('inventory')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Inventory</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.stock_snapshot.inventory_value) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-green-600 mt-1">
              {data && data.stock_snapshot.low_stock === 0 ? 'Stock stable' : `${data?.stock_snapshot.low_stock} low`}
            </p>
          </button>

          {/* CRM Pipeline */}
          <button onClick={() => setCurrentPage('crm')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">CRM Pipeline</p>
            <p className="text-sm font-bold text-gray-900">{data?.crm_snapshot?.active_inquiries || 0}</p>
            <p className="text-xs text-blue-600 mt-1">
              {data && data.crm_snapshot && data.crm_snapshot.active_inquiries > 0 ? `Active inquiries` : 'Pipeline quiet'}
            </p>
          </button>

          {/* System Health */}
          <button onClick={() => setCurrentPage('settings')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">System</p>
            <p className="text-sm font-bold text-gray-900">{data?.system_health.active_users || 0} users</p>
            <p className="text-xs text-green-600 mt-1">Running normally</p>
          </button>
        </div>
      </div>
    </div>
  );
}
