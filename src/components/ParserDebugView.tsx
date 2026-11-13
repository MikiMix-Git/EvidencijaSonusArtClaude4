import { useState } from 'react';
import { BankStatement } from '../types/BankStatement';
import { formatCurrency } from '../utils/BankStatementParser';
import { X, ChevronDown, ChevronRight } from 'lucide-react';

interface ParserDebugViewProps {
  statements: BankStatement[];
  onClose: () => void;
}

export function ParserDebugView({ statements, onClose }: ParserDebugViewProps) {
  const [expandedStatement, setExpandedStatement] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto p-4">
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Parser Debug: Izvučeni podaci</h2>
          <button onClick={onClose} className="text-white hover:text-red-400">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {statements.map((stmt) => (
            <div key={stmt.id} className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedStatement(expandedStatement === stmt.id ? null : stmt.id)}
                className="w-full bg-slate-800 p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedStatement === stmt.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <div className="text-left">
                    <h3 className="text-white font-semibold">{stmt.fileName}</h3>
                    <p className="text-xs text-slate-400">
                      {stmt.summary.currency} • {stmt.summary.transactionCount} transakcija • 
                      Period: {stmt.summary.periodStart} - {stmt.summary.periodEnd}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-green-400">+{formatCurrency(stmt.summary.totalIncome, stmt.summary.currency)}</div>
                  <div className="text-red-400">-{formatCurrency(stmt.summary.totalExpense, stmt.summary.currency)}</div>
                  <div className="text-white font-semibold">= {formatCurrency(stmt.summary.netChange, stmt.summary.currency)}</div>
                </div>
              </button>

              {expandedStatement === stmt.id && (
                <div className="p-4 bg-slate-800/50 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">Summary stavke</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="bg-slate-900 p-2 rounded">
                        <div className="text-xs text-slate-500">Promet</div>
                        <div className="text-sm text-white font-mono">
                          {formatCurrency(stmt.summary.turnover || 0, stmt.summary.currency)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-2 rounded">
                        <div className="text-xs text-slate-500">Stari saldo</div>
                        <div className="text-sm text-white font-mono">
                          {formatCurrency(stmt.summary.oldBalance || 0, stmt.summary.currency)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-2 rounded">
                        <div className="text-xs text-slate-500">Saldo prometa</div>
                        <div className="text-sm text-white font-mono">
                          {formatCurrency(stmt.summary.balanceChange || 0, stmt.summary.currency)}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-2 rounded">
                        <div className="text-xs text-slate-500">Novi saldo</div>
                        <div className="text-sm text-white font-mono">
                          {formatCurrency(stmt.summary.newBalance || 0, stmt.summary.currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2">
                      Transakcije ({stmt.summary.transactions.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-700">
                            <th className="text-left py-2 px-2">#</th>
                            <th className="text-left py-2 px-2">Datum</th>
                            <th className="text-left py-2 px-2">Ref</th>
                            <th className="text-left py-2 px-2">Opis</th>
                            <th className="text-right py-2 px-2">Duguje</th>
                            <th className="text-right py-2 px-2">Potražuje</th>
                            <th className="text-right py-2 px-2">Saldo</th>
                            <th className="text-left py-2 px-2">Kategorija</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stmt.summary.transactions.map((t, i) => (
                            <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                              <td className="py-2 px-2 text-blue-400">{t.date}</td>
                              <td className="py-2 px-2 text-slate-300">{t.reference || '-'}</td>
                              <td className="py-2 px-2 text-white max-w-xs truncate" title={t.description}>
                                {t.description}
                              </td>
                              <td className="py-2 px-2 text-right text-red-400 font-mono">
                                {t.debit > 0 ? formatCurrency(t.debit, stmt.summary.currency) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right text-green-400 font-mono">
                                {t.credit > 0 ? formatCurrency(t.credit, stmt.summary.currency) : '-'}
                              </td>
                              <td className="py-2 px-2 text-right text-white font-mono">
                                {t.balance !== undefined ? formatCurrency(t.balance, stmt.summary.currency) : '-'}
                              </td>
                              <td className="py-2 px-2 text-purple-400">{t.category}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-yellow-400 mb-2">Provjera</h4>
                    <div className="bg-slate-900 p-3 rounded text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Izračunati prilivi:</span>
                        <span className="text-green-400 font-mono">
                          {formatCurrency(stmt.summary.totalIncome, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Izračunati odlivi:</span>
                        <span className="text-red-400 font-mono">
                          {formatCurrency(stmt.summary.totalExpense, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Izračunati neto:</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.netChange, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between">
                        <span className="text-slate-400">Promet (iz summary):</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.turnover || 0, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Stari saldo (iz summary):</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.oldBalance || 0, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Novi saldo (iz summary):</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.newBalance || 0, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between">
                        <span className="text-slate-400">Opening balance (izračunato):</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.openingBalance, stmt.summary.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Closing balance (izračunato):</span>
                        <span className="text-white font-mono">
                          {formatCurrency(stmt.summary.closingBalance, stmt.summary.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
