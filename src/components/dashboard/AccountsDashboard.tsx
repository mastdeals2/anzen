import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { DashboardWidget } from './DashboardWidget';
import { TasksSummaryWidget } from './TasksSummaryWidget';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Clock,
  FileText,
} from 'lucide-react';

interface AccountsData {
  bank_balance: number;
  pending_receivables: number;
  pending_payables: number;
  unreconciled_transactions: number;
  overdue_invoices_count: number;
  overdue_invoices_amount: number;
  cash_position: number;
  staff_advances_pending: number;
  pending_approvals: number;
}

export function AccountsDashboard() {
  const { profile } = useAuth();
  const { setCurrentPage } = useNavigation();
  const [data, setData] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;

    try {
      const { data: result, error } = await supabase.rpc('get_accounts_dashboard_data', {
        p_user_id: profile.id,
      });

      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Error loading accounts dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Accounts Dashboard</h1>
        <p className="text-gray-600 mt-1">Financial overview and pending actions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardWidget
          title="Bank Balance"
          value={data ? formatCurrency(data.bank_balance) : '-'}
          icon={Wallet}
          color="blue"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Cash Position"
          value={data ? formatCurrency(data.cash_position) : '-'}
          subtitle="Cash + Petty Cash"
          icon={DollarSign}
          color="green"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Pending Receivables"
          value={data ? formatCurrency(data.pending_receivables) : '-'}
          icon={TrendingUp}
          color="emerald"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Pending Payables"
          value={data ? formatCurrency(data.pending_payables) : '-'}
          icon={TrendingDown}
          color="orange"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardWidget
          title="Overdue Invoices"
          value={data?.overdue_invoices_count || 0}
          subtitle={data ? formatCurrency(data.overdue_invoices_amount) : '-'}
          icon={AlertTriangle}
          color="red"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Unreconciled Transactions"
          value={data?.unreconciled_transactions || 0}
          subtitle="Bank reconciliation needed"
          icon={FileText}
          color="yellow"
          loading={loading}
          onClick={() => setCurrentPage('finance')}
        />

        <DashboardWidget
          title="Pending Approvals"
          value={data?.pending_approvals || 0}
          subtitle="Finance approvals"
          icon={CheckCircle}
          color="purple"
          loading={loading}
          onClick={() => setCurrentPage('approvals')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TasksSummaryWidget />
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Actions</h3>

          <div className="space-y-3">
            {data && data.unreconciled_transactions > 0 && (
              <button
                onClick={() => setCurrentPage('finance')}
                className="w-full p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition text-left border border-yellow-200"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-900">Reconcile Bank</p>
                    <p className="text-xs text-yellow-700">
                      {data.unreconciled_transactions} unmatched transactions
                    </p>
                  </div>
                </div>
              </button>
            )}

            {data && data.overdue_invoices_count > 0 && (
              <button
                onClick={() => setCurrentPage('finance')}
                className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-left border border-red-200"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">Follow Up Overdue</p>
                    <p className="text-xs text-red-700">
                      {data.overdue_invoices_count} invoices overdue
                    </p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => setCurrentPage('finance')}
              className="w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left border border-blue-200"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">View Receivables</p>
                  <p className="text-xs text-blue-700">Manage pending payments</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setCurrentPage('finance')}
              className="w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition text-left border border-green-200"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Journal Entries</p>
                  <p className="text-xs text-green-700">Review and post entries</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
