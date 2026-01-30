import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  TrendingUp,
  Package,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

interface SalesData {
  sales_today: number;
  sales_today_count: number;
  pending_quotations: number;
  pending_delivery_challans: number;
  pending_sales_orders: number;
  unpaid_invoices_count: number;
  unpaid_invoices_amount: number;
  top_customers: Array<{
    company_name: string;
    revenue: number;
  }>;
  followups_due: number;
  pipeline_summary: Array<{
    status: string;
    count: number;
  }>;
  overdue_actions: number;
}

export function SalesDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinancials, setShowFinancials] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: result, error } = await supabase.rpc('get_sales_dashboard_data', {
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

      const [salesData, ordersData, invoicesData] = await Promise.all([
        supabase.from('sales_invoices').select('total_amount').gte('invoice_date', today),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
        supabase.from('sales_invoices').select('*', { count: 'exact', head: true }).in('payment_status', ['pending', 'partial']),
      ]);

      const salesTotal = salesData.data?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

      setData({
        sales_today: salesTotal,
        sales_today_count: salesData.data?.length || 0,
        pending_quotations: 0,
        pending_delivery_challans: 0,
        pending_sales_orders: ordersData.count || 0,
        unpaid_invoices_count: invoicesData.count || 0,
        unpaid_invoices_amount: 0,
        top_customers: [],
        followups_due: 0,
        pipeline_summary: [],
        overdue_actions: 0
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

  const totalUrgent = (data?.overdue_actions || 0) + (data?.pending_sales_orders || 0);
  const totalWork = (data?.followups_due || 0) + (data?.pending_delivery_challans || 0);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Dashboard</h1>
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
      <div className={`bg-white rounded-lg border-2 ${totalUrgent > 0 ? 'border-red-500' : 'border-gray-200'} p-5`}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className={`w-5 h-5 ${totalUrgent > 0 ? 'text-red-600' : 'text-gray-400'}`} />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Attention Required</h2>
          {totalUrgent > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
              {totalUrgent}
            </span>
          )}
        </div>

        {totalUrgent === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">All Clear</p>
            <p className="text-xs text-gray-500 mt-1">No urgent items require attention</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data && data.overdue_actions > 0 && (
              <button
                onClick={() => setCurrentPage('crm')}
                className="text-left p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-semibold text-red-900">Overdue Actions</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{data.overdue_actions}</p>
                <p className="text-xs text-red-700 mt-1">Past deadline</p>
              </button>
            )}

            {data && data.pending_sales_orders > 0 && (
              <button
                onClick={() => setCurrentPage('sales-orders')}
                className="text-left p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900">Pending Orders</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{data.pending_sales_orders}</p>
                <p className="text-xs text-orange-700 mt-1">Awaiting approval</p>
              </button>
            )}

            {data && data.unpaid_invoices_count > 0 && (
              <button
                onClick={() => setCurrentPage('sales')}
                className="text-left p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900">Unpaid Invoices</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{data.unpaid_invoices_count}</p>
                {showFinancials && (
                  <p className="text-xs text-orange-700 mt-1">{formatCurrency(data.unpaid_invoices_amount)}</p>
                )}
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
          {totalWork > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
              {totalWork}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Follow-ups Due */}
          {data && data.followups_due > 0 && (
            <button
              onClick={() => setCurrentPage('crm')}
              className="text-left p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-900">Customer Follow-ups</span>
                <span className="text-2xl font-bold text-blue-600">{data.followups_due}</span>
              </div>
              <p className="text-xs text-blue-700">Scheduled for today</p>
            </button>
          )}

          {/* Pending Delivery Challans */}
          {data && data.pending_delivery_challans > 0 && (
            <button
              onClick={() => setCurrentPage('delivery-challan')}
              className="text-left p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-900">Delivery Challans</span>
                <span className="text-2xl font-bold text-blue-600">{data.pending_delivery_challans}</span>
              </div>
              <p className="text-xs text-blue-700">Ready for processing</p>
            </button>
          )}

          {totalWork === 0 && (
            <div className="col-span-2 text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No pending work items</p>
            </div>
          )}
        </div>
      </div>

      {/* SYSTEM OVERVIEW */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Performance Overview</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Sales Today */}
          <button onClick={() => setCurrentPage('sales')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
            <p className="text-xs text-gray-500 mb-1">Sales Today</p>
            {showFinancials ? (
              <p className="text-sm font-bold text-gray-900">{data ? formatCurrency(data.sales_today) : '-'}</p>
            ) : (
              <p className="text-sm font-bold text-gray-400">• • • • •</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{data?.sales_today_count || 0} invoices</p>
          </button>

          {/* Top Customers */}
          {data && data.top_customers && data.top_customers.length > 0 && (
            <button onClick={() => setCurrentPage('customers')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
              <p className="text-xs text-gray-500 mb-1">Top Customer</p>
              <p className="text-sm font-bold text-gray-900 truncate">{data.top_customers[0].company_name}</p>
              {showFinancials && (
                <p className="text-xs text-gray-500 mt-1">{formatCurrency(data.top_customers[0].revenue)}</p>
              )}
            </button>
          )}

          {/* Pipeline Summary */}
          {data && data.pipeline_summary && data.pipeline_summary.length > 0 && (
            <button onClick={() => setCurrentPage('crm')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
              <p className="text-xs text-gray-500 mb-1">CRM Pipeline</p>
              <p className="text-sm font-bold text-gray-900">
                {data.pipeline_summary.reduce((sum, item) => sum + item.count, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Active inquiries</p>
            </button>
          )}

          {/* Quotations */}
          {data && (
            <button onClick={() => setCurrentPage('crm')} className="text-left p-3 bg-white rounded border border-gray-200 hover:shadow-sm transition">
              <p className="text-xs text-gray-500 mb-1">Quotations</p>
              <p className="text-sm font-bold text-gray-900">{data.pending_quotations || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
