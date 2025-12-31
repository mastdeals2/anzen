import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Building2, Download, Mail, RefreshCw, FileText } from 'lucide-react';

interface Party {
  id: string;
  name: string;
  type: 'customer' | 'supplier';
  email?: string;
  phone?: string;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  particulars: string;
  reference: string;
  debit: number;
  credit: number;
  running_balance: number;
  type: 'invoice' | 'payment' | 'receipt' | 'opening';
}

export default function PartyLedger() {
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 3, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [openingBalance, setOpeningBalance] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadParties();
  }, [partyType]);

  useEffect(() => {
    if (selectedParty) {
      loadLedgerEntries();
    }
  }, [selectedParty, dateRange]);

  const loadParties = async () => {
    const tableName = partyType === 'customer' ? 'customers' : 'suppliers';
    const { data } = await supabase
      .from(tableName)
      .select('id, name, email, phone')
      .order('name');

    if (data) {
      setParties(data.map(p => ({ ...p, type: partyType })));
    }
  };

  const loadLedgerEntries = async () => {
    if (!selectedParty) return;

    setLoading(true);
    try {
      const entries: LedgerEntry[] = [];

      if (partyType === 'customer') {
        const { data: invoices } = await supabase
          .from('sales_invoices')
          .select('id, invoice_date, invoice_number, total_amount, payment_status')
          .eq('customer_id', selectedParty)
          .gte('invoice_date', dateRange.start)
          .lte('invoice_date', dateRange.end)
          .order('invoice_date');

        if (invoices) {
          invoices.forEach(inv => {
            entries.push({
              id: inv.id,
              entry_date: inv.invoice_date,
              particulars: `Sales Invoice - ${inv.payment_status || 'Unpaid'}`,
              reference: inv.invoice_number,
              debit: inv.total_amount,
              credit: 0,
              running_balance: 0,
              type: 'invoice',
            });
          });
        }

        const { data: receipts } = await supabase
          .from('finance_receipt_vouchers')
          .select('id, receipt_date, receipt_number, amount, description')
          .eq('customer_id', selectedParty)
          .gte('receipt_date', dateRange.start)
          .lte('receipt_date', dateRange.end)
          .order('receipt_date');

        if (receipts) {
          receipts.forEach(rec => {
            entries.push({
              id: rec.id,
              entry_date: rec.receipt_date,
              particulars: rec.description || 'Receipt',
              reference: rec.receipt_number,
              debit: 0,
              credit: rec.amount,
              running_balance: 0,
              type: 'receipt',
            });
          });
        }

        const { data: creditNotes } = await supabase
          .from('credit_notes')
          .select('id, credit_note_date, credit_note_number, total_amount')
          .eq('customer_id', selectedParty)
          .gte('credit_note_date', dateRange.start)
          .lte('credit_note_date', dateRange.end)
          .order('credit_note_date');

        if (creditNotes) {
          creditNotes.forEach(cn => {
            entries.push({
              id: cn.id,
              entry_date: cn.credit_note_date,
              particulars: 'Credit Note',
              reference: cn.credit_note_number,
              debit: 0,
              credit: cn.total_amount,
              running_balance: 0,
              type: 'receipt',
            });
          });
        }
      } else {
        const { data: invoices } = await supabase
          .from('finance_purchase_invoices')
          .select('id, invoice_date, invoice_number, total_amount, payment_status')
          .eq('supplier_id', selectedParty)
          .gte('invoice_date', dateRange.start)
          .lte('invoice_date', dateRange.end)
          .order('invoice_date');

        if (invoices) {
          invoices.forEach(inv => {
            entries.push({
              id: inv.id,
              entry_date: inv.invoice_date,
              particulars: `Purchase Invoice - ${inv.payment_status || 'Unpaid'}`,
              reference: inv.invoice_number,
              debit: 0,
              credit: inv.total_amount,
              running_balance: 0,
              type: 'invoice',
            });
          });
        }

        const { data: payments } = await supabase
          .from('finance_payment_vouchers')
          .select('id, payment_date, payment_number, amount, description')
          .eq('supplier_id', selectedParty)
          .gte('payment_date', dateRange.start)
          .lte('payment_date', dateRange.end)
          .order('payment_date');

        if (payments) {
          payments.forEach(pay => {
            entries.push({
              id: pay.id,
              entry_date: pay.payment_date,
              particulars: pay.description || 'Payment',
              reference: pay.payment_number,
              debit: pay.amount,
              credit: 0,
              running_balance: 0,
              type: 'payment',
            });
          });
        }
      }

      entries.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      let runningBalance = openingBalance;
      entries.forEach(entry => {
        runningBalance += entry.debit - entry.credit;
        entry.running_balance = runningBalance;
      });

      setLedgerEntries(entries);
    } catch (err) {
      console.error('Error loading ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return '-';
    return `Rp ${amount.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatBalance = (balance: number) => {
    const absBalance = Math.abs(balance);
    const label = balance >= 0 ? 'Dr' : 'Cr';
    return `${formatAmount(absBalance)} ${label}`;
  };

  const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;
  const outstanding = Math.abs(closingBalance);

  const exportToCSV = () => {
    const selectedPartyData = parties.find(p => p.id === selectedParty);
    if (!selectedPartyData) return;

    const headers = ['Date', 'Particulars', 'Ref No', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
    const rows = ledgerEntries.map(entry => [
      new Date(entry.entry_date).toLocaleDateString('id-ID'),
      entry.particulars,
      entry.reference,
      entry.debit > 0 ? formatAmount(entry.debit) : '',
      entry.credit > 0 ? formatAmount(entry.credit) : '',
      formatBalance(entry.running_balance),
    ]);

    const csv = [
      `${partyType === 'customer' ? 'Customer' : 'Supplier'} Ledger - ${selectedPartyData.name}`,
      `Period: ${new Date(dateRange.start).toLocaleDateString('id-ID')} to ${new Date(dateRange.end).toLocaleDateString('id-ID')}`,
      `Opening Balance: ${formatBalance(openingBalance)}`,
      `Closing Balance: ${formatBalance(closingBalance)}`,
      `Outstanding: ${formatAmount(outstanding)}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Total,,,${formatAmount(totalDebit)},${formatAmount(totalCredit)},${formatBalance(closingBalance)}`,
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ledger_${selectedPartyData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const sendStatementOfAccount = async () => {
    const selectedPartyData = parties.find(p => p.id === selectedParty);
    if (!selectedPartyData || !selectedPartyData.email) {
      alert('No email address found for this party');
      return;
    }

    if (!confirm(`Send Statement of Account to ${selectedPartyData.email}?`)) {
      return;
    }

    setSendingEmail(true);
    try {
      const headers = ['Date', 'Particulars', 'Ref No', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
      const rows = ledgerEntries.map(entry => [
        new Date(entry.entry_date).toLocaleDateString('id-ID'),
        entry.particulars,
        entry.reference,
        entry.debit > 0 ? formatAmount(entry.debit) : '',
        entry.credit > 0 ? formatAmount(entry.credit) : '',
        formatBalance(entry.running_balance),
      ]);

      const csvContent = [
        `${partyType === 'customer' ? 'Customer' : 'Supplier'} Ledger - ${selectedPartyData.name}`,
        `Period: ${new Date(dateRange.start).toLocaleDateString('id-ID')} to ${new Date(dateRange.end).toLocaleDateString('id-ID')}`,
        `Opening Balance: ${formatBalance(openingBalance)}`,
        `Closing Balance: ${formatBalance(closingBalance)}`,
        `Outstanding: ${formatAmount(outstanding)}`,
        '',
        headers.join(','),
        ...rows.map(row => row.join(',')),
        '',
        `Total,,,${formatAmount(totalDebit)},${formatAmount(totalCredit)},${formatBalance(closingBalance)}`,
      ].join('\n');

      const emailBody = `
Dear ${selectedPartyData.name},

Please find attached your Statement of Account for the period ${new Date(dateRange.start).toLocaleDateString('id-ID')} to ${new Date(dateRange.end).toLocaleDateString('id-ID')}.

Summary:
- Opening Balance: ${formatBalance(openingBalance)}
- Total Debit: ${formatAmount(totalDebit)}
- Total Credit: ${formatAmount(totalCredit)}
- Closing Balance: ${formatBalance(closingBalance)}
- Outstanding Amount: ${formatAmount(outstanding)}

Please review and confirm. If you have any questions, please contact us.

Best regards,
Accounts Team
      `.trim();

      alert('Email functionality requires integration with your email system.\n\nStatement has been downloaded. You can manually send it via your email client.');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `SOA_${selectedPartyData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

    } catch (err: any) {
      console.error('Error sending email:', err);
      alert('Failed to send email: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const selectedPartyData = parties.find(p => p.id === selectedParty);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {partyType === 'customer' ? (
            <Users className="w-5 h-5 text-blue-600" />
          ) : (
            <Building2 className="w-5 h-5 text-purple-600" />
          )}
          <h2 className="text-xl font-semibold text-gray-800">
            {partyType === 'customer' ? 'Customer' : 'Supplier'} Ledger
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLedgerEntries}
            disabled={!selectedParty || loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={!selectedParty || ledgerEntries.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={sendStatementOfAccount}
            disabled={!selectedParty || ledgerEntries.length === 0 || sendingEmail}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            {sendingEmail ? 'Sending...' : 'Email SOA'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party Type</label>
            <select
              value={partyType}
              onChange={(e) => {
                setPartyType(e.target.value as 'customer' | 'supplier');
                setSelectedParty('');
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="customer">Customer (Debtor)</option>
              <option value="supplier">Supplier (Creditor)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select {partyType === 'customer' ? 'Customer' : 'Supplier'}
            </label>
            <select
              value={selectedParty}
              onChange={(e) => setSelectedParty(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Party</option>
              {parties.map(party => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        {selectedPartyData && ledgerEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">Opening Balance</p>
              <p className="text-lg font-bold text-gray-900">{formatBalance(openingBalance)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">Total Debit</p>
              <p className="text-lg font-bold text-red-600">{formatAmount(totalDebit)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">Total Credit</p>
              <p className="text-lg font-bold text-green-600">{formatAmount(totalCredit)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 uppercase">Outstanding</p>
              <p className="text-lg font-bold text-orange-600">{formatAmount(outstanding)}</p>
            </div>
          </div>
        )}
      </div>

      {selectedParty && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Particulars
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Ref No
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Debit (Dr)
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Credit (Cr)
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900" colSpan={3}>
                    Opening Balance
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                    {formatBalance(openingBalance)}
                  </td>
                </tr>

                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      Loading entries...
                    </td>
                  </tr>
                ) : ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      No transactions found for this period
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.entry_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {entry.particulars}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 font-mono">
                        {entry.reference}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-red-600 text-right font-medium">
                        {entry.debit > 0 ? formatAmount(entry.debit) : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                        {entry.credit > 0 ? formatAmount(entry.credit) : '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                        {formatBalance(entry.running_balance)}
                      </td>
                    </tr>
                  ))
                )}

                {ledgerEntries.length > 0 && (
                  <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900" colSpan={3}>
                      Closing Balance
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-red-600 text-right font-bold">
                      {formatAmount(totalDebit)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-green-600 text-right font-bold">
                      {formatAmount(totalCredit)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                      {formatBalance(closingBalance)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
