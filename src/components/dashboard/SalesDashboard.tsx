import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { DashboardWidget } from './DashboardWidget';
import { TasksSummaryWidget } from './TasksSummaryWidget';
import {
  TrendingUp,
  FileText,
  Truck,
  AlertCircle,
  Users,
  ClipboardList,
  Calendar,
  DollarSign,
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

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;

    try {
      const { data: result, error } = await supabase.rpc('get_sales_dashboard_data', {
        p_user_id: profile.id,
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Error loading sales dashboard:', error);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
        <p className="text-gray-600 mt-1">Sales performance and pipeline overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardWidget
          title="Sales Today"
          value={data ? formatCurrency(data.sales_today) : '-'}
          subtitle={`${data?.sales_today_count || 0} invoices`}
          icon={DollarSign}
          color="green"
          loading={loading}
          onClick={() => setCurrentPage('sales')}
        />

        <DashboardWidget
          title="Pending Sales Orders"
          value={data?.pending_sales_orders || 0}
          subtitle="Awaiting approval"
          icon={ClipboardList}
          color="yellow"
          loading={loading}
          onClick={() => setCurrentPage('sales-orders')}
        />

        <DashboardWidget
          title="Pending Quotations"
          value={data?.pending_quotations || 0}
          subtitle="Awaiting customer response"
          icon={FileText}
          color="blue"
          loading={loading}
          onClick={() => setCurrentPage('crm')}
        />

        <DashboardWidget
          title="Pending DCs"
          value={data?.pending_delivery_challans || 0}
          subtitle="Awaiting approval"
          icon={Truck}
          color="purple"
          loading={loading}
          onClick={() => setCurrentPage('delivery-challan')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardWidget
          title="Unpaid Invoices"
          value={data?.unpaid_invoices_count || 0}
          subtitle={data ? formatCurrency(data.unpaid_invoices_amount) : '-'}
          icon={AlertCircle}
          color="orange"
          loading={loading}
          onClick={() => setCurrentPage('sales')}
        />

        <DashboardWidget
          title="Follow-ups Due"
          value={data?.followups_due || 0}
          subtitle="Today and overdue"
          icon={Calendar}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('crm')}
        />

        <DashboardWidget
          title="Overdue Actions"
          value={data?.overdue_actions || 0}
          subtitle="Customer actions needed"
          icon={AlertCircle}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('crm')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TasksSummaryWidget />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
            </div>

            {data && data.top_customers && data.top_customers.length > 0 ? (
              <div className="space-y-3">
                {data.top_customers.map((customer, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {customer.company_name}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-blue-600 ml-2">
                      {formatCurrency(customer.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No sales this month yet
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>

            <div className="space-y-3">
              <button
                onClick={() => setCurrentPage('crm')}
                className="w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left border border-blue-200"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">New Inquiry</p>
                    <p className="text-xs text-blue-700">Create customer inquiry</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentPage('sales-orders')}
                className="w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition text-left border border-green-200"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">New Sales Order</p>
                    <p className="text-xs text-green-700">Create purchase order</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentPage('sales')}
                className="w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-left border border-purple-200"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">View All Invoices</p>
                    <p className="text-xs text-purple-700">Sales invoice list</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCurrentPage('crm')}
                className="w-full p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition text-left border border-orange-200"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">CRM Pipeline</p>
                    <p className="text-xs text-orange-700">Manage opportunities</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
