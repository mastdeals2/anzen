import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { DashboardWidget } from './DashboardWidget';
import { TasksSummaryWidget } from './TasksSummaryWidget';
import {
  Package,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Truck,
  ClipboardCheck,
  XCircle,
} from 'lucide-react';

interface WarehouseData {
  low_stock_count: number;
  low_stock_items: Array<{
    product_code: string;
    product_name: string;
    current_stock: number;
    min_stock_level: number;
    shortage: number;
  }>;
  near_expiry_count: number;
  near_expiry_items: Array<{
    batch_number: string;
    product_name: string;
    current_stock: number;
    expiry_date: string;
    days_to_expiry: number;
  }>;
  pending_dispatch: number;
  incoming_stock: number;
  batch_alerts: number;
  inventory_value: number;
  pick_pack_tasks: number;
  stock_rejections: number;
}

export function WarehouseDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: result, error } = await supabase.rpc('get_warehouse_dashboard_data', {
        p_user_id: profile.id,
      });

      if (error) {
        console.warn('RPC failed, using fallback:', error);
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
      const [
        productsData,
        lowStockData,
        nearExpiryData,
        batchesData,
        dcData,
        soData
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true).gt('min_stock_level', 0).filter('current_stock', 'lt', 'min_stock_level'),
        supabase.from('batches').select('*', { count: 'exact', head: true }).eq('is_active', true).gt('current_stock', 0).gte('expiry_date', new Date().toISOString().split('T')[0]).lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        supabase.from('batches').select('current_stock, unit_price').eq('is_active', true).gt('current_stock', 0),
        supabase.from('delivery_challans').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_approval'),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval')
      ]);

      const inventoryValue = batchesData.data?.reduce((sum, b) => sum + ((b.current_stock || 0) * (b.unit_price || 0)), 0) || 0;

      setData({
        total_products: productsData.count || 0,
        low_stock_items: lowStockData.count || 0,
        near_expiry: nearExpiryData.count || 0,
        pending_dispatch: dcData.count || 0,
        incoming_stock: soData.count || 0,
        batch_alerts: nearExpiryData.count || 0,
        inventory_value: inventoryValue,
        pick_pack_tasks: 0,
        stock_rejections: 0
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Warehouse Dashboard</h1>
        <p className="text-gray-600 mt-1">Inventory overview and operational status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardWidget
          title="Low Stock Alerts"
          value={data?.low_stock_count || 0}
          subtitle="Below minimum level"
          icon={AlertTriangle}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('stock')}
        />

        <DashboardWidget
          title="Near Expiry"
          value={data?.near_expiry_count || 0}
          subtitle="Within 30 days"
          icon={Clock}
          color="orange"
          loading={loading}
          onClick={() => setCurrentPage('batches')}
        />

        <DashboardWidget
          title="Inventory Value"
          value={data ? formatCurrency(data.inventory_value) : '-'}
          subtitle="Total stock valuation"
          icon={Package}
          color="green"
          loading={loading}
          onClick={() => setCurrentPage('inventory')}
        />

        <DashboardWidget
          title="Pending Dispatch"
          value={data?.pending_dispatch || 0}
          subtitle="Approved DCs"
          icon={Truck}
          color="blue"
          loading={loading}
          onClick={() => setCurrentPage('delivery-challan')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardWidget
          title="Incoming Stock"
          value={data?.incoming_stock || 0}
          subtitle="Pending POs"
          icon={TrendingUp}
          color="purple"
          loading={loading}
          onClick={() => setCurrentPage('purchase-orders')}
        />

        <DashboardWidget
          title="Pick/Pack Tasks"
          value={data?.pick_pack_tasks || 0}
          subtitle="DCs to process"
          icon={ClipboardCheck}
          color="yellow"
          loading={loading}
          onClick={() => setCurrentPage('delivery-challan')}
        />

        <DashboardWidget
          title="Batch Alerts"
          value={data?.batch_alerts || 0}
          subtitle="Expired or zero stock"
          icon={AlertTriangle}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('batches')}
        />

        <DashboardWidget
          title="Stock Rejections"
          value={data?.stock_rejections || 0}
          subtitle="Last 7 days"
          icon={XCircle}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('stock-rejections')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow border border-red-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Low Stock Items</h3>
              </div>

              {data && data.low_stock_items && data.low_stock_items.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {data.low_stock_items.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Code: {item.product_code}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="text-red-600 font-semibold">
                              Stock: {item.current_stock}
                            </span>
                            <span className="text-gray-500">
                              Min: {item.min_stock_level}
                            </span>
                            <span className="text-orange-600">
                              Short: {item.shortage}
                            </span>
                          </div>
                        </div>
                        <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  All items are adequately stocked
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow border border-orange-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Near Expiry</h3>
              </div>

              {data && data.near_expiry_items && data.near_expiry_items.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {data.near_expiry_items.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Batch: {item.batch_number}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="text-gray-600">
                              Stock: {item.current_stock}
                            </span>
                            <span className="text-orange-600 font-semibold">
                              {item.days_to_expiry} days
                            </span>
                          </div>
                        </div>
                        <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No batches expiring soon
                </p>
              )}
            </div>
          </div>

          <TasksSummaryWidget />
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>

          <div className="space-y-3">
            {data && data.pending_dispatch > 0 && (
              <button
                onClick={() => setCurrentPage('delivery-challan')}
                className="w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left border border-blue-200"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Process Dispatch</p>
                    <p className="text-xs text-blue-700">
                      {data.pending_dispatch} DCs ready
                    </p>
                  </div>
                </div>
              </button>
            )}

            {data && data.low_stock_count > 0 && (
              <button
                onClick={() => setCurrentPage('stock')}
                className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-left border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">Review Low Stock</p>
                    <p className="text-xs text-red-700">
                      {data.low_stock_count} items need attention
                    </p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => setCurrentPage('stock')}
              className="w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition text-left border border-green-200"
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">View All Stock</p>
                  <p className="text-xs text-green-700">Stock levels and batches</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('batches')}
              className="w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-left border border-purple-200"
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900">Manage Batches</p>
                  <p className="text-xs text-purple-700">View batch details</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
