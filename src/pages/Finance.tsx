import { useState } from 'react';
import { Layout } from '../components/Layout';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  DollarSign,
  Building2,
  Receipt,
  CreditCard,
  FileText,
  TrendingUp,
  Users,
  BookOpen,
  PiggyBank,
  Send,
  HandCoins,
  BarChart3,
  Calendar,
  Scale,
  UserCircle
} from 'lucide-react';
import { ChartOfAccountsManager } from '../components/finance/ChartOfAccountsManager';
import { BankAccountsManager } from '../components/finance/BankAccountsManager';
import { ReceivablesManager } from '../components/finance/ReceivablesManager';
import { PayablesManager } from '../components/finance/PayablesManager';
import { ExpenseManager } from '../components/finance/ExpenseManager';
import { PettyCashManager } from '../components/finance/PettyCashManager';
import { PaymentVoucherManager } from '../components/finance/PaymentVoucherManager';
import { ReceiptVoucherManager } from '../components/finance/ReceiptVoucherManager';
import { JournalEntryViewerEnhanced } from '../components/finance/JournalEntryViewerEnhanced';
import { BankReconciliationEnhanced } from '../components/finance/BankReconciliationEnhanced';
import { FinancialReports } from '../components/finance/FinancialReports';
import { TaxReports } from '../components/finance/TaxReports';
import { CAReports } from '../components/finance/CAReports';
import { AccountLedger } from '../components/finance/AccountLedger';
import PartyLedger from '../components/finance/PartyLedger';
import BankLedger from '../components/finance/BankLedger';
import OutstandingSummary from '../components/finance/OutstandingSummary';
import { FundTransferManager } from '../components/finance/FundTransferManager';
import { PurchaseInvoiceManager } from '../components/finance/PurchaseInvoiceManager';
import { SuppliersManager } from '../components/finance/SuppliersManager';
import { StaffLoansManager } from '../components/finance/StaffLoansManager';

type FinanceTab =
  | 'coa'
  | 'banks'
  | 'receivables'
  | 'payables'
  | 'suppliers'
  | 'purchase-invoices'
  | 'expenses'
  | 'petty-cash'
  | 'payment-vouchers'
  | 'receipt-vouchers'
  | 'fund-transfer'
  | 'staff-loans'
  | 'journal'
  | 'reconciliation'
  | 'account-ledger'
  | 'party-ledger'
  | 'bank-ledger'
  | 'outstanding'
  | 'reports'
  | 'tax-reports'
  | 'ca-reports';

export function Finance() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceTab>('coa');

  if (profile?.role !== 'admin' && profile?.role !== 'accounts') {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Access denied. Only administrators and accounts staff can access the Finance module.
          </div>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'coa' as const, label: 'Chart of Accounts', icon: BookOpen },
    { id: 'banks' as const, label: 'Bank Accounts', icon: Building2 },
    { id: 'receivables' as const, label: 'Receivables', icon: TrendingUp },
    { id: 'payables' as const, label: 'Payables', icon: CreditCard },
    { id: 'suppliers' as const, label: 'Suppliers', icon: Users },
    { id: 'purchase-invoices' as const, label: 'Purchase Invoices', icon: FileText },
    { id: 'expenses' as const, label: 'Expenses', icon: Receipt },
    { id: 'petty-cash' as const, label: 'Petty Cash', icon: PiggyBank },
    { id: 'payment-vouchers' as const, label: 'Payment Vouchers', icon: Send },
    { id: 'receipt-vouchers' as const, label: 'Receipt Vouchers', icon: HandCoins },
    { id: 'fund-transfer' as const, label: 'Fund Transfer', icon: DollarSign },
    { id: 'staff-loans' as const, label: 'Staff Loans', icon: UserCircle },
    { id: 'journal' as const, label: 'Journal Entries', icon: FileText },
    { id: 'reconciliation' as const, label: 'Bank Reconciliation', icon: Scale },
    { id: 'account-ledger' as const, label: 'Account Ledger', icon: BookOpen },
    { id: 'party-ledger' as const, label: 'Party Ledger', icon: Users },
    { id: 'bank-ledger' as const, label: 'Bank Ledger', icon: Building2 },
    { id: 'outstanding' as const, label: 'Outstanding Summary', icon: Calendar },
    { id: 'reports' as const, label: 'Financial Reports', icon: BarChart3 },
    { id: 'tax-reports' as const, label: 'Tax Reports', icon: FileText },
    { id: 'ca-reports' as const, label: 'CA Reports', icon: FileText },
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-600" />
            Finance & Accounting
          </h1>
          <p className="text-gray-500 mt-1">Comprehensive financial management system</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'coa' && <ChartOfAccountsManager />}
            {activeTab === 'banks' && <BankAccountsManager />}
            {activeTab === 'receivables' && <ReceivablesManager />}
            {activeTab === 'payables' && <PayablesManager />}
            {activeTab === 'suppliers' && <SuppliersManager />}
            {activeTab === 'purchase-invoices' && <PurchaseInvoiceManager />}
            {activeTab === 'expenses' && <ExpenseManager />}
            {activeTab === 'petty-cash' && <PettyCashManager />}
            {activeTab === 'payment-vouchers' && <PaymentVoucherManager />}
            {activeTab === 'receipt-vouchers' && <ReceiptVoucherManager />}
            {activeTab === 'fund-transfer' && <FundTransferManager />}
            {activeTab === 'staff-loans' && <StaffLoansManager />}
            {activeTab === 'journal' && <JournalEntryViewerEnhanced />}
            {activeTab === 'reconciliation' && <BankReconciliationEnhanced />}
            {activeTab === 'account-ledger' && <AccountLedger />}
            {activeTab === 'party-ledger' && <PartyLedger />}
            {activeTab === 'bank-ledger' && <BankLedger />}
            {activeTab === 'outstanding' && <OutstandingSummary />}
            {activeTab === 'reports' && <FinancialReports />}
            {activeTab === 'tax-reports' && <TaxReports />}
            {activeTab === 'ca-reports' && <CAReports />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
