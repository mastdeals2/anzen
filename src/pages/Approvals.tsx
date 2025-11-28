import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Eye, FileText, Package } from 'lucide-react';
import { Modal } from '../components/Modal';

interface SalesOrder {
  id: string;
  so_number: string;
  customer_po_number: string;
  customer_po_date: string;
  so_date: string;
  expected_delivery_date?: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  created_by: string;
  customers?: {
    customer_name: string;
    customer_code: string;
  };
  user_profiles?: {
    full_name: string;
    email: string;
  };
  sales_order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    products?: {
      product_name: string;
      product_code: string;
    };
  }>;
}

interface DeliveryChallan {
  id: string;
  challan_number: string;
  customer_id: string;
  sales_order_id?: string;
  delivery_date: string;
  created_at: string;
  created_by: string;
  customers?: {
    customer_name: string;
    customer_code: string;
  };
  sales_orders?: {
    so_number: string;
  };
  user_profiles?: {
    full_name: string;
    email: string;
  };
  delivery_challan_items?: Array<{
    id: string;
    quantity: number;
    products?: {
      product_name: string;
      product_code: string;
    };
    batches?: {
      batch_number: string;
    };
  }>;
}

export default function Approvals() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'po' | 'dc'>('po');
  const [pendingSalesOrders, setPendingSalesOrders] = useState<SalesOrder[]>([]);
  const [pendingDeliveryChallans, setPendingDeliveryChallans] = useState<DeliveryChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'po') {
      fetchPendingSalesOrders();
    } else {
      fetchPendingDeliveryChallans();
    }
  }, [activeTab]);

  const fetchPendingSalesOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          customers (customer_name, customer_code),
          user_profiles!sales_orders_created_by_fkey (full_name, email),
          sales_order_items (
            id,
            quantity,
            unit_price,
            line_total,
            products (product_name, product_code)
          )
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingSalesOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching pending sales orders:', error.message);
      alert('Failed to load pending sales orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingDeliveryChallans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_challans')
        .select(`
          *,
          customers (customer_name, customer_code),
          sales_orders (so_number),
          user_profiles!delivery_challans_created_by_fkey (full_name, email),
          delivery_challan_items (
            id,
            quantity,
            products (product_name, product_code),
            batches (batch_number)
          )
        `)
        .eq('approval_status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingDeliveryChallans(data || []);
    } catch (error: any) {
      console.error('Error fetching pending delivery challans:', error.message);
      alert('Failed to load pending delivery challans');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSO = async (soId: string) => {
    const remarks = prompt('Enter approval remarks (optional):');
    if (remarks === null) return;

    try {
      setActionLoading(true);
      const { data, error } = await supabase.rpc('fn_approve_sales_order_with_import', {
        p_so_id: soId,
        p_approver_id: user?.id,
        p_remarks: remarks || null
      });

      if (error) throw error;

      const result = data[0];
      if (result.success) {
        alert('Sales order approved and stock reserved successfully!');
      } else {
        alert(`Sales order approved but stock shortage detected:\n${result.message}\n\nImport requirements have been created automatically.`);
      }

      fetchPendingSalesOrders();
    } catch (error: any) {
      console.error('Error approving sales order:', error.message);
      alert('Failed to approve sales order: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSO = async (soId: string) => {
    const reason = prompt('Enter rejection reason (required):');
    if (!reason || !reason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase.rpc('fn_reject_sales_order', {
        p_so_id: soId,
        p_rejector_id: user?.id,
        p_reason: reason
      });

      if (error) throw error;

      alert('Sales order rejected successfully!');
      fetchPendingSalesOrders();
    } catch (error: any) {
      console.error('Error rejecting sales order:', error.message);
      alert('Failed to reject sales order: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDC = async (dcId: string) => {
    const remarks = prompt('Enter approval remarks (optional):');
    if (remarks === null) return;

    try {
      setActionLoading(true);
      const { error } = await supabase.rpc('fn_approve_delivery_challan', {
        p_dc_id: dcId,
        p_approver_id: user?.id,
        p_remarks: remarks || null
      });

      if (error) throw error;

      alert('Delivery challan approved successfully!');
      fetchPendingDeliveryChallans();
    } catch (error: any) {
      console.error('Error approving delivery challan:', error.message);
      alert('Failed to approve delivery challan: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDC = async (dcId: string) => {
    const reason = prompt('Enter rejection reason (required):');
    if (!reason || !reason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      setActionLoading(true);
      const { error } = await supabase.rpc('fn_reject_delivery_challan', {
        p_dc_id: dcId,
        p_rejector_id: user?.id,
        p_reason: reason
      });

      if (error) throw error;

      alert('Delivery challan rejected successfully!');
      fetchPendingDeliveryChallans();
    } catch (error: any) {
      console.error('Error rejecting delivery challan:', error.message);
      alert('Failed to reject delivery challan: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Approval Center</h1>
        <p className="text-gray-600 mt-1">Review and approve pending sales orders and delivery challans</p>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('po')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'po'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                PO Approvals
                {pendingSalesOrders.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                    {pendingSalesOrders.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('dc')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'dc'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                DC Approvals
                {pendingDeliveryChallans.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                    {pendingDeliveryChallans.length}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'po' ? (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
              ) : pendingSalesOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No pending sales orders for approval
                </div>
              ) : (
                pendingSalesOrders.map((so) => (
                  <div key={so.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{so.so_number}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Pending Approval
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Customer:</span>
                            <span className="ml-2 font-medium">{so.customers?.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">PO Number:</span>
                            <span className="ml-2 font-medium">{so.customer_po_number}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">SO Date:</span>
                            <span className="ml-2">{new Date(so.so_date).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total Amount:</span>
                            <span className="ml-2 font-medium text-green-600">${so.total_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Created By:</span>
                            <span className="ml-2">{so.user_profiles?.full_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Created At:</span>
                            <span className="ml-2">{new Date(so.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {so.notes && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">Notes:</span>
                            <p className="mt-1 text-gray-900">{so.notes}</p>
                          </div>
                        )}

                        <div className="mt-3">
                          <details className="text-sm">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              View Items ({so.sales_order_items?.length || 0})
                            </summary>
                            <div className="mt-2 bg-gray-50 p-3 rounded">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Product</th>
                                    <th className="text-right py-2">Quantity</th>
                                    <th className="text-right py-2">Unit Price</th>
                                    <th className="text-right py-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {so.sales_order_items?.map((item) => (
                                    <tr key={item.id} className="border-b">
                                      <td className="py-2">{item.products?.product_name}</td>
                                      <td className="text-right">{item.quantity}</td>
                                      <td className="text-right">${item.unit_price.toFixed(2)}</td>
                                      <td className="text-right">${item.line_total.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleApproveSO(so.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectSO(so.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
              ) : pendingDeliveryChallans.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No pending delivery challans for approval
                </div>
              ) : (
                pendingDeliveryChallans.map((dc) => (
                  <div key={dc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{dc.challan_number}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Pending Approval
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Customer:</span>
                            <span className="ml-2 font-medium">{dc.customers?.customer_name}</span>
                          </div>
                          {dc.sales_orders && (
                            <div>
                              <span className="text-gray-600">Sales Order:</span>
                              <span className="ml-2 font-medium">{dc.sales_orders.so_number}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Delivery Date:</span>
                            <span className="ml-2">{new Date(dc.delivery_date).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Created By:</span>
                            <span className="ml-2">{dc.user_profiles?.full_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Created At:</span>
                            <span className="ml-2">{new Date(dc.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <details className="text-sm">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              View Items ({dc.delivery_challan_items?.length || 0})
                            </summary>
                            <div className="mt-2 bg-gray-50 p-3 rounded">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2">Product</th>
                                    <th className="text-left py-2">Batch</th>
                                    <th className="text-right py-2">Quantity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dc.delivery_challan_items?.map((item) => (
                                    <tr key={item.id} className="border-b">
                                      <td className="py-2">{item.products?.product_name}</td>
                                      <td className="py-2">{item.batches?.batch_number}</td>
                                      <td className="text-right">{item.quantity}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleApproveDC(dc.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectDC(dc.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
