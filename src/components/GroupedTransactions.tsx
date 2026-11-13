import { useState, useMemo } from 'react';
import { Transaction, formatCurrency } from '../utils/BankStatementParser';
import { BankStatement } from '../types/BankStatement';
import { Search, Filter, TrendingUp, TrendingDown, Hash, Tag, Calendar, ChevronDown, ChevronRight, Settings2, Euro, Banknote } from 'lucide-react';
import { GroupingRulesPanel } from './GroupingRulesPanel';
import { ExportMenu } from './ExportMenu';
import type { ExportGroup } from '../utils/exportGroups';
import { DateOrderToggle } from './DateOrderToggle';
import { useDateOrder, sortByDate, txTime, parseDMY } from '../utils/dateSort';
import { GroupingRule, applyRules } from '../types/GroupingRule';

interface GroupedTransactionsProps {
  statements: BankStatement[];
  rules: GroupingRule[];
  onRulesChange: (rules: GroupingRule[]) => void;
}

interface TransactionGroup {
  id: string;
  name: string;
  type: 'manual' | 'other';
  transactions: Transaction[];
  totalAmount: number;
  totalDebit: number;
  totalCredit: number;
  count: number;
  avgAmount: number;
  firstDate: string;
  lastDate: string;
}

// ============================================
// MANUAL GROUPING ONLY
// ============================================

function manualGroupTransactions(
  transactions: Transaction[],
  manualRules: GroupingRule[]
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  
  transactions.forEach((t, index) => {
    let groupName = '';
    let groupType: TransactionGroup['type'] = 'other';
    
    // Samo manuelna pravila - ako ne matchuje nijedno, ide u "Negrupisano"
    if (manualRules.length > 0) {
      const matchedRule = applyRules(t.description, manualRules);
      if (matchedRule) {
        groupName = `📌 ${matchedRule.groupName}`;
        groupType = 'manual';
      }
    }
    
    // Ako ne matchuje nijedno pravilo, grupiši u "Negrupisano"
    if (!groupName) {
      groupName = '❓ Negrupisano';
      groupType = 'other';
    }
    
    // Dodaj transakciju u grupu
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        id: `group_${index}`,
        name: groupName,
        type: groupType,
        transactions: [],
        totalAmount: 0,
        totalDebit: 0,
        totalCredit: 0,
        count: 0,
        avgAmount: 0,
        firstDate: t.date,
        lastDate: t.date,
      });
    }
    
    const group = groups.get(groupName)!;
    group.transactions.push(t);
    group.totalDebit += t.debit;
    group.totalCredit += t.credit;
    group.totalAmount += Math.max(t.debit, t.credit);
    group.count += 1;
    
    // Ažuriraj datume
    if (t.date < group.firstDate) group.firstDate = t.date;
    if (t.date > group.lastDate) group.lastDate = t.date;
  });
  
  // Izračunaj prosek
  groups.forEach(group => {
    group.avgAmount = group.totalAmount / group.count;
  });
  
  return Array.from(groups.values());
}

// ============================================
// KOMPONENTA
// ============================================

export function GroupedTransactions({ statements, rules: manualRules, onRulesChange: handleRulesChange }: GroupedTransactionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'count' | 'avg' | 'date'>('total');
  const [dateOrder, setDateOrder] = useDateOrder();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<'all' | 'manual' | 'other'>('all');
  const [showRulesPanel, setShowRulesPanel] = useState(false);

  // Razdvoji transakcije po valuti
  const { eurTransactions, bamTransactions } = useMemo(() => {
    const eur: Transaction[] = [];
    const bam: Transaction[] = [];
    
    statements.forEach(statement => {
      const currency = statement.summary.currency;
      statement.summary.transactions.forEach(transaction => {
        if (currency === 'EUR') {
          eur.push(transaction);
        } else if (currency === 'BAM') {
          bam.push(transaction);
        }
      });
    });
    
    return { eurTransactions: eur, bamTransactions: bam };
  }, [statements]);

  // Grupiši EUR transakcije
  const eurGroupedData = useMemo(() => {
    let groups = manualGroupTransactions(eurTransactions, manualRules);
    
    // Filtriraj po tipu
    if (typeFilter !== 'all') {
      groups = groups.filter(g => g.type === typeFilter);
    }
    
    // Filtriraj po pretrazi
    if (searchTerm) {
      groups = groups.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.transactions.some(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sortiraj
    groups.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'total') comparison = a.totalAmount - b.totalAmount;
      else if (sortBy === 'count') comparison = a.count - b.count;
      else if (sortBy === 'avg') comparison = a.avgAmount - b.avgAmount;
      else if (sortBy === 'date') {
        // po datumu zadnje stavke u grupi; smjer određuje prekidač "Stavke"
        const last = (g: TransactionGroup) => Math.max(...g.transactions.map(txTime));
        return (dateOrder === 'asc' ? 1 : -1) * (last(a) - last(b));
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return groups;
  }, [eurTransactions, searchTerm, sortBy, sortOrder, dateOrder, typeFilter, manualRules]);

  // Grupiši BAM transakcije
  const bamGroupedData = useMemo(() => {
    let groups = manualGroupTransactions(bamTransactions, manualRules);
    
    // Filtriraj po tipu
    if (typeFilter !== 'all') {
      groups = groups.filter(g => g.type === typeFilter);
    }
    
    // Filtriraj po pretrazi
    if (searchTerm) {
      groups = groups.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.transactions.some(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sortiraj
    groups.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'total') comparison = a.totalAmount - b.totalAmount;
      else if (sortBy === 'count') comparison = a.count - b.count;
      else if (sortBy === 'avg') comparison = a.avgAmount - b.avgAmount;
      else if (sortBy === 'date') {
        // po datumu zadnje stavke u grupi; smjer određuje prekidač "Stavke"
        const last = (g: TransactionGroup) => Math.max(...g.transactions.map(txTime));
        return (dateOrder === 'asc' ? 1 : -1) * (last(a) - last(b));
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return groups;
  }, [bamTransactions, searchTerm, sortBy, sortOrder, dateOrder, typeFilter, manualRules]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = [
      ...eurGroupedData.map(g => `EUR:${g.id}`),
      ...bamGroupedData.map(g => `BAM:${g.id}`),
    ];
    setExpandedGroups(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const totalGroups = eurGroupedData.length + bamGroupedData.length;
  const totalTransactions = eurGroupedData.reduce((sum: number, g: TransactionGroup) => sum + g.count, 0) + 
                           bamGroupedData.reduce((sum: number, g: TransactionGroup) => sum + g.count, 0);
  const totalEurAmount = eurGroupedData.reduce((sum: number, g: TransactionGroup) => sum + g.totalAmount, 0);
  const totalBamAmount = bamGroupedData.reduce((sum: number, g: TransactionGroup) => sum + g.totalAmount, 0);

  // Helper komponenta za renderovanje sekcije po valuti
  // Priprema grupa za izvoz (redoslijed stavki isti kao u prikazu)
  const toExportGroup = (g: TransactionGroup): ExportGroup => ({
    name: g.name,
    rows: sortByDate(g.transactions, dateOrder, txTime).map((t: Transaction) => ({
      date: t.date,
      reference: t.reference,
      description: t.description,
      debit: t.debit,
      credit: t.credit,
    })),
  });

  const renderCurrencySection = (groups: TransactionGroup[], currency: string, label: string, icon: React.ReactNode) => {
    if (groups.length === 0) return null;
    
    const sectionTotal = groups.reduce((sum, g) => sum + g.totalAmount, 0);
    
    return (
      <div className="space-y-3">
        {/* Currency Section Header */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
          currency === 'EUR' 
            ? 'bg-blue-500/5 border-blue-500/20' 
            : 'bg-green-500/5 border-green-500/20'
        }`}>
          {icon}
          <div>
            <h3 className="text-base font-semibold text-white">{label}</h3>
            <p className="text-xs text-slate-400">
              {groups.length} grupa • {groups.reduce((sum, g) => sum + g.count, 0)} transakcija • {formatCurrency(sectionTotal, currency)}
            </p>
          </div>
          <div className="ml-auto">
            <ExportMenu
              label="Izvezi sve"
              getGroups={() => groups.map(toExportGroup)}
              meta={{ kind: 'Grupa', title: `Grupisane transakcije – ${currency}`, currency }}
            />
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-2">
          {groups.map((group: TransactionGroup) => (
            <div key={group.id} className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden">
              {/* Group Header */}
              <div className="flex items-center pr-3">
              <button
                onClick={() => toggleGroup(`${currency}:${group.id}`)}
                className="flex-1 min-w-0 p-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedGroups.has(`${currency}:${group.id}`) ? (
                    <ChevronDown size={20} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400 shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">{group.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        group.type === 'manual' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {group.type === 'manual' && '📌 Pravilo'}
                        {group.type === 'other' && '❓ Negrupisano'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Hash size={12} />
                        {group.count} transakcija
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {group.firstDate} - {group.lastDate}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold text-white">
                      {formatCurrency(group.totalAmount, currency)}
                    </div>
                    <div className="text-xs text-slate-400">
                      Prosek: {formatCurrency(group.avgAmount, currency)}
                    </div>
                  </div>
                </div>
              </button>
                <ExportMenu
                  getGroups={() => [toExportGroup(group)]}
                  meta={{ kind: 'Grupa', title: `Grupisane transakcije – ${currency}`, currency }}
                />
              </div>
              
              {/* Expanded Transactions */}
              {expandedGroups.has(`${currency}:${group.id}`) && (
                <div className="border-t border-slate-700/30 bg-slate-900/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="text-left p-3 text-slate-400 font-medium">Datum</th>
                          <th className="text-left p-3 text-slate-400 font-medium">Opis</th>
                          <th className="text-right p-3 text-green-400 font-medium">Ulaz</th>
                          <th className="text-right p-3 text-red-400 font-medium">Izlaz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortByDate(group.transactions, dateOrder, txTime).map((t: Transaction, i: number) => (
                          <tr key={i} className="border-t border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                            <td className="p-3 text-slate-300 whitespace-nowrap">{t.date}</td>
                            <td className="p-3 text-white max-w-md truncate" title={t.description}>
                              {t.description}
                            </td>
                            <td className="p-3 text-right font-mono whitespace-nowrap">
                              {t.credit > 0 ? (
                                <span className="text-green-400">+{formatCurrency(t.credit, currency)}</span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono whitespace-nowrap">
                              {t.debit > 0 ? (
                                <span className="text-red-400">-{formatCurrency(t.debit, currency)}</span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900/50 border-t border-slate-700/30">
                        <tr>
                          <td colSpan={2} className="p-3 text-slate-400 font-medium">Ukupno:</td>
                          <td className="p-3 text-right font-mono text-green-400 font-semibold">
                            {formatCurrency(group.totalCredit, currency)}
                          </td>
                          <td className="p-3 text-right font-mono text-red-400 font-semibold">
                            {formatCurrency(group.totalDebit, currency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Hash size={20} className="text-blue-400" />
            Grupisane transakcije
          </h2>
          <p className="text-sm text-slate-400">
            {totalGroups} grupa • {totalTransactions} transakcija
            {eurGroupedData.length > 0 && <span className="text-blue-400"> • EUR: {formatCurrency(totalEurAmount, 'EUR')}</span>}
            {bamGroupedData.length > 0 && <span className="text-green-400"> • BAM: {formatCurrency(totalBamAmount, 'BAM')}</span>}
          </p>
        </div>
        <button
          onClick={() => setShowRulesPanel(!showRulesPanel)}
          className="px-4 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Settings2 size={16} />
          Pravila grupisanja
        </button>
      </div>

      {/* Rules Panel */}
      {showRulesPanel && (
        <GroupingRulesPanel
          rules={manualRules}
          onRulesChange={handleRulesChange}
          onClose={() => setShowRulesPanel(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži grupe ili transakcije..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">Svi tipovi</option>
            <option value="manual">📌 Manuelna pravila</option>
            <option value="other">❓ Negrupisano</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="total">Ukupan iznos</option>
            <option value="count">Broj transakcija</option>
            <option value="avg">Prosečan iznos</option>
            <option value="date">Datum (zadnja stavka)</option>
          </select>

          <DateOrderToggle order={dateOrder} onChange={setDateOrder} label="Stavke" />
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white hover:bg-slate-700/50 transition-colors"
          >
            {sortOrder === 'desc' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
          </button>
        </div>
      </div>

      {/* Expand/Collapse All */}
      <div className="flex gap-2">
        <button
          onClick={expandAll}
          className="px-3 py-1.5 text-xs bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 rounded-lg transition-colors"
        >
          Proširi sve
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-1.5 text-xs bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 rounded-lg transition-colors"
        >
          Skupi sve
        </button>
      </div>

      {/* EUR Section */}
      {renderCurrencySection(
        eurGroupedData, 
        'EUR', 
        'EUR Izvodi',
        <Euro size={24} className="text-blue-400" />
      )}

      {/* BAM Section */}
      {renderCurrencySection(
        bamGroupedData, 
        'BAM', 
        'BAM Izvodi',
        <Banknote size={24} className="text-green-400" />
      )}

      {/* Empty State */}
      {eurGroupedData.length === 0 && bamGroupedData.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Filter size={48} className="mx-auto mb-3 opacity-50" />
          <p>Nema grupa koje odgovaraju filterima</p>
        </div>
      )}
    </div>
  );
}
