import { useState, useMemo } from 'react';
import { Transaction, formatCurrency } from '../utils/BankStatementParser';
import { BankStatement } from '../types/BankStatement';
import { GroupingRule, parseTags } from '../types/GroupingRule';
import { tagTransactionsWithRules, groupByTags, filterTagGroups, TagGroup } from '../utils/tagExtractor';
import { DateOrderToggle } from './DateOrderToggle';
import { useDateOrder, sortByDate, txTime, parseDMY } from '../utils/dateSort';
import { ExportMenu } from './ExportMenu';
import type { ExportGroup } from '../utils/exportGroups';
import { Search, Filter, TrendingUp, TrendingDown, Hash, Tag, X, ChevronDown, ChevronRight, Euro, Banknote } from 'lucide-react';

interface GroupedByTagsProps {
  statements: BankStatement[];
  rules: GroupingRule[];
}

export function GroupedByTags({ statements, rules: manualRules }: GroupedByTagsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'total' | 'count' | 'avg' | 'debit' | 'credit' | 'date'>('total');
  const [dateOrder, setDateOrder] = useDateOrder();
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  
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

  // Taguj i grupiši EUR transakcije
  const eurTaggedTransactions = useMemo(
    () => tagTransactionsWithRules(eurTransactions, manualRules),
    [eurTransactions, manualRules]
  );
  const eurAllGroups = useMemo(() => groupByTags(eurTaggedTransactions), [eurTaggedTransactions]);
  
  // Taguj i grupiši BAM transakcije
  const bamTaggedTransactions = useMemo(
    () => tagTransactionsWithRules(bamTransactions, manualRules),
    [bamTransactions, manualRules]
  );
  const bamAllGroups = useMemo(() => groupByTags(bamTaggedTransactions), [bamTaggedTransactions]);

  // Filtriraj po pretrazi
  const eurFilteredGroups = useMemo(
    () => filterTagGroups(eurAllGroups, searchTerm),
    [eurAllGroups, searchTerm]
  );
  const bamFilteredGroups = useMemo(
    () => filterTagGroups(bamAllGroups, searchTerm),
    [bamAllGroups, searchTerm]
  );

  // Sortiraj
  const sortGroups = (groups: TagGroup[]): TagGroup[] => {
    return [...groups].sort((a, b) => {
      switch (sortBy) {
        case 'total': return b.totalAmount - a.totalAmount;
        case 'count': return b.count - a.count;
        case 'avg': return b.avgAmount - a.avgAmount;
        case 'debit': return b.totalDebit - a.totalDebit;
        case 'credit': return b.totalCredit - a.totalCredit;
        case 'date': {
          // po datumu zadnje stavke u grupi; smjer određuje prekidač "Stavke"
          const last = (g: TagGroup) => Math.max(...g.transactions.map(txTime));
          return (dateOrder === 'asc' ? 1 : -1) * (last(a) - last(b));
        }
        default: return 0;
      }
    });
  };

  const eurSortedGroups = useMemo(() => sortGroups(eurFilteredGroups), [eurFilteredGroups, sortBy, dateOrder]);
  const bamSortedGroups = useMemo(() => sortGroups(bamFilteredGroups), [bamFilteredGroups, sortBy, dateOrder]);

  const toggleTag = (tagName: string) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tagName)) {
      newExpanded.delete(tagName);
    } else {
      newExpanded.add(tagName);
    }
    setExpandedTags(newExpanded);
  };

  const expandAll = () => {
    const allTags = [
      ...eurSortedGroups.map(g => `EUR:${g.tag.name}`),
      ...bamSortedGroups.map(g => `BAM:${g.tag.name}`),
    ];
    setExpandedTags(new Set(allTags));
  };

  const collapseAll = () => {
    setExpandedTags(new Set());
  };

  // Render helper za sekciju po valuti
  // Priprema grupa za izvoz (redoslijed stavki isti kao u prikazu)
  const toExportGroup = (g: TagGroup): ExportGroup => ({
    name: g.tag.name,
    rows: sortByDate(g.transactions, dateOrder, txTime).map((t: Transaction) => ({
      date: t.date,
      reference: t.reference,
      description: t.description,
      debit: t.debit,
      credit: t.credit,
    })),
  });

  const renderCurrencySection = (
    groups: TagGroup[],
    currency: string,
    label: string,
    icon: React.ReactNode
  ) => {
    if (groups.length === 0) return null;
    
    const sectionTotal = groups.reduce((sum: number, g: TagGroup) => sum + g.totalAmount, 0);
    
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
              {groups.length} tagova • {groups.reduce((sum: number, g: TagGroup) => sum + g.count, 0)} transakcija • {formatCurrency(sectionTotal, currency)}
            </p>
          </div>
          <div className="ml-auto">
            <ExportMenu
              label="Izvezi sve"
              getGroups={() => groups.map(toExportGroup)}
              meta={{ kind: 'Tag', title: `Grupisano po tagovima – ${currency}`, currency }}
            />
          </div>
        </div>

        {/* Tag Groups */}
        <div className="space-y-2">
          {groups.map((group: TagGroup) => (
            <div key={group.tag.name} className="bg-slate-800/50 border border-slate-700/30 rounded-xl overflow-hidden">
              {/* Tag Header */}
              <div className="flex items-center pr-3">
              <button
                onClick={() => toggleTag(`${currency}:${group.tag.name}`)}
                className="flex-1 min-w-0 p-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {expandedTags.has(`${currency}:${group.tag.name}`) ? (
                    <ChevronDown size={20} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400 shrink-0" />
                  )}
                  
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.tag.color }}
                  />
                  
                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-semibold text-white">{group.tag.name}</span>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Hash size={12} />
                        {group.count} transakcija
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
                  meta={{ kind: 'Tag', title: `Grupisano po tagovima – ${currency}`, currency }}
                />
              </div>
              
              {/* Expanded Transactions */}
              {expandedTags.has(`${currency}:${group.tag.name}`) && (
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

  const totalEurTags = eurSortedGroups.length;
  const totalBamTags = bamSortedGroups.length;
  const totalEurTransactions = eurSortedGroups.reduce((sum: number, g: TagGroup) => sum + g.count, 0);
  const totalBamTransactions = bamSortedGroups.reduce((sum: number, g: TagGroup) => sum + g.count, 0);
  const totalEurAmount = eurSortedGroups.reduce((sum: number, g: TagGroup) => sum + g.totalAmount, 0);
  const totalBamAmount = bamSortedGroups.reduce((sum: number, g: TagGroup) => sum + g.totalAmount, 0);

  // Proveri da li ima pravila sa tagovima
  const rulesWithTags = manualRules.filter(r => parseTags(r.tag).length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Tag size={20} className="text-purple-400" />
          Grupisano po tagovima
        </h2>
        <p className="text-sm text-slate-400">
          {totalEurTags + totalBamTags} tagova • {totalEurTransactions + totalBamTransactions} transakcija
          {totalEurTransactions > 0 && <span className="text-blue-400"> • EUR: {formatCurrency(totalEurAmount, 'EUR')}</span>}
          {totalBamTransactions > 0 && <span className="text-green-400"> • BAM: {formatCurrency(totalBamAmount, 'BAM')}</span>}
        </p>
      </div>

      {/* Upozorenje ako nema pravila sa tagovima */}
      {rulesWithTags.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
          <p className="font-medium mb-1">⚠️ Nema pravila sa tagovima</p>
          <p className="text-amber-400/80">
            Da biste videli grupisanje po tagovima, dodajte tag uz pravila u panelu "Pravila grupisanja" 
            (na tabu "Grupisano po opisu").
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži tagove ili transakcije..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="total">Ukupan iznos</option>
            <option value="count">Broj transakcija</option>
            <option value="avg">Prosečan iznos</option>
            <option value="debit">Ukupno odlivi</option>
            <option value="credit">Ukupno prilivi</option>
            <option value="date">Datum (zadnja stavka)</option>
          </select>
          <DateOrderToggle order={dateOrder} onChange={setDateOrder} label="Stavke" />
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
        eurSortedGroups,
        'EUR',
        'EUR Tagovi',
        <Euro size={24} className="text-blue-400" />
      )}

      {/* BAM Section */}
      {renderCurrencySection(
        bamSortedGroups,
        'BAM',
        'BAM Tagovi',
        <Banknote size={24} className="text-green-400" />
      )}

      {/* Empty State */}
      {eurSortedGroups.length === 0 && bamSortedGroups.length === 0 && rulesWithTags.length > 0 && (
        <div className="text-center py-12 text-slate-400">
          <Filter size={48} className="mx-auto mb-3 opacity-50" />
          <p>Nema tagova koje odgovaraju filterima</p>
        </div>
      )}
    </div>
  );
}
