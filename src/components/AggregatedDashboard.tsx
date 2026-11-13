import { useState, type ReactNode } from 'react';
import { DateOrderToggle } from './DateOrderToggle';
import { useDateOrder, sortByDate, parseDMY } from '../utils/dateSort';
import { BankStatementSummary, formatCurrency } from '../utils/BankStatementParser';
import { BankStatement } from '../types/BankStatement';
import { TrendingUp, TrendingDown, Wallet, Calendar, ArrowUpRight, ArrowDownRight, FileText, Euro, Banknote } from 'lucide-react';

interface AggregatedDashboardProps {
  summary: BankStatementSummary;
  statements: BankStatement[];
}

/** Izvod s najnovijim periodom (neovisno o redoslijedu u listi) */
function latestStatement(list: BankStatement[]): BankStatement | undefined {
  return list.reduce<BankStatement | undefined>((best, s) => {
    if (!best) return s;
    const a = [parseDMY(s.summary.periodEnd), parseDMY(s.summary.periodStart), s.summary.statementNumber ?? 0];
    const b = [parseDMY(best.summary.periodEnd), parseDMY(best.summary.periodStart), best.summary.statementNumber ?? 0];
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? s : best;
    }
    return best;
  }, undefined);
}

export function AggregatedDashboard({ summary, statements }: AggregatedDashboardProps) {
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'EUR' | 'BAM'>('all');
  const [dateOrder, setDateOrder] = useDateOrder();
  
  const eurStatements = statements.filter(s => s.summary.currency === 'EUR');
  const bamStatements = statements.filter(s => s.summary.currency === 'BAM');
  
  const eurSummary = eurStatements.length > 0 ? {
    totalIncome: eurStatements.reduce((sum, s) => sum + s.summary.totalIncome, 0),
    totalExpense: eurStatements.reduce((sum, s) => sum + s.summary.totalExpense, 0),
    netChange: eurStatements.reduce((sum, s) => sum + s.summary.netChange, 0),
    transactionCount: eurStatements.reduce((sum, s) => sum + s.summary.transactionCount, 0),
    closingBalance: latestStatement(eurStatements)?.summary.closingBalance || 0,
  } : null;
  
  const bamSummary = bamStatements.length > 0 ? {
    totalIncome: bamStatements.reduce((sum, s) => sum + s.summary.totalIncome, 0),
    totalExpense: bamStatements.reduce((sum, s) => sum + s.summary.totalExpense, 0),
    netChange: bamStatements.reduce((sum, s) => sum + s.summary.netChange, 0),
    transactionCount: bamStatements.reduce((sum, s) => sum + s.summary.transactionCount, 0),
    closingBalance: latestStatement(bamStatements)?.summary.closingBalance || 0,
  } : null;

  const { periodStart, periodEnd, transactionCount } = summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <Calendar size={16} />
          <span>Period: {periodStart} - {periodEnd}</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText size={16} />
          <span>{statements.length} {statements.length === 1 ? 'izvod' : 'izvoda'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{transactionCount} transakcija</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setCurrencyFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currencyFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
          Svi izvodi
        </button>
        {eurStatements.length > 0 && (
          <button onClick={() => setCurrencyFilter('EUR')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${currencyFilter === 'EUR' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            <Euro size={16} />
            EUR ({eurStatements.length})
          </button>
        )}
        {bamStatements.length > 0 && (
          <button onClick={() => setCurrencyFilter('BAM')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${currencyFilter === 'BAM' ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            <Banknote size={16} />
            BAM ({bamStatements.length})
          </button>
        )}
      </div>

      {(currencyFilter === 'all' || currencyFilter === 'EUR') && eurSummary && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Euro size={20} className="text-blue-400" />
            EUR Izvodi ({eurStatements.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Prilivi" value={formatCurrency(eurSummary.totalIncome, 'EUR')} icon={<TrendingUp size={24} />} bgColor="bg-green-500/10" textColor="text-green-400" />
            <StatCard label="Odlivi" value={formatCurrency(eurSummary.totalExpense, 'EUR')} icon={<TrendingDown size={24} />} bgColor="bg-red-500/10" textColor="text-red-400" />
            <StatCard label="Neto" value={formatCurrency(eurSummary.netChange, 'EUR')} icon={eurSummary.netChange >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />} bgColor={eurSummary.netChange >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10'} textColor={eurSummary.netChange >= 0 ? 'text-blue-400' : 'text-orange-400'} />
            <StatCard label="Stanje" value={formatCurrency(eurSummary.closingBalance, 'EUR')} icon={<Wallet size={24} />} bgColor="bg-purple-500/10" textColor="text-purple-400" />
          </div>
        </div>
      )}

      {(currencyFilter === 'all' || currencyFilter === 'BAM') && bamSummary && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Banknote size={20} className="text-green-400" />
            BAM Izvodi ({bamStatements.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Prilivi" value={formatCurrency(bamSummary.totalIncome, 'BAM')} icon={<TrendingUp size={24} />} bgColor="bg-green-500/10" textColor="text-green-400" />
            <StatCard label="Odlivi" value={formatCurrency(bamSummary.totalExpense, 'BAM')} icon={<TrendingDown size={24} />} bgColor="bg-red-500/10" textColor="text-red-400" />
            <StatCard label="Neto" value={formatCurrency(bamSummary.netChange, 'BAM')} icon={bamSummary.netChange >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />} bgColor={bamSummary.netChange >= 0 ? 'bg-blue-500/10' : 'bg-orange-500/10'} textColor={bamSummary.netChange >= 0 ? 'text-blue-400' : 'text-orange-400'} />
            <StatCard label="Stanje" value={formatCurrency(bamSummary.closingBalance, 'BAM')} icon={<Wallet size={24} />} bgColor="bg-purple-500/10" textColor="text-purple-400" />
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-300">Pregled po izvodu</h3>
          <DateOrderToggle order={dateOrder} onChange={setDateOrder} />
        </div>
        <div className="space-y-3">
          {sortByDate(statements.filter(s => currencyFilter === 'all' || s.summary.currency === currencyFilter), dateOrder, (s) => parseDMY(s.summary.periodStart)).map((stmt) => (
            <div key={stmt.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stmt.summary.currency === 'EUR' ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                  {stmt.summary.currency === 'EUR' ? <Euro size={14} className="text-blue-400" /> : <Banknote size={14} className="text-green-400" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{stmt.fileName}</p>
                  <p className="text-xs text-slate-500">{stmt.summary.periodStart} - {stmt.summary.periodEnd} • {stmt.summary.transactionCount} txn • {stmt.summary.currency}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-5 gap-y-2 text-right shrink-0">
                {[
                  { label: 'Stari saldo', value: formatCurrency(stmt.summary.oldBalance || 0, stmt.summary.currency), color: 'text-slate-300' },
                  { label: 'Priliv', value: `+${formatCurrency(stmt.summary.totalIncome, stmt.summary.currency)}`, color: 'text-green-400' },
                  { label: 'Odliv', value: `-${formatCurrency(stmt.summary.totalExpense, stmt.summary.currency)}`, color: 'text-red-400' },
                  { label: 'Neto', value: formatCurrency(stmt.summary.netChange, stmt.summary.currency), color: stmt.summary.netChange >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Novo stanje', value: formatCurrency(stmt.summary.closingBalance, stmt.summary.currency), color: 'text-purple-300 font-semibold' },
                ].map((col) => (
                  <div key={col.label}>
                    <p className="text-[11px] text-slate-500">{col.label}</p>
                    <p className={`text-xs font-mono ${col.color}`}>{col.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, bgColor, textColor }: { label: string; value: string; icon: ReactNode; bgColor: string; textColor: string; }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5 hover:bg-slate-800/70 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <div className={textColor}>{icon}</div>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
