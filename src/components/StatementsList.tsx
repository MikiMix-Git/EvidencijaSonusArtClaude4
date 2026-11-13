import { BankStatement } from '../types/BankStatement';
import { formatCurrency } from '../utils/BankStatementParser';
import { FileText, Trash2, Eye } from 'lucide-react';
import { DateOrderToggle } from './DateOrderToggle';
import { useDateOrder, sortByDate, parseDMY } from '../utils/dateSort';

interface StatementsListProps {
  statements: BankStatement[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function StatementsList({ statements, onSelect, onRemove }: StatementsListProps) {
  const [dateOrder, setDateOrder] = useDateOrder();
  const orderedStatements = sortByDate(statements, dateOrder, (s) => parseDMY(s.summary.periodStart));
  const statementLabels = new Map<string, string>();
  
  statements.forEach((stmt) => {
    const yearMatch = stmt.summary.periodStart.match(/\.(\d{4})$/);
    const year = yearMatch ? yearMatch[1] : 'N/A';
    const stmtNum = stmt.summary.statementNumber;
    const label = stmtNum !== undefined ? `${year}/${stmtNum}` : `${year}`;
    statementLabels.set(stmt.id, label);
  });
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">
          Učitani izvodi - hronološki poredani ({statements.length})
        </h2>
        <DateOrderToggle order={dateOrder} onChange={setDateOrder} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orderedStatements.map((stmt) => (
          <div key={stmt.id} className="relative bg-slate-800/50 border border-slate-700/30 rounded-xl p-5 hover:bg-slate-800/70 transition-colors">
            <div className="absolute top-3 right-3 bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full font-mono">
              {statementLabels.get(stmt.id)}
            </div>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm truncate max-w-[200px]">{stmt.fileName}</h3>
                  <p className="text-xs text-slate-500">{stmt.metadata.pageCount} stranica • {stmt.metadata.fileSize}</p>
                </div>
              </div>
              <button onClick={() => onRemove(stmt.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Period:</span>
                <span className="text-white">{stmt.summary.periodStart} - {stmt.summary.periodEnd}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Transakcija:</span>
                <span className="text-white">{stmt.summary.transactionCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Prilivi:</span>
                <span className="text-green-400 font-mono">{formatCurrency(stmt.summary.totalIncome, stmt.summary.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Odlivi:</span>
                <span className="text-red-400 font-mono">{formatCurrency(stmt.summary.totalExpense, stmt.summary.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/30">
                <span className="text-slate-400">Neto:</span>
                <span className={`font-mono font-semibold ${stmt.summary.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stmt.summary.netChange, stmt.summary.currency)}
                </span>
              </div>
              {stmt.summary.oldBalance !== undefined && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/30">
                  <span className="text-slate-400">Stari saldo:</span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(stmt.summary.oldBalance, stmt.summary.currency)}
                  </span>
                </div>
              )}
              {stmt.summary.newBalance !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Novi saldo:</span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(stmt.summary.newBalance, stmt.summary.currency)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onSelect(stmt.id)} className="flex-1 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Eye size={16} />
                Detalji
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
