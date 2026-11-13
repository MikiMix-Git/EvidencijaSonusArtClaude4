import { useState, useEffect, useRef, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { StatementsList } from './components/StatementsList';
import { AggregatedDashboard } from './components/AggregatedDashboard';
import { ChronologicalTransactions } from './components/ChronologicalTransactions';
import { AnalyticsView } from './components/AnalyticsView';
import { AggregatedCharts } from './components/AggregatedCharts';
import { StatementDetail } from './components/StatementDetail';
import { ExportPanel } from './components/ExportPanel';
import { FileInfo } from './components/FileInfo';
import { ParserDebugView } from './components/ParserDebugView';
import { GroupedTransactions } from './components/GroupedTransactions';
import { GroupedByTags } from './components/GroupedByTags';
import { parseBankStatement } from './utils/BankStatementParser';
import { 
  saveStatement, 
  loadAllStatements, 
  loadStatementWithPages,
  deleteStatement as deleteFromDB, 
  deleteAllStatements,
  getDBStats,
  exportDBAsJSON,
  importDBFromJSON,
  loadGroupingRules,
  saveGroupingRules,
} from './utils/database';
import type { GroupingRule } from './types/GroupingRule';
import type { BankStatement } from './types/BankStatement';
import type { PageData, PDFMetadata } from './types/App.types';
import * as pdfjsLib from 'pdfjs-dist';
import { Database, Trash2, Download, Upload, HardDrive, Check, AlertTriangle, Euro, Banknote } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function App() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'grouped' | 'tags' | 'analytics' | 'charts' | 'statements' | 'detail' | 'export' | 'info'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; skipped: number; current: string } | null>(null);
  const [showParserDebug, setShowParserDebug] = useState(false);
  
  // Database state
  const [dbStats, setDbStats] = useState<{ count: number; estimatedSize: string; path?: string } | null>(null);
  const [showDBPanel, setShowDBPanel] = useState(false);
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pravila grupisanja (čuvaju se u istoj SQLite bazi kao i izvodi)
  const [groupingRules, setGroupingRules] = useState<GroupingRule[]>([]);
  const rulesSaveTimer = useRef<number | undefined>(undefined);
  const handleRulesChange = useCallback((rules: GroupingRule[]) => {
    setGroupingRules(rules);
    // kratko odgodi upis da se ne šalje zahtjev na svaki otkucani karakter
    window.clearTimeout(rulesSaveTimer.current);
    rulesSaveTimer.current = window.setTimeout(() => {
      saveGroupingRules(rules).catch((err) => console.error('Greška pri čuvanju pravila:', err));
    }, 300);
  }, []);

  const selectedStatement = statements.find(s => s.id === selectedStatementId);

  // Učitavanje sačuvanih izvoda iz baze pri startu
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const saved = await loadAllStatements();
        if (saved.length > 0) {
          // Baza vraća izvode po redoslijedu učitavanja — složi ih po periodu
          setStatements(sortStatementsByPeriod(saved));
        }
        setGroupingRules(await loadGroupingRules());
        const stats = await getDBStats();
        setDbStats(stats);
      } catch (err) {
        console.error('Greška pri učitavanju iz baze:', err);
      } finally {
        setInitialLoadDone(true);
      }
    };
    loadFromDB();
  }, []);

  // Ažuriranje DB statistika
  const refreshDBStats = async () => {
    try {
      const stats = await getDBStats();
      setDbStats(stats);
    } catch (err) {
      console.error('Greška pri čitanju statistika:', err);
    }
  };

  const showDBMessage = (type: 'success' | 'error', text: string) => {
    setDbMessage({ type, text });
    setTimeout(() => setDbMessage(null), 3000);
  };

  // Čita jedan PDF i vraća izvod. Dokument se uvijek oslobađa (inače pdf.js drži memoriju
  // svih učitanih PDF-ova, što kod većeg broja fajlova ruši karticu preglednika).
  const extractStatement = async (file: File): Promise<BankStatement> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    try {
      const numPages = pdf.numPages;
      const pages: PageData[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
            fontName: item.fontName,
          }));

        const text = items.map((item: any) => item.text).join(' ');
        pages.push({ pageNumber: i, text, items });
        page.cleanup();
      }

      const metadata = await pdf.getMetadata().catch(() => null);
      const info = metadata?.info as any;

      const pdfMeta: PDFMetadata = {
        title: info?.Title || file.name,
        author: info?.Author || 'Nepoznato',
        subject: info?.Subject || 'Nepoznato',
        creator: info?.Creator || 'Nepoznato',
        producer: info?.Producer || 'Nepoznato',
        pageCount: numPages,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileName: file.name,
      };

      return {
        id: `stmt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        fileName: file.name,
        uploadDate: new Date(),
        metadata: pdfMeta,
        summary: parseBankStatement(pages, file.name),
        pages,
      };
    } finally {
      await loadingTask.destroy();
    }
  };

  const sortStatementsByPeriod = (list: BankStatement[]) => {
    const parseDate = (dateStr: string): Date => {
      if (!dateStr) return new Date('1900-01-01');
      const parts = dateStr.split('.');
      if (parts.length !== 3) return new Date('1900-01-01');
      const [day, month, year] = parts.map(p => parseInt(p));
      return new Date(year, month - 1, day);
    };
    return [...list].sort(
      (a, b) =>
        parseDate(a.summary.periodStart).getTime() - parseDate(b.summary.periodStart).getTime() ||
        parseDate(a.summary.periodEnd).getTime() - parseDate(b.summary.periodEnd).getTime() ||
        (a.summary.statementNumber ?? 0) - (b.summary.statementNumber ?? 0)
    );
  };

  const handleFilesSelect = async (files: File[]) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    // Brzo preskakanje: poredi se samo ime fajla, prije nego što se PDF uopšte pročita
    const known = new Set(statements.map(s => s.fileName.trim().toLowerCase()));
    const toProcess: File[] = [];
    let skipped = 0;
    for (const file of files) {
      const key = file.name.trim().toLowerCase();
      if (known.has(key)) {
        skipped++;
        continue;
      }
      known.add(key); // isti fajl odabran dvaput u istom unosu
      toProcess.push(file);
    }

    const failed: string[] = [];
    let imported = 0;
    let pending: BankStatement[] = [];
    // U stanju se ne drže sirove stranice PDF-a (učitavaju se tek kad se otvori detalj izvoda)
    const commit = () => {
      if (pending.length === 0) return;
      const batch = pending;
      pending = [];
      setStatements(prev => sortStatementsByPeriod([...prev, ...batch]));
    };

    setImportProgress({ done: 0, total: toProcess.length, skipped, current: '' });

    for (let i = 0; i < toProcess.length; i++) {
      const file = toProcess[i];
      setImportProgress({ done: i, total: toProcess.length, skipped, current: file.name });
      try {
        const statement = await extractStatement(file);
        await saveStatement(statement); // u bazu ide cijeli izvod, uključujući stranice
        pending.push({ ...statement, pages: [] });
        imported++;
      } catch (err) {
        console.error(`Greška pri obradi ${file.name}:`, err);
        failed.push(file.name);
      }
      if (pending.length >= 10) commit();
      // pusti pregledniku da iscrta progres i oslobodi memoriju
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    commit();
    if (imported > 0) await refreshDBStats();

    setImportProgress(null);
    setLoading(false);

    if (failed.length > 0) {
      const shown = failed.slice(0, 5).join(', ');
      setError(`Neuspješno obrađeno ${failed.length} fajlova: ${shown}${failed.length > 5 ? ' ...' : ''}`);
    }
    if (imported > 0 || skipped > 0) {
      setNotice(`Uvezeno: ${imported}${skipped > 0 ? `, preskočeno (već postoje): ${skipped}` : ''}${failed.length > 0 ? `, neuspješno: ${failed.length}` : ''}.`);
    }
  };

  const handleRemoveStatement = async (id: string) => {
    setStatements(prev => prev.filter(s => s.id !== id));
    if (selectedStatementId === id) {
      setSelectedStatementId(null);
      setActiveTab('dashboard');
    }
    // Brisanje iz baze
    await deleteFromDB(id);
    await refreshDBStats();
  };

  const handleSelectStatement = async (id: string) => {
    // Sirove stranice PDF-a se ne drže u memoriji za sve izvode — učitaj ih za izabrani
    const current = statements.find(s => s.id === id);
    if (current && current.pages.length === 0) {
      try {
        const full = await loadStatementWithPages(id);
        setStatements(prev => prev.map(s => (s.id === id ? { ...s, pages: full.pages } : s)));
      } catch (err) {
        console.error('Greška pri učitavanju stranica izvoda:', err);
      }
    }
    setSelectedStatementId(id);
    setActiveTab('detail');
  };

  const handleReset = async () => {
    setStatements([]);
    setSelectedStatementId(null);
    setActiveTab('dashboard');
  };

  // Brisanje cele baze
  const handleDeleteAllDB = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setDbActionLoading(true);
    try {
      await deleteAllStatements();
      setStatements([]);
      setSelectedStatementId(null);
      setActiveTab('dashboard');
      await refreshDBStats();
      showDBMessage('success', 'Baza je uspešno obrisana!');
    } catch (err) {
      showDBMessage('error', 'Greška pri brisanju baze!');
    } finally {
      setDbActionLoading(false);
      setConfirmDelete(false);
    }
  };

  // Export baze
  const handleExportDB = async () => {
    setDbActionLoading(true);
    try {
      const json = await exportDBAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bank_statement_db_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showDBMessage('success', 'Baza je izvezena kao JSON fajl!');
    } catch (err) {
      showDBMessage('error', 'Greška pri izvozu baze!');
    } finally {
      setDbActionLoading(false);
    }
  };

  // Import baze
  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setDbActionLoading(true);
    try {
      const text = await file.text();
      const count = await importDBFromJSON(text);
      // Ponovno učitavanje
      const loaded = await loadAllStatements();
      setStatements(sortStatementsByPeriod(loaded));
      setGroupingRules(await loadGroupingRules());
      await refreshDBStats();
      showDBMessage('success', `Uvezeno ${count} izvoda iz baze!`);
    } catch (err) {
      showDBMessage('error', 'Greška pri uvozu baze! Provjerite format fajla.');
    } finally {
      setDbActionLoading(false);
      e.target.value = '';
    }
  };

  const allTransactions = statements.flatMap(s => 
    s.summary.transactions.map(t => ({
      ...t,
      statementFileName: s.fileName,
      statementId: s.id,
      currency: s.summary.currency,
    }))
  );

  const aggregatedSummary = {
    transactions: allTransactions,
    totalIncome: statements.reduce((sum, s) => sum + s.summary.totalIncome, 0),
    totalExpense: statements.reduce((sum, s) => sum + s.summary.totalExpense, 0),
    netChange: statements.reduce((sum, s) => sum + s.summary.netChange, 0),
    openingBalance: statements.length > 0 ? statements[0].summary.openingBalance : 0,
    closingBalance: statements.length > 0 ? statements[statements.length - 1].summary.closingBalance : 0,
    currency: 'EUR',
    periodStart: statements.length > 0 ? statements[0].summary.periodStart : '',
    periodEnd: statements.length > 0 ? statements[statements.length - 1].summary.periodEnd : '',
    transactionCount: allTransactions.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Bankovni Izvodi - Analiza
              </h1>
              <p className="text-xs text-slate-400">
                {statements.length > 0 
                  ? `${statements.length} ${statements.length === 1 ? 'izvod' : 'izvoda'} • ${allTransactions.length} transakcija`
                  : 'Praćenje finansijskog stanja iz PDF bankovnih izvoda'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* DB Status Badge */}
            {dbStats && dbStats.count > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
                <HardDrive size={12} />
                <span>{dbStats.count} sačuvano</span>
                <span className="text-emerald-500/60">({dbStats.estimatedSize})</span>
              </div>
            )}
            
            {/* DB Management Button */}
            <button
              onClick={() => setShowDBPanel(!showDBPanel)}
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-sm flex items-center gap-2"
              title="Upravljanje bazom podataka"
            >
              <Database size={16} />
              <span className="hidden sm:inline">Baza</span>
            </button>
            
            {statements.length > 0 && (
              <>
                <button
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="hidden sm:inline">Dodaj izvod</span>
                </button>
                <button
                  onClick={() => setShowParserDebug(true)}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="hidden sm:inline">Parser Debug</span>
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-sm"
                >
                  Obriši sve
                </button>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFilesSelect(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      </header>

      {/* DB Management Panel */}
      {showDBPanel && (
        <div className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database size={16} className="text-blue-400" />
                Upravljanje bazom podataka
              </h3>
              <button onClick={() => { setShowDBPanel(false); setConfirmDelete(false); }} className="text-slate-400 hover:text-white text-sm">
                Zatvori ✕
              </button>
            </div>
            
            {/* DB Message */}
            {dbMessage && (
              <div className={`mb-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
                dbMessage.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {dbMessage.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                {dbMessage.text}
              </div>
            )}
            
            {/* DB Stats */}
            {dbStats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Sačuvanih izvoda</p>
                  <p className="text-lg font-bold text-white">{dbStats.count}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Veličina baze</p>
                  <p className="text-lg font-bold text-white">{dbStats.estimatedSize}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Aktivna
                  </p>
                </div>
              </div>
            )}
            
            {/* DB Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportDB}
                disabled={dbActionLoading || !dbStats || dbStats.count === 0}
                className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                Izvezi bazu (JSON)
              </button>
              
              <label className={`px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ${dbActionLoading ? 'opacity-40 pointer-events-none' : ''}`}>
                <Upload size={16} />
                Uvezi bazu (JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportDB}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={handleDeleteAllDB}
                disabled={dbActionLoading || !dbStats || dbStats.count === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  confirmDelete 
                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                    : 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                }`}
              >
                <Trash2 size={16} />
                {confirmDelete ? 'Potvrdi brisanje!' : 'Obriši cijelu bazu'}
              </button>
              
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors"
                >
                  Otkaži
                </button>
              )}
            </div>
            
            {confirmDelete && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} />
                Ovo će trajno obrisati sve sačuvane izvode iz baze podataka. Ova akcija se ne može poništiti!
              </p>
            )}
            
            <p className="mt-3 text-xs text-slate-500">
              💾 Podaci se čuvaju lokalno u SQLite fajlu{dbStats?.path ? <> (<code className="text-slate-400">{dbStats.path}</code>)</> : null}. Izvodi se automatski čuvaju pri uploadu.
              Sirovi tekst PDF stranica se ne čuva radi uštede prostora — samo parsirane transakcije i metapodaci.
            </p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {statements.length === 0 && initialLoadDone ? (
          <FileUpload onFilesSelect={handleFilesSelect} loading={loading} />
        ) : statements.length === 0 && !initialLoadDone ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Učitavanje sačuvanih izvoda...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
              <div className="flex flex-wrap gap-2 border-b border-slate-700/50 pb-2">
                {[
                  { id: 'dashboard', label: 'Pregled' },
                  { id: 'transactions', label: 'Sve stavke (hronološki)' },
                  { id: 'grouped', label: 'Grupisano po opisu' },
                  { id: 'tags', label: 'Grupisano po tagovima' },
                  { id: 'analytics', label: 'Analize' },
                  { id: 'charts', label: 'Grafici' },
                  { id: 'statements', label: 'Izvodi' },
                  ...(selectedStatement ? [{ id: 'detail', label: 'Detalji izvoda' }] : []),
                  { id: 'export', label: 'Export' },
                  ...(selectedStatement ? [{ id: 'info', label: 'Info' }] : []),
                ].map(tab => (                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[500px]">
              {activeTab === 'dashboard' && (
                <AggregatedDashboard summary={aggregatedSummary} statements={statements} />
              )}
              {activeTab === 'transactions' && (
                <ChronologicalTransactions
                  transactions={allTransactions}
                  currency="EUR"
                  statements={statements}
                />
              )}
              {activeTab === 'grouped' && (
                <GroupedTransactions
                  statements={statements}
                  rules={groupingRules}
                  onRulesChange={handleRulesChange}
                />
              )}
              {activeTab === 'tags' && (
                <GroupedByTags statements={statements} rules={groupingRules} />
              )}
              {activeTab === 'analytics' && (
                <AnalyticsView statements={statements} rules={groupingRules} />
              )}
              {activeTab === 'charts' && (
                <AggregatedCharts summary={aggregatedSummary} />
              )}
              {activeTab === 'statements' && (
                <StatementsList
                  statements={statements}
                  onSelect={handleSelectStatement}
                  onRemove={handleRemoveStatement}
                />
              )}
              {activeTab === 'detail' && selectedStatement && (
                <StatementDetail statement={selectedStatement} />
              )}
              {activeTab === 'export' && (
                <ExportPanel statements={statements} aggregatedSummary={aggregatedSummary} />
              )}
              {activeTab === 'info' && selectedStatement && (
                <FileInfo metadata={selectedStatement.metadata} expanded />
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300">
            {error}
          </div>
        )}

        {notice && !loading && (
          <div className="mt-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-xl text-emerald-300 flex items-center justify-between gap-4">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-emerald-400 hover:text-emerald-200 text-sm">Zatvori</button>
          </div>
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium">Obrada PDF fajlova...</p>
              {importProgress ? (
                <>
                  <p className="text-sm text-slate-300">
                    {importProgress.total > 0
                      ? `Obrađeno ${importProgress.done} / ${importProgress.total}`
                      : 'Svi odabrani fajlovi već postoje'}
                    {importProgress.skipped > 0 && ` • preskočeno ${importProgress.skipped}`}
                  </p>
                  {importProgress.current && (
                    <p className="text-xs text-slate-500 max-w-xs truncate">{importProgress.current}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">Ekstrakcija transakcija iz bankovnih izvoda</p>
              )}
            </div>
          </div>
        )}

        {showParserDebug && (
          <ParserDebugView 
            statements={statements} 
            onClose={() => setShowParserDebug(false)} 
          />
        )}
      </main>
    </div>
  );
}
