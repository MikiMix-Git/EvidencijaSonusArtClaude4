import { useState } from 'react';
import { BankStatement } from '../types/BankStatement';
import { formatCurrency } from '../utils/BankStatementParser';
import { PDFViewer } from './PDFViewer';
import { StatementTransactions } from './StatementTransactions';
import { FinancialCharts } from './FinancialCharts';
import { DebugView } from './DebugView';
import { FileText, Table2, BarChart3, Bug } from 'lucide-react';

interface StatementDetailProps {
  statement: BankStatement;
}

type DetailTab = 'transactions' | 'charts' | 'raw';

export function StatementDetail({ statement }: StatementDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('transactions');
  const [showDebug, setShowDebug] = useState(false);

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'transactions', label: 'Transakcije', icon: <Table2 size={16} /> },
    { id: 'charts', label: 'Grafici', icon: <BarChart3 size={16} /> },
    { id: 'raw', label: 'Sirovi tekst', icon: <FileText size={16} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <FileText size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">{statement.fileName}</h3>
          <p className="text-xs text-slate-500">{statement.summary.periodStart} - {statement.summary.periodEnd} • {statement.summary.transactionCount} transakcija • {statement.metadata.fileSize}</p>
        </div>
        <button
          onClick={() => setShowDebug(true)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded flex items-center gap-2"
        >
          <Bug size={16} />
          Debug
        </button>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Prilivi</p>
            <p className="text-sm font-mono text-green-400">{formatCurrency(statement.summary.totalIncome, statement.summary.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Odlivi</p>
            <p className="text-sm font-mono text-red-400">{formatCurrency(statement.summary.totalExpense, statement.summary.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Neto</p>
            <p className={`text-sm font-mono font-semibold ${statement.summary.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(statement.summary.netChange, statement.summary.currency)}</p>
          </div>
        </div>
      </div>

      {(statement.summary.oldBalance !== undefined || statement.summary.balanceChange !== undefined || statement.summary.newBalance !== undefined) && (
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Summary stavke izvoda</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {statement.summary.oldBalance !== undefined && (
              <div>
                <p className="text-xs text-slate-500">Stari saldo</p>
                <p className="text-sm font-mono text-white">{formatCurrency(statement.summary.oldBalance, statement.summary.currency)}</p>
              </div>
            )}
            {statement.summary.balanceChange !== undefined && (
              <div>
                <p className="text-xs text-slate-500">Saldo prometa</p>
                <p className={`text-sm font-mono ${statement.summary.balanceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(statement.summary.balanceChange, statement.summary.currency)}</p>
              </div>
            )}
            {statement.summary.newBalance !== undefined && (
              <div>
                <p className="text-xs text-slate-500">Novi saldo</p>
                <p className="text-sm font-mono font-semibold text-white">{formatCurrency(statement.summary.newBalance, statement.summary.currency)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'transactions' && (
          statement.summary.transactions.length > 0 ? (
            <StatementTransactions transactions={statement.summary.transactions} currency={statement.summary.currency} />
          ) : (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-5">
              <p className="text-amber-300 text-sm">Nisu pronađene transakcije u ovom izvodu. Provjerite sirovi tekst.</p>
            </div>
          )
        )}
        {activeTab === 'charts' && <FinancialCharts summary={statement.summary} />}
        {activeTab === 'raw' && <PDFViewer pages={statement.pages} />}
      </div>

      {showDebug && (
        <DebugView pages={statement.pages} onClose={() => setShowDebug(false)} />
      )}
    </div>
  );
}
