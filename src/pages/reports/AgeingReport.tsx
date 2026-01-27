import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FileDown, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance: number;
  days_overdue: number;
}

interface CustomerAgeing {
  customer_id: string;
  customer_name: string;
  total_outstanding: number;
  invoice_count: number;
  oldest_overdue_days: number;
  invoices: InvoiceDetail[];
}

export function AgeingReport() {
  const { t } = useLanguage();
  const [ageingData, setAgeingData] = useState<CustomerAgeing[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAgeingData();
  }, [asOfDate]);

  const loadAgeingData = async () => {
    try {
      setLoading(true);

      const { data: invoices, error } = await supabase
        .from('sales_invoices')
        .select('*, customers(company_name)')
        .in('payment_status', ['pending', 'partial'])
        .order('due_date');

      if (error) throw error;

      const invoicesWithBalances = await Promise.all(
        (invoices || []).map(async (inv) => {
          const { data: paidData } = await supabase
            .rpc('get_invoice_paid_amount', { p_invoice_id: inv.id });

          const paidAmount = paidData || 0;
          const balance = inv.total_amount - paidAmount;

          const dueDate = new Date(inv.due_date);
          const today = new Date(asOfDate);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: inv.id,
            customer_id: inv.customer_id,
            customer_name: inv.customers?.company_name || 'Unknown',
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            total_amount: inv.total_amount,
            paid_amount: paidAmount,
            balance,
            days_overdue: daysOverdue
          };
        })
      );

      const customerMap = new Map<string, CustomerAgeing>();

      invoicesWithBalances.forEach(inv => {
        const customerId = inv.customer_id;

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            customer_name: inv.customer_name,
            total_outstanding: 0,
            invoice_count: 0,
            oldest_overdue_days: -999,
            invoices: []
          });
        }

        const data = customerMap.get(customerId)!;
        data.total_outstanding += inv.balance;
        data.invoice_count += 1;
        data.oldest_overdue_days = Math.max(data.oldest_overdue_days, inv.days_overdue);
        data.invoices.push(inv);
      });

      const sortedData = Array.from(customerMap.values()).sort((a, b) => {
        if (a.oldest_overdue_days !== b.oldest_overdue_days) {
          return b.oldest_overdue_days - a.oldest_overdue_days;
        }
        return b.total_outstanding - a.total_outstanding;
      });

      setAgeingData(sortedData);
    } catch (error) {
      console.error('Error loading ageing data:', error);
      alert('Failed to load ageing report');
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomer = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const exportToCSV = () => {
    const rows: string[][] = [];
    rows.push(['Customer', 'Total Outstanding', 'Invoices', 'Oldest Overdue (Days)', 'Status']);

    ageingData.forEach(customer => {
      rows.push([
        customer.customer_name,
        customer.total_outstanding.toString(),
        customer.invoice_count.toString(),
        customer.oldest_overdue_days.toString(),
        customer.oldest_overdue_days > 90 ? 'CRITICAL' : customer.oldest_overdue_days > 0 ? 'OVERDUE' : 'CURRENT'
      ]);

      rows.push(['', 'Invoice #', 'Invoice Date', 'Due Date', 'Amount', 'Paid', 'Balance', 'Days Overdue']);
      customer.invoices.forEach(inv => {
        rows.push([
          '',
          inv.invoice_number,
          inv.invoice_date,
          inv.due_date,
          inv.total_amount.toString(),
          inv.paid_amount.toString(),
          inv.balance.toString(),
          inv.days_overdue.toString()
        ]);
      });
      rows.push(['']);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ageing_report_${asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDaysOverdueColor = (days: number) => {
    if (days < 0) return 'text-green-600';
    if (days === 0) return 'text-gray-600';
    if (days <= 30) return 'text-yellow-600';
    if (days <= 60) return 'text-orange-600';
    if (days <= 90) return 'text-red-600';
    return 'text-red-900 font-bold';
  };

  const getDaysOverdueBadge = (days: number) => {
    if (days < 0) return { text: t('not_due', 'Not Due'), color: 'bg-green-100 text-green-800' };
    if (days === 0) return { text: t('due_today', 'Due Today'), color: 'bg-gray-100 text-gray-800' };
    if (days <= 30) return { text: `${days}d ${t('overdue', 'Overdue')}`, color: 'bg-yellow-100 text-yellow-800' };
    if (days <= 60) return { text: `${days}d ${t('overdue', 'Overdue')}`, color: 'bg-orange-100 text-orange-800' };
    if (days <= 90) return { text: `${days}d ${t('overdue', 'Overdue')}`, color: 'bg-red-100 text-red-800' };
    return { text: `${days}d ${t('critical', 'CRITICAL')}`, color: 'bg-red-200 text-red-900 font-bold' };
  };

  const totalOutstanding = ageingData.reduce((sum, c) => sum + c.total_outstanding, 0);
  const totalInvoices = ageingData.reduce((sum, c) => sum + c.invoice_count, 0);
  const criticalCustomers = ageingData.filter(c => c.oldest_overdue_days > 90).length;

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-2">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-gray-700">{t('as_of_date', 'As of Date')}:</div>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={exportToCSV}
          disabled={ageingData.length === 0}
          className="flex items-center gap-1.5 bg-green-600 text-white px-2.5 py-1.5 rounded text-xs hover:bg-green-700 transition disabled:opacity-50"
        >
          <FileDown className="w-3.5 h-3.5" />
          {t('export_csv', 'Export CSV')}
        </button>
      </div>

      {/* Compact Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg shadow-sm p-2.5 border-l-4 border-blue-500">
          <p className="text-[10px] text-gray-600">{t('total_outstanding', 'Total Outstanding')}</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">
            Rp {totalOutstanding.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-2.5 border-l-4 border-gray-400">
          <p className="text-[10px] text-gray-600">{t('total_invoices', 'Total Invoices')}</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">{totalInvoices}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-2.5 border-l-4 border-orange-500">
          <p className="text-[10px] text-gray-600">{t('customers', 'Customers')}</p>
          <p className="text-base font-bold text-gray-900 mt-0.5">{ageingData.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-2.5 border-l-4 border-red-600">
          <p className="text-[10px] text-gray-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            {t('critical_90_days', 'Critical (90+ days)')}
          </p>
          <p className="text-base font-bold text-red-900 mt-0.5">{criticalCustomers}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-500">{t('loading', 'Loading ageing data')}...</p>
          </div>
        ) : ageingData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm font-medium">{t('no_outstanding', 'No Outstanding Invoices')}</p>
            <p className="text-xs mt-1">{t('all_paid', 'All invoices are fully paid!')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {ageingData.map((customer) => {
              const isExpanded = expandedCustomers.has(customer.customer_id);
              const badge = getDaysOverdueBadge(customer.oldest_overdue_days);

              return (
                <div key={customer.customer_id}>
                  <div
                    onClick={() => toggleCustomer(customer.customer_id)}
                    className="p-2.5 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{customer.customer_name}</p>
                        <p className="text-xs text-gray-500">{customer.invoice_count} {t('invoices', 'invoice(s)')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-sm text-gray-900">
                          Rp {customer.total_outstanding.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-28">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${badge.color}`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 px-3 pb-3">
                      <table className="w-full text-xs">
                        <thead className="border-b border-gray-300">
                          <tr className="text-[10px] text-gray-600">
                            <th className="text-left py-1.5 px-2">{t('invoice_number', 'Invoice #')}</th>
                            <th className="text-left py-1.5 px-2">{t('invoice_date', 'Invoice Date')}</th>
                            <th className="text-left py-1.5 px-2">{t('due_date', 'Due Date')}</th>
                            <th className="text-right py-1.5 px-2">{t('amount', 'Amount')}</th>
                            <th className="text-right py-1.5 px-2">{t('paid', 'Paid')}</th>
                            <th className="text-right py-1.5 px-2">{t('balance', 'Balance')}</th>
                            <th className="text-center py-1.5 px-2">{t('days_overdue', 'Days Overdue')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {customer.invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-gray-100">
                              <td className="py-1.5 px-2 font-mono text-blue-600">{invoice.invoice_number}</td>
                              <td className="py-1.5 px-2">{new Date(invoice.invoice_date).toLocaleDateString('id-ID')}</td>
                              <td className="py-1.5 px-2">{new Date(invoice.due_date).toLocaleDateString('id-ID')}</td>
                              <td className="py-1.5 px-2 text-right">
                                Rp {invoice.total_amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-1.5 px-2 text-right text-green-600">
                                Rp {invoice.paid_amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-1.5 px-2 text-right font-medium">
                                Rp {invoice.balance.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`font-medium ${getDaysOverdueColor(invoice.days_overdue)}`}>
                                  {invoice.days_overdue < 0 ? `${t('due_in', 'Due in')} ${Math.abs(invoice.days_overdue)}d` : invoice.days_overdue === 0 ? t('today', 'Today') : `${invoice.days_overdue}d`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
