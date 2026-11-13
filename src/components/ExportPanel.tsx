import { useState } from 'react';
import { BankStatementSummary, formatCurrency } from '../utils/BankStatementParser';
import { BankStatement } from '../types/BankStatement';
import { Download, FileText, FileJson, FileSpreadsheet, Check } from 'lucide-react';

interface ExportPanelProps {
  statements: BankStatement[];
  aggregatedSummary: BankStatementSummary;
}

type ExportFormat = 'txt' | 'json' | 'csv';
type ExportScope = 'all' | 'single';

export function ExportPanel({ statements, aggregatedSummary }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('all');
  const [selectedStmtId, setSelectedStmtId] = useState<string>(statements[0]?.id || '');
  const [exported, setExported] = useState(false);

  const selectedStatement = statements.find((s) => s.id === selectedStmtId);

  const generateContent = (): string => {
    if (scope === 'single' && selectedStatement) {
      return generateStatementExport(selectedStatement);
    }
    return generateAllExport();
  };

  const generateStatementExport = (stmt: BankStatement): string => {
    const { summary } = stmt;
    switch (format) {
      case 'csv': {
        let csv = `Izvod,${stmt.fileName}\n`;
        csv += `Period,${summary.periodStart} - ${summary.periodEnd}\n`;
        csv += `Valuta,${summary.currency}\n\n`;
        csv += 'Datum,Opis,Kategorija,Ulaz (Priliv),Izlaz (Odliv),Saldo\n';
        summary.transactions.forEach((t) => {
          const desc = `"${t.description.replace(/"/g, '""')}"`;
          const cat = t.category || 'Ostalo';
          const credit = t.credit > 0 ? t.credit.toFixed(2) : '';
          const debit = t.debit > 0 ? t.debit.toFixed(2) : '';
          const balance = t.balance !== undefined ? t.balance.toFixed(2) : '';
          csv += `${t.date},${desc},${cat},${credit},${debit},${balance}\n`;
        });
        return csv;
      }
      case 'json': {
        return JSON.stringify({
          statement: { fileName: stmt.fileName, period: `${summary.periodStart} - ${summary.periodEnd}`, currency: summary.currency },
          summary: { totalIncome: summary.totalIncome, totalExpense: summary.totalExpense, netChange: summary.netChange, openingBalance: summary.openingBalance, closingBalance: summary.closingBalance },
          transactions: summary.transactions.map((t) => ({ date: t.date, description: t.description, counterparty: t.counterparty, category: t.category, credit: t.credit, debit: t.debit, balance: t.balance })),
        }, null, 2);
      }
      case 'txt': {
        let content = `=== IZVOD: ${stmt.fileName} ===\n`;
        content += `Period: ${summary.periodStart} - ${summary.periodEnd}\n`;
        content += `Valuta: ${summary.currency}\n`;
        content += `Prilivi: ${formatCurrency(summary.totalIncome, summary.currency)}\n`;
        content += `Odlivi: ${formatCurrency(summary.totalExpense, summary.currency)}\n`;
        content += `Neto: ${formatCurrency(summary.netChange, summary.currency)}\n\n`;
        content += `=== STAVKE HRONOLOŠKI ===\n\n`;
        content += `Datum       | Opis                              | Ulaz           | Izlaz          | Saldo\n`;
        content += `${'-'.repeat(100)}\n`;
        summary.transactions.forEach((t) => {
          const date = t.date.padEnd(12);
          const desc = t.description.slice(0, 32).padEnd(34);
          const credit = t.credit > 0 ? formatCurrency(t.credit, summary.currency).padStart(14) : '              ';
          const debit = t.debit > 0 ? formatCurrency(t.debit, summary.currency).padStart(14) : '              ';
          const balance = t.balance !== undefined ? formatCurrency(t.balance, summary.currency).padStart(14) : '              ';
          content += `${date} | ${desc} | ${credit} | ${debit} | ${balance}\n`;
        });
        return content;
      }
      default: return '';
    }
  };

  const generateAllExport = (): string => {
    const allTransactions = statements.flatMap((stmt) => stmt.summary.transactions.map((t) => ({ ...t, statementFileName: stmt.fileName })));
    allTransactions.sort((a, b) => {
      const [dA, mA, yA] = a.date.split('.').map(Number);
      const [dB, mB, yB] = b.date.split('.').map(Number);
      const dateA = new Date(yA, mA - 1, dA);
      const dateB = new Date(yB, mB - 1, dB);
      return dateA.getTime() - dateB.getTime();
    });

    switch (format) {
      case 'csv': {
        let csv = 'Izvod,Datum,Opis,Kategorija,Ulaz (Priliv),Izlaz (Odliv),Saldo\n';
        allTransactions.forEach((t) => {
          const stmtName = `"${t.statementFileName.replace(/"/g, '""')}"`;
          const desc = `"${t.description.replace(/"/g, '""')}"`;
          const cat = t.category || 'Ostalo';
          const credit = t.credit > 0 ? t.credit.toFixed(2) : '';
          const debit = t.debit > 0 ? t.debit.toFixed(2) : '';
          const balance = t.balance !== undefined ? t.balance.toFixed(2) : '';
          csv += `${stmtName},${t.date},${desc},${cat},${credit},${debit},${balance}\n`;
        });
        return csv;
      }
      case 'json': {
        return JSON.stringify({
          summary: { totalStatements: statements.length, totalTransactions: aggregatedSummary.transactionCount, totalIncome: aggregatedSummary.totalIncome, totalExpense: aggregatedSummary.totalExpense, netChange: aggregatedSummary.netChange, currency: aggregatedSummary.currency },
          allTransactionsChronological: allTransactions.map((t) => ({ date: t.date, description: t.description, counterparty: t.counterparty, category: t.category, statement: t.statementFileName, credit: t.credit, debit: t.debit, balance: t.balance })),
        }, null, 2);
      }
      case 'txt': {
        let content = `=== SVI IZVODI - HRONOLOŠKI POREDAK ===\n`;
        content += `Ukupno izvoda: ${statements.length}\n`;
        content += `Ukupno stavki: ${aggregatedSummary.transactionCount}\n`;
        content += `Ukupni prilivi: ${formatCurrency(aggregatedSummary.totalIncome, aggregatedSummary.currency)}\n`;
        content += `Ukupni odlivi: ${formatCurrency(aggregatedSummary.totalExpense, aggregatedSummary.currency)}\n`;
        content += `Neto promjena: ${formatCurrency(aggregatedSummary.netChange, aggregatedSummary.currency)}\n\n`;
        content += `=== SVE STAVKE HRONOLOŠKI ===\n\n`;
        content += `Datum       | Opis                              | Izvor              | Ulaz           | Izlaz          | Saldo\n`;
        content += `${'-'.repeat(120)}\n`;
        allTransactions.forEach((t) => {
          const date = t.date.padEnd(12);
          const desc = t.description.slice(0, 32).padEnd(34);
          const source = t.statementFileName.slice(0, 18).padEnd(19);
          const credit = t.credit > 0 ? formatCurrency(t.credit, aggregatedSummary.currency).padStart(14) : '              ';
          const debit = t.debit > 0 ? formatCurrency(t.debit, aggregatedSummary.currency).padStart(14) : '              ';
          const balance = t.balance !== undefined ? formatCurrency(t.balance, aggregatedSummary.currency).padStart(14) : '              ';
          content += `${date} | ${desc} | ${source} | ${credit} | ${debit} | ${balance}\n`;
        });
        return content;
      }
      default: return '';
    }
  };

  const handleExport = () => {
    const content = generateContent();
    const blob = new Blob([content], { type: getMimeType(format) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = scope === 'single' && selectedStatement ? selectedStatement.fileName.replace('.pdf', '') : 'svi_izvodi';
    a.href = url;
    a.download = `${fileName}_extracted.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const getMimeType = (fmt: ExportFormat): string => {
    switch (fmt) {
      case 'txt': return 'text/plain';
      case 'json': return 'application/json';
      case 'csv': return 'text/csv';
      default: return 'text/plain';
    }
  };

  const previewContent = generateContent().slice(0, 1500);

  const formats: { id: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'csv', label: 'CSV', icon: <FileSpreadsheet size={24} />, desc: 'Tabelarni format (Excel)' },
    { id: 'json', label: 'JSON', icon: <FileJson size={24} />, desc: 'Strukturirani podaci' },
    { id: 'txt', label: 'TXT', icon: <FileText size={24} />, desc: 'Čist tekst format' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-white">Opseg exporta</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')} className="w-4 h-4 bg-slate-700 border-slate-600 text-blue-500" />
            <div>
              <span className="text-sm text-white font-medium">Svi izvodi</span>
              <p className="text-xs text-slate-500">{statements.length} izvoda, {aggregatedSummary.transactionCount} transakcija</p>
            </div>
          </label>
          {statements.length > 1 && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="scope" value="single" checked={scope === 'single'} onChange={() => setScope('single')} className="w-4 h-4 bg-slate-700 border-slate-600 text-blue-500" />
              <div>
                <span className="text-sm text-white font-medium">Pojedinačni izvod</span>
                <p className="text-xs text-slate-500">Export jednog izvoda</p>
              </div>
            </label>
          )}
        </div>
        {scope === 'single' && statements.length > 1 && (
          <select value={selectedStmtId} onChange={(e) => setSelectedStmtId(e.target.value)} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            {statements.map((s) => <option key={s.id} value={s.id}>{s.fileName} ({s.summary.transactionCount} transakcija)</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {formats.map((fmt) => (
          <button key={fmt.id} onClick={() => setFormat(fmt.id)} className={`p-5 rounded-xl border transition-all text-left ${format === fmt.id ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20' : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50'}`}>
            <div className={`mb-3 ${format === fmt.id ? 'text-blue-400' : 'text-slate-400'}`}>{fmt.icon}</div>
            <h3 className={`font-semibold ${format === fmt.id ? 'text-blue-300' : 'text-white'}`}>{fmt.label}</h3>
            <p className="text-sm text-slate-400 mt-1">{fmt.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-700/30 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">Pregled ({format.toUpperCase()})</span>
          <span className="text-xs text-slate-500">Prvih 1500 karaktera</span>
        </div>
        <pre className="p-4 text-xs text-slate-300 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">{previewContent}{previewContent.length >= 1500 && '\n\n... (skraćeno)'}</pre>
      </div>

      <button onClick={handleExport} className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${exported ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-600/20'}`}>
        {exported ? <><Check size={22} />Preuzeto!</> : <><Download size={22} />Preuzmi {scope === 'all' ? 'sve izvode' : 'izvod'} kao {format.toUpperCase()}</>}
      </button>
    </div>
  );
}
