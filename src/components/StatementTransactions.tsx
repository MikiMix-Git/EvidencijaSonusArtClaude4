import { useState, useMemo } from 'react';
import { Transaction, formatCurrency } from '../utils/BankStatementParser';
import { DateOrderToggle } from './DateOrderToggle';
import { useDateOrder, sortByDate, txTime, parseDMY } from '../utils/dateSort';
import { Search, ArrowUpRight, ArrowDownRight, Filter, Tag, Calendar } from 'lucide-react';

interface StatementTransactionsProps {
  transactions: Transaction[];
  currency: string;
}

export function StatementTransactions({ transactions, currency }: StatementTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateOrder, setDateOrder] = useDateOrder();
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [transactions]);

  const sortedTransactions = useMemo(() => {
    return sortByDate(transactions, dateOrder, txTime);
  }, [transactions, dateOrder]);

  const filteredTransactions = useMemo(() => {
    return sortedTransactions.filter((t) => {
      const matchesSearch = searchTerm === '' || t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [sortedTransactions, searchTerm, typeFilter, categoryFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Pretraži stavke ovog izvoda..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div className="flex flex-wrap gap-2">
          <DateOrderToggle order={dateOrder} onChange={setDateOrder} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'income' | 'expense')} className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="all">Svi tipovi</option>
            <option value="income">Samo ulazi (prilivi)</option>
            <option value="expense">Samo izlazi (odlivi)</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="all">Sve kategorije</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Filter size={14} />
        <span>{filteredTransactions.length} stavki prikazano hronološki</span>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 sticky top-0">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Datum</th>
                <th className="text-left p-3 text-slate-400 font-medium">Opis stavke</th>
                <th className="text-left p-3 text-slate-400 font-medium">Kategorija</th>
                <th className="text-right p-3 text-green-400 font-medium">Ulaz (Priliv)</th>
                <th className="text-right p-3 text-red-400 font-medium">Izlaz (Odliv)</th>
                <th className="text-right p-3 text-slate-400 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nema pronađenih stavki</td></tr>
              ) : (
                filteredTransactions.map((t, i) => (
                  <tr key={`${t.id}_${i}`} className="border-t border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                    <td className="p-3 text-slate-300 whitespace-nowrap"><div className="flex items-center gap-2"><Calendar size={12} className="text-slate-500" />{t.date}</div></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {t.type === 'income' ? <ArrowUpRight size={14} className="text-green-400" /> : <ArrowDownRight size={14} className="text-red-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium">{t.description}</p>
                          {t.counterparty && <p className="text-xs text-slate-500 truncate max-w-xs">{t.counterparty}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{t.category && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-xs text-slate-300"><Tag size={10} />{t.category}</span>}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">{t.credit > 0 ? <span className="text-green-400 font-semibold">+{formatCurrency(t.credit, currency)}</span> : <span className="text-slate-600">-</span>}</td>
                    <td className="p-3 text-right font-mono whitespace-nowrap">{t.debit > 0 ? <span className="text-red-400 font-semibold">-{formatCurrency(t.debit, currency)}</span> : <span className="text-slate-600">-</span>}</td>
                    <td className="p-3 text-right font-mono text-slate-300 whitespace-nowrap">{t.balance !== undefined ? formatCurrency(t.balance, currency) : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
