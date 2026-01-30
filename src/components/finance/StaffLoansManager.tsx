import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, X, DollarSign, UserCircle, Calendar } from 'lucide-react';
import { Modal } from '../Modal';
import { useAuth } from '../../contexts/AuthContext';

interface StaffLoan {
  id: string;
  loan_number: string;
  staff_name: string;
  loan_amount: number;
  loan_date: string;
  due_date: string | null;
  status: string;
  amount_repaid: number;
  balance: number;
  description: string | null;
  payment_method: string;
}

interface StaffRepayment {
  id: string;
  repayment_number: string;
  repayment_date: string;
  amount: number;
  payment_method: string;
  description: string | null;
}

interface StaffLedgerEntry {
  transaction_date: string;
  transaction_type: string;
  reference_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StaffBalance {
  staff_name: string;
  total_loans: number;
  total_repayments: number;
  total_advances: number;
  outstanding_balance: number;
  last_transaction_date: string;
}

export function StaffLoansManager() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<StaffLoan[]>([]);
  const [balances, setBalances] = useState<StaffBalance[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<StaffLoan | null>(null);
  const [repayments, setRepayments] = useState<StaffRepayment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StaffLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedStaffName, setSelectedStaffName] = useState('');

  const [formData, setFormData] = useState({
    staff_name: '',
    loan_amount: '',
    loan_date: new Date().toISOString().split('T')[0],
    due_date: '',
    description: '',
    payment_method: 'cash',
    bank_account_id: '',
  });

  const [repaymentData, setRepaymentData] = useState({
    amount: '',
    repayment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    bank_account_id: '',
    description: '',
  });

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loansRes, balancesRes, banksRes] = await Promise.all([
        supabase
          .from('staff_loans')
          .select('*')
          .order('loan_date', { ascending: false }),
        supabase.rpc('get_staff_outstanding_balances'),
        supabase.from('bank_accounts').select('*').eq('is_active', true),
      ]);

      if (loansRes.error) throw loansRes.error;
      if (banksRes.error) throw banksRes.error;

      setLoans(loansRes.data || []);
      setBalances(balancesRes.data || []);
      setBankAccounts(banksRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('staff_loans').insert([
        {
          ...formData,
          loan_amount: parseFloat(formData.loan_amount),
          bank_account_id: formData.payment_method === 'bank' ? formData.bank_account_id : null,
          created_by: profile?.id,
        },
      ]);

      if (error) throw error;

      setModalOpen(false);
      setFormData({
        staff_name: '',
        loan_amount: '',
        loan_date: new Date().toISOString().split('T')[0],
        due_date: '',
        description: '',
        payment_method: 'cash',
        bank_account_id: '',
      });
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    try {
      const { error } = await supabase.from('staff_loan_repayments').insert([
        {
          loan_id: selectedLoan.id,
          amount: parseFloat(repaymentData.amount),
          repayment_date: repaymentData.repayment_date,
          payment_method: repaymentData.payment_method,
          bank_account_id: repaymentData.payment_method === 'bank' ? repaymentData.bank_account_id : null,
          description: repaymentData.description,
          created_by: profile?.id,
        },
      ]);

      if (error) throw error;

      setRepaymentModalOpen(false);
      setRepaymentData({
        amount: '',
        repayment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        bank_account_id: '',
        description: '',
      });
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const viewRepayments = async (loan: StaffLoan) => {
    setSelectedLoan(loan);
    try {
      const { data, error } = await supabase
        .from('staff_loan_repayments')
        .select('*')
        .eq('loan_id', loan.id)
        .order('repayment_date', { ascending: false });

      if (error) throw error;
      setRepayments(data || []);
    } catch (error) {
      console.error('Error loading repayments:', error);
    }
  };

  const viewLedger = async (staffName: string) => {
    setSelectedStaffName(staffName);
    try {
      const { data, error } = await supabase.rpc('get_staff_ledger', {
        p_staff_name: staffName,
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

  const filteredLoans = loans.filter(
    (l) =>
      l.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.loan_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-yellow-100 text-yellow-700';
      case 'partial':
        return 'bg-blue-100 text-blue-700';
      case 'repaid':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Staff Loans & Advances</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Loan
        </button>
      </div>

      {balances.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium mb-4">Outstanding Balances</h3>
          <div className="space-y-2">
            {balances.map((balance) => (
              <div
                key={balance.staff_name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => viewLedger(balance.staff_name)}
              >
                <div className="flex items-center gap-3">
                  <UserCircle className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{balance.staff_name}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-red-600">
                    Rp {balance.outstanding_balance.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs text-gray-500">
                    Loans: Rp {balance.total_loans.toLocaleString('id-ID')} | Repaid: Rp{' '}
                    {balance.total_repayments.toLocaleString('id-ID')}
                  </div>
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
              placeholder="Search by staff name or loan number..."
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
                  Loan No
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Staff Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Loan Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Loan Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Repaid
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{loan.loan_number}</td>
                  <td className="px-4 py-3 font-medium">{loan.staff_name}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(loan.loan_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    Rp {loan.loan_amount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    Rp {loan.amount_repaid.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    Rp {loan.balance.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(loan.status)}`}>
                      {loan.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {loan.status !== 'repaid' && (
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setRepaymentModalOpen(true);
                          }}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Add Repayment
                        </button>
                      )}
                      <button
                        onClick={() => viewRepayments(loan)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No loans found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Staff Loan">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Name *
            </label>
            <input
              type="text"
              required
              value={formData.staff_name}
              onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., Vijay Lunkad"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan Amount *
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.loan_amount}
                onChange={(e) => setFormData({ ...formData, loan_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan Date *
              </label>
              <input
                type="date"
                required
                value={formData.loan_date}
                onChange={(e) => setFormData({ ...formData, loan_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          {formData.payment_method === 'bank' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Account *
              </label>
              <select
                required
                value={formData.bank_account_id}
                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select bank account</option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.bank_name} - {bank.account_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Give Loan
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        title={`Loan Repayment - ${selectedLoan?.staff_name}`}
      >
        {selectedLoan && (
          <form onSubmit={handleRepayment} className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Loan Number:</span>
                  <span className="ml-2 font-medium">{selectedLoan.loan_number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Balance:</span>
                  <span className="ml-2 font-semibold text-red-600">
                    Rp {selectedLoan.balance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment Amount *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  max={selectedLoan.balance}
                  value={repaymentData.amount}
                  onChange={(e) => setRepaymentData({ ...repaymentData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repayment Date *
                </label>
                <input
                  type="date"
                  required
                  value={repaymentData.repayment_date}
                  onChange={(e) =>
                    setRepaymentData({ ...repaymentData, repayment_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                value={repaymentData.payment_method}
                onChange={(e) =>
                  setRepaymentData({ ...repaymentData, payment_method: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            {repaymentData.payment_method === 'bank' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Account *
                </label>
                <select
                  required
                  value={repaymentData.bank_account_id}
                  onChange={(e) =>
                    setRepaymentData({ ...repaymentData, bank_account_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bank_name} - {bank.account_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={repaymentData.description}
                onChange={(e) =>
                  setRepaymentData({ ...repaymentData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
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
                Record Repayment
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={selectedLoan !== null && repayments.length > 0 && !repaymentModalOpen}
        onClose={() => {
          setSelectedLoan(null);
          setRepayments([]);
        }}
        title={`Repayment History - ${selectedLoan?.staff_name}`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Loan Amount:</span>
                <div className="font-semibold">
                  Rp {selectedLoan?.loan_amount.toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Repaid:</span>
                <div className="font-semibold text-green-600">
                  Rp {selectedLoan?.amount_repaid.toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Balance:</span>
                <div className="font-semibold text-red-600">
                  Rp {selectedLoan?.balance.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Ref No</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {repayments.map((rep) => (
                <tr key={rep.id}>
                  <td className="px-3 py-2">
                    {new Date(rep.repayment_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{rep.repayment_number}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">
                    Rp {rep.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 capitalize">{rep.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        isOpen={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        title={`Staff Ledger - ${selectedStaffName}`}
      >
        <div className="space-y-4">
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
                      {new Date(entry.transaction_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {entry.transaction_type}
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
        </div>
      </Modal>
    </div>
  );
}
