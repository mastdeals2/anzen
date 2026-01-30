import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { AccountsDashboard } from '../components/dashboard/AccountsDashboard';
import { SalesDashboard } from '../components/dashboard/SalesDashboard';
import { WarehouseDashboard } from '../components/dashboard/WarehouseDashboard';

export function Dashboard() {
  const { profile } = useAuth();

  const renderDashboardByRole = () => {
    if (!profile) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (profile.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'accounts':
        return <AccountsDashboard />;
      case 'sales':
        return <SalesDashboard />;
      case 'warehouse':
        return <WarehouseDashboard />;
      case 'manager':
        return <AdminDashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return <Layout>{renderDashboardByRole()}</Layout>;
}
