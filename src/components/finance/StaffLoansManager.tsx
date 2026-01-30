import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, UserCircle, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from '../Modal';
import { useAuth } from '../../contexts/AuthContext';

interface StaffMember {
  id: string;
  staff_name: string;
  employee_id: string | null;
  coa_account_id: string;
  department: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

interface StaffBalance {
  staff_name: string;
  employee_id: string | null;
  account_code: string;
  outstanding_balance: number;
  last_transaction_date: string;
}

interface LedgerEntry {
  entry_date: string;
  entry_number: string;
  voucher_type: string;
  reference_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  currency: string;
  coa_id: string;
}

export function StaffLoansManager() {
  const { profile } = useAuth();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [balances, setBalances] = useState<StaffBalance[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newStaffModalOpen, setNewStaffModalOpen] = useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const [newStaffData, setNewStaffData] = useState({
    staff_name: '',
    employee_id: '',
    department: '',
    designation: '',
    phone: '',
    email: '',
  });

  const [transactionData, setTransactionData] = useState({
    amount: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    bank_account_id: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [staffRes, balancesRes, banksRes] = await Promise.all([
        supabase.from('staff_members').select('*').eq('is_active', true).order('staff_name'),
        supabase.rpc('get_staff_outstanding_summary'),
        supabase.from('bank_accounts').select('*').eq('is_active', true),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (banksRes.error) throw banksRes.error;

      setStaffMembers(staffRes.data || []);
      setBalances(balancesRes.data || []);
      setBankAccounts(banksRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create staff account in COA first
      const { data: coaId, error: coaError } = await supabase.rpc('create_staff_account', {
        p_staff_name: newStaffData.staff_name,
        p_employee_id: newStaffData.employee_id || null,
      });

      if (coaError) throw coaError;

      // Update additional staff details
      await supabase
        .from('staff_members')
        .update({
          department: newStaffData.department || null,
          designation: newStaffData.designation || null,
          phone: newStaffData.phone || null,
          email: newStaffData.email || null,
        })
        .eq('coa_account_id', coaId);

      setNewStaffModalOpen(false);
      setNewStaffData({
        staff_name: '',
        employee_id: '',
        department: '',
        designation: '',
        phone: '',
        email: '',
      });
      loadData();
      alert('Staff member created successfully');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleGiveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    try {
      const amount = parseFloat(transactionData.amount);

      // Get bank account COA ID if payment is via bank
      let bankCoaId = null;
      if (transactionData.payment_method === 'bank' && transactionData.bank_account_id) {
        const { data: bankData } = await supabase
          .from('bank_accounts')
          .select('coa_id')
          .eq('id', transactionData.bank_account_id)
          .single();

        if (bankData) bankCoaId = bankData.coa_id;
      } else {
        // Use petty cash account
        const { data: pettyCashData } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1102')
          .single();

        if (pettyCashData) bankCoaId = pettyCashData.id;
      }

      if (!bankCoaId) {
        throw new Error('Payment account not found');
      }

      // Create payment voucher (Dr Staff, Cr Bank/Cash)
      const entryNumber = await generateEntryNumber(transactionData.transaction_date);

      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: transactionData.transaction_date,
          source_module: 'payment',
          reference_number: `PAY-${entryNumber.split('-')[1]}`,
          description: `Staff advance given to ${selectedStaff.staff_name}: ${transactionData.description}`,
          is_posted: true,
          created_by: profile?.id,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journalEntry.id,
          line_number: 1,
          account_id: selectedStaff.coa_account_id, // Dr Staff
          debit: amount,
          credit: 0,
          description: `Advance to ${selectedStaff.staff_name}`,
        },
        {
          journal_entry_id: journalEntry.id,
          line_number: 2,
          account_id: bankCoaId, // Cr Bank/Cash
          debit: 0,
          credit: amount,
          description: transactionData.payment_method === 'bank' ? 'Bank payment' : 'Cash payment',
        },
      ];

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);

      if (linesError) throw linesError;

      setAdvanceModalOpen(false);
      setTransactionData({
        amount: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        bank_account_id: '',
        description: '',
      });
      loadData();
      alert('Staff advance recorded successfully via Payment Voucher');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    try {
      const amount = parseFloat(transactionData.amount);

      // Get bank account COA ID if payment is via bank
      let bankCoaId = null;
      if (transactionData.payment_method === 'bank' && transactionData.bank_account_id) {
        const { data: bankData } = await supabase
          .from('bank_accounts')
          .select('coa_id')
          .eq('id', transactionData.bank_account_id)
          .single();

        if (bankData) bankCoaId = bankData.coa_id;
      } else {
        // Use petty cash account
        const { data: pettyCashData } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', '1102')
          .single();

        if (pettyCashData) bankCoaId = pettyCashData.id;
      }

      if (!bankCoaId) {
        throw new Error('Payment account not found');
      }

      // Create receipt voucher (Dr Bank/Cash, Cr Staff)
      const entryNumber = await generateEntryNumber(transactionData.transaction_date);

      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          entry_number: entryNumber,
          entry_date: transactionData.transaction_date,
          source_module: 'receipt',
          reference_number: `REC-${entryNumber.split('-')[1]}`,
          description: `Staff advance repayment from ${selectedStaff.staff_name}: ${transactionData.description}`,
          is_posted: true,
          created_by: profile?.id,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journalEntry.id,
          line_number: 1,
          account_id: bankCoaId, // Dr Bank/Cash
          debit: amount,
          credit: 0,
          description: transactionData.payment_method === 'bank' ? 'Bank receipt' : 'Cash receipt',
        },
        {
          journal_entry_id: journalEntry.id,
          line_number: 2,
          account_id: selectedStaff.coa_account_id, // Cr Staff
          debit: 0,
          credit: amount,
          description: `Repayment from ${selectedStaff.staff_name}`,
        },
      ];

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);

      if (linesError) throw linesError;

      setRepaymentModalOpen(false);
      setTransactionData({
        amount: '',
        transaction_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        bank_account_id: '',
        description: '',
      });
      loadData();
      alert('Staff repayment recorded successfully via Receipt Voucher');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const generateEntryNumber = async (date: string): Promise<string> => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .eq('entry_date', date)
      .order('entry_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].entry_number.split('-').pop() || '0');
      return `JE-${date.replace(/-/g, '')}-${String(lastNum + 1).padStart(4, '0')}`;
    }

    return `JE-${date.replace(/-/g, '')}-0001`;
  };

  const viewLedger = async (staff: StaffMember) => {
    setSelectedStaff(staff);
    try {
      const { data, error } = await supabase.rpc('get_staff_ledger_from_journal', {
        p_staff_name: staff.staff_name,
        p_start_date: null,
        p_end_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;
      setLedgerEntries(data || []);
      setLedgerModalOpen(true);
    } catch (error) {
      console.error('Error loading ledger:', error);
    }
  };

  const navigateToPartyLedger = (staffName: string) => {
    // This will be handled by parent component
    alert(`Navigate to Party Ledger for ${staffName}\n\nStaff accounts appear in Party Ledger under account codes 116x`);
  };

  const navigateToBankRecon = () => {
    alert('Navigate to Bank Reconciliation\n\nAll staff advance payments via bank are automatically available in Bank Reconciliation for matching');
  };

  const filteredStaff = staffMembers.filter((s) =>
    s.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.employee_id && s.employee_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📌 How Staff Advances Work</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Staff accounts are created in Chart of Accounts (Code 116x)</li>
          <li>• Giving advance = Payment Voucher (Dr Staff, Cr Bank/Cash)</li>
          <li>• Receiving repayment = Receipt Voucher (Dr Bank/Cash, Cr Staff)</li>
          <li>• All transactions appear in Journal Register, Trial Balance, and Party Ledger</li>
          <li>• Bank payments are automatically linked to Bank Reconciliation</li>
          <li>• Uses standard accounting voucher system - no parallel tracking</li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Staff Advances & Loans</h2>
        <div className="flex gap-2">
          <button
            onClick={() => window.open('#/finance?tab=party_ledger', '_self')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <ExternalLink className="w-4 h-4" />
            Party Ledger
          </button>
          <button
            onClick={navigateToBankRecon}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <ExternalLink className="w-4 h-4" />
            Bank Recon
          </button>
          <button
            onClick={() => setNewStaffModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Staff
          </button>
        </div>
      </div>

      {balances.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium mb-4">Outstanding Balances</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((balance) => (
              <div
                key={balance.staff_name}
                className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  const staff = staffMembers.find(s => s.staff_name === balance.staff_name);
                  if (staff) viewLedger(staff);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-900">{balance.staff_name}</span>
                  </div>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                    {balance.account_code}
                  </span>
                </div>
                <div className="text-2xl font-bold text-red-600 mb-1">
                  Rp {Math.abs(balance.outstanding_balance).toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-gray-500">
                  Last: {new Date(balance.last_transaction_date).toLocaleDateString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by staff name or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Staff Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Employee ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account Code
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStaff.map((staff) => {
                const balance = balances.find(b => b.staff_name === staff.staff_name);
                return (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{staff.staff_name}</td>
                    <td className="px-4 py-3 text-sm">{staff.employee_id || '-'}</td>
                    <td className="px-4 py-3 text-sm">{staff.department || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {balance?.account_code || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setAdvanceModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Give Advance
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setRepaymentModalOpen(true);
                          }}
                          className="flex items-center gap-1 text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          <TrendingDown className="w-4 h-4" />
                          Receive Payment
                        </button>
                        <button
                          onClick={() => viewLedger(staff)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Ledger
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Staff Modal */}
      <Modal
        isOpen={newStaffModalOpen}
        onClose={() => setNewStaffModalOpen(false)}
        title="Add New Staff Member"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Name *
            </label>
            <input
              type="text"
              required
              value={newStaffData.staff_name}
              onChange={(e) => setNewStaffData({ ...newStaffData, staff_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Vijay Lunkad"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <input
                type="text"
                value={newStaffData.employee_id}
                onChange={(e) =>
                  setNewStaffData({ ...newStaffData, employee_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={newStaffData.department}
                onChange={(e) => setNewStaffData({ ...newStaffData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input
              type="text"
              value={newStaffData.designation}
              onChange={(e) => setNewStaffData({ ...newStaffData, designation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={newStaffData.phone}
                onChange={(e) => setNewStaffData({ ...newStaffData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={newStaffData.email}
                onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            ℹ️ This will create a new account in Chart of Accounts (Code 116x) for this staff member
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setNewStaffModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Staff
            </button>
          </div>
        </form>
      </Modal>

      {/* Give Advance Modal */}
      <Modal
        isOpen={advanceModalOpen}
        onClose={() => setAdvanceModalOpen(false)}
        title={`Give Advance - ${selectedStaff?.staff_name}`}
      >
        <form onSubmit={handleGiveAdvance} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
            💡 This will create a Payment Voucher: Dr Staff Account, Cr Bank/Cash
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                step="0.01"
                value={transactionData.amount}
                onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={transactionData.transaction_date}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, transaction_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select
              value={transactionData.payment_method}
              onChange={(e) =>
                setTransactionData({ ...transactionData, payment_method: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="cash">Cash (Petty Cash)</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          {transactionData.payment_method === 'bank' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account *</label>
              <select
                required
                value={transactionData.bank_account_id}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, bank_account_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bank_name} - {bank.account_number} ({bank.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              required
              value={transactionData.description}
              onChange={(e) =>
                setTransactionData({ ...transactionData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="e.g., Salary advance for January"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdvanceModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Give Advance
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Repayment Modal */}
      <Modal
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        title={`Receive Payment - ${selectedStaff?.staff_name}`}
      >
        <form onSubmit={handleRecordRepayment} className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg text-sm text-green-800">
            💡 This will create a Receipt Voucher: Dr Bank/Cash, Cr Staff Account
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                required
                step="0.01"
                value={transactionData.amount}
                onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={transactionData.transaction_date}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, transaction_date: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <select
              value={transactionData.payment_method}
              onChange={(e) =>
                setTransactionData({ ...transactionData, payment_method: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="cash">Cash (Petty Cash)</option>
              <option value="bank">Bank Deposit</option>
            </select>
          </div>

          {transactionData.payment_method === 'bank' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account *</label>
              <select
                required
                value={transactionData.bank_account_id}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, bank_account_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bank_name} - {bank.account_number} ({bank.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              required
              value={transactionData.description}
              onChange={(e) =>
                setTransactionData({ ...transactionData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={2}
              placeholder="e.g., Cash repayment"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRepaymentModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Receive Payment
            </button>
          </div>
        </form>
      </Modal>

      {/* Ledger Modal */}
      <Modal
        isOpen={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        title={`Staff Ledger - ${selectedStaff?.staff_name}`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Debits:</span>
                <div className="font-semibold text-red-600">
                  Rp{' '}
                  {ledgerEntries
                    .reduce((sum, e) => sum + e.debit, 0)
                    .toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Credits:</span>
                <div className="font-semibold text-green-600">
                  Rp{' '}
                  {ledgerEntries
                    .reduce((sum, e) => sum + e.credit, 0)
                    .toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Balance:</span>
                <div className="font-semibold text-blue-600">
                  Rp{' '}
                  {ledgerEntries.length > 0
                    ? ledgerEntries[ledgerEntries.length - 1].balance.toLocaleString('id-ID')
                    : '0'}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Ref No</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledgerEntries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {new Date(entry.entry_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {entry.voucher_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.reference_number}</td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {entry.debit > 0 ? `Rp ${entry.debit.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {entry.credit > 0 ? `Rp ${entry.credit.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      Rp {entry.balance.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
                {ledgerEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            💡 All transactions are also visible in Party Ledger, Journal Register, and Bank
            Reconciliation
          </div>
        </div>
      </Modal>
    </div>
  );
}
