import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Line, Area, AreaChart, Legend,
} from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Receipt, CalendarDays, Percent } from 'lucide-react';
import { BankStatement } from '../types/BankStatement';
import { Transaction, formatCurrency } from '../utils/BankStatementParser';
import { GroupingRule, applyRules } from '../types/GroupingRule';
import { tagTransactionsWithRules } from '../utils/tagExtractor';
import {
  PeriodKind, Granularity, Direction, DateRange,
  getRange, shiftAnchor, getPreviousRange, inRange, autoGranularity, buildTimeSeries, computeStats,
  sumBy, weekdayStats, percentChange, formatDate, toInputDate, fromInputDate, startOfDay, addDays,
} from '../utils/analytics';

interface AnalyticsViewProps {
  statements: BankStatement[];
  rules: GroupingRule[];
}

type ChartId = 'flow' | 'cumulative' | 'categories' | 'groups' | 'tags' | 'weekday' | 'compare';

const PERIODS: { id: PeriodKind; label: string }[] = [
  { id: 'week', label: 'Sedmica' },
  { id: 'month', label: 'Mjesec' },
  { id: 'quarter', label: '3 mjeseca' },
  { id: 'half', label: '6 mjeseci' },
  { id: 'year', label: 'Godina' },
  { id: 'all', label: 'Sve' },
  { id: 'custom', label: 'Proizvoljno' },
];

const CHARTS: { id: ChartId; label: string }[] = [
  { id: 'flow', label: 'Prilivi i odlivi' },
  { id: 'cumulative', label: 'Kumulativni tok' },
  { id: 'categories', label: 'Po kategorijama' },
  { id: 'groups', label: 'Po grupama (pravila)' },
  { id: 'tags', label: 'Po tagovima' },
  { id: 'weekday', label: 'Po danima u sedmici' },
  { id: 'compare', label: 'Poređenje s prethodnim' },
];

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6'];
const INCOME = '#10b981';
const EXPENSE = '#ef4444';
const NET = '#3b82f6';

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) % 1000 === 0 ? 0 : 1)}k` : String(v));

const Tip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-sm text-slate-300 mb-1">{label ?? payload[0]?.payload?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-mono" style={{ color: p.color || p.payload?.fill }}>
          {p.name}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  );
};

const Card = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-5">
    <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
      <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </div>
    {children}
  </div>
);

const Delta = ({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) => {
  const change = percentChange(cur, prev);
  if (change === null) return <span className="text-xs text-slate-500">nema poređenja</span>;
  const good = inverse ? change <= 0 : change >= 0;
  return (
    <span className={`text-xs ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {change > 0 ? '▲' : change < 0 ? '▼' : '■'} {Math.abs(change).toFixed(1)}% vs prethodni
    </span>
  );
};

export function AnalyticsView({ statements, rules }: AnalyticsViewProps) {
  // Valute poredane po broju transakcija (prva je izabrana po defaultu)
  const currencies = useMemo(() => {
    const counts = new Map<string, number>();
    statements.forEach((s) => counts.set(s.summary.currency, (counts.get(s.summary.currency) ?? 0) + s.summary.transactions.length));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  }, [statements]);
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const currency = currencyChoice && currencies.includes(currencyChoice) ? currencyChoice : currencies[0] ?? 'EUR';

  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchorOverride, setAnchorOverride] = useState<Date | null>(null);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [granularity, setGranularity] = useState<'auto' | Granularity>('auto');
  const [direction, setDirection] = useState<Direction>('expense');
  const [excludeConversions, setExcludeConversions] = useState(false);
  const [selected, setSelected] = useState<ChartId[]>(['flow', 'categories']);

  // Sve transakcije u izabranoj valuti
  const allTx = useMemo<Transaction[]>(() => {
    return statements
      .filter((s) => s.summary.currency === currency)
      .flatMap((s) => s.summary.transactions)
      .filter((t) => !excludeConversions || t.category !== 'Konverzija');
  }, [statements, currency, excludeConversions]);

  const bounds = useMemo<DateRange | null>(() => {
    if (allTx.length === 0) return null;
    let min = allTx[0].dateObj;
    let max = allTx[0].dateObj;
    for (const t of allTx) {
      if (t.dateObj < min) min = t.dateObj;
      if (t.dateObj > max) max = t.dateObj;
    }
    return { start: startOfDay(min), end: startOfDay(max) };
  }, [allTx]);

  // Sidro perioda: zadnji datum sa podacima (izvodi su obično iz prošlosti)
  const anchor = anchorOverride ?? bounds?.end ?? new Date();

  const custom = useMemo<DateRange | null>(() => {
    const s = fromInputDate(customStart) ?? (bounds ? addDays(bounds.end, -29) : null);
    const e = fromInputDate(customEnd) ?? bounds?.end ?? null;
    return s && e && s <= e ? { start: s, end: e } : null;
  }, [customStart, customEnd, bounds]);

  const range = useMemo(() => getRange(kind, anchor, bounds, custom), [kind, anchor, bounds, custom]);
  const prevRange = useMemo(() => getPreviousRange(kind, anchor, range), [kind, anchor, range]);

  const txs = useMemo(() => inRange(allTx, range), [allTx, range]);
  const prevTxs = useMemo(() => inRange(allTx, prevRange), [allTx, prevRange]);
  const stats = useMemo(() => computeStats(txs, range), [txs, range]);
  const prevStats = useMemo(() => computeStats(prevTxs, prevRange), [prevTxs, prevRange]);

  const gran: Granularity = granularity === 'auto' ? autoGranularity(range) : granularity;
  const series = useMemo(() => buildTimeSeries(txs, range, gran), [txs, range, gran]);

  const categoryData = useMemo(() => sumBy(txs, (t) => [t.category || 'Ostalo'], direction), [txs, direction]);
  const groupData = useMemo(
    () => sumBy(txs, (t) => [applyRules(t.description, rules)?.groupName || 'Negrupisano'], direction),
    [txs, rules, direction]
  );
  const tagData = useMemo(() => {
    const tagged = tagTransactionsWithRules(txs, rules);
    return sumBy(tagged, (t) => (t.tags && t.tags.length > 0 ? t.tags.map((x) => x.name) : ['Bez taga']), direction);
  }, [txs, rules, direction]);
  const weekdayData = useMemo(() => weekdayStats(txs, range), [txs, range]);

  const topExpenses = useMemo(() => [...txs].filter((t) => t.debit > 0).sort((a, b) => b.debit - a.debit).slice(0, 5), [txs]);
  const topIncomes = useMemo(() => [...txs].filter((t) => t.credit > 0).sort((a, b) => b.credit - a.credit).slice(0, 5), [txs]);

  const money = (v: number) => formatCurrency(v, currency);
  const dirLabel = direction === 'expense' ? 'Odlivi' : 'Prilivi';
  const dirColor = direction === 'expense' ? EXPENSE : INCOME;

  const toggleChart = (id: ChartId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const move = (dir: -1 | 1) => setAnchorOverride(shiftAnchor(kind, anchor, dir));
  const changeKind = (k: PeriodKind) => {
    if (k === 'custom' && !customStart && bounds) {
      setCustomStart(toInputDate(addDays(bounds.end, -29)));
      setCustomEnd(toInputDate(bounds.end));
    }
    setKind(k);
  };

  if (currencies.length === 0) {
    return <div className="text-slate-400 text-center py-16">Nema podataka za analizu. Učitajte bankovne izvode.</div>;
  }

  const renderBreakdown = (id: string, data: ReturnType<typeof sumBy>, title: string) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (data.length === 0) return <Card key={id} title={title}><p className="text-sm text-slate-500">Nema podataka u ovom periodu.</p></Card>;
    const top = data.slice(0, 12);
    return (
      <Card key={id} title={title} note={`Ukupno: ${money(total)}`}>
        <div style={{ height: Math.max(220, top.length * 30 + 20) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={compact} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={140} />
              <Tooltip content={<Tip currency={currency} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="value" name={dirLabel} fill={dirColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.length > top.length && (
          <p className="text-xs text-slate-500 mt-2">Prikazano prvih {top.length} od {data.length}.</p>
        )}
      </Card>
    );
  };

  const renderChart = (id: ChartId) => {
    switch (id) {
      case 'flow':
        return (
          <Card key={id} title="Prilivi i odlivi kroz vrijeme" note={`Prikaz po: ${gran === 'day' ? 'danu' : gran === 'week' ? 'sedmici' : 'mjesecu'}`}>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={compact} />
                  <Tooltip content={<Tip currency={currency} />} />
                  <Legend />
                  <Bar dataKey="income" name="Prilivi" fill={INCOME} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Odlivi" fill={EXPENSE} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="Neto" stroke={NET} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      case 'cumulative':
        return (
          <Card key={id} title="Kumulativni neto tok" note="Zbir (prilivi − odlivi) od početka perioda">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={compact} />
                  <Tooltip content={<Tip currency={currency} />} />
                  <Area type="monotone" dataKey="cumulative" name="Kumulativno" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      case 'categories': {
        const total = categoryData.reduce((s, d) => s + d.value, 0);
        return (
          <Card key={id} title={`${dirLabel} po kategorijama`} note={`Ukupno: ${money(total)}`}>
            {categoryData.length === 0 ? (
              <p className="text-sm text-slate-500">Nema podataka u ovom periodu.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<Tip currency={currency} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {categoryData.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-300 truncate flex-1">{c.name}</span>
                      <span className="text-slate-500 text-xs">{total ? ((c.value / total) * 100).toFixed(1) : 0}%</span>
                      <span className="font-mono text-slate-200 text-xs">{money(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      }
      case 'groups':
        return renderBreakdown(id, groupData, `${dirLabel} po grupama (pravila grupisanja)`);
      case 'tags':
        return renderBreakdown(id, tagData, `${dirLabel} po tagovima`);
      case 'weekday':
        return (
          <Card key={id} title="Prosječan odliv po danu u sedmici" note="Zbir odliva / broj tih dana u periodu">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={compact} />
                  <Tooltip content={<Tip currency={currency} />} />
                  <Bar dataKey="average" name="Prosjek" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      case 'compare': {
        const data = [
          { name: 'Prilivi', current: stats.income, previous: prevStats.income },
          { name: 'Odlivi', current: stats.expense, previous: prevStats.expense },
          { name: 'Neto', current: stats.net, previous: prevStats.net },
        ];
        return (
          <Card key={id} title="Poređenje s prethodnim periodom" note={`${formatDate(prevRange.start)} – ${formatDate(prevRange.end)}`}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={compact} />
                  <Tooltip content={<Tip currency={currency} />} />
                  <Legend />
                  <Bar dataKey="current" name="Izabrani period" fill={NET} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name="Prethodni period" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        );
      }
    }
  };

  const btn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'}`;

  const empty = txs.length === 0;

  return (
    <div className="space-y-6">
      {/* Kontrole */}
      <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => changeKind(p.id)} className={btn(kind === p.id)}>{p.label}</button>
          ))}
          {currencies.length > 1 && (
            <div className="ml-auto flex gap-2">
              {currencies.map((c) => (
                <button key={c} onClick={() => setCurrencyChoice(c)} className={btn(currency === c)}>{c}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {kind === 'custom' ? (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1 text-white" />
              <span>–</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1 text-white" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => move(-1)} disabled={kind === 'all'} className="p-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Prethodni period">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-white min-w-[210px] text-center">
                {formatDate(range.start)} – {formatDate(range.end)}
              </span>
              <button onClick={() => move(1)} disabled={kind === 'all'} className="p-1.5 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Sljedeći period">
                <ChevronRight size={16} />
              </button>
              {bounds && kind !== 'all' && (
                <button onClick={() => setAnchorOverride(null)} className="text-xs text-blue-400 hover:text-blue-300 ml-1">
                  Zadnji period s podacima
                </button>
              )}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <label className="flex items-center gap-2">
              Prikaz po
              <select value={granularity} onChange={(e) => setGranularity(e.target.value as any)}
                className="bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1 text-white">
                <option value="auto">Automatski</option>
                <option value="day">Danu</option>
                <option value="week">Sedmici</option>
                <option value="month">Mjesecu</option>
              </select>
            </label>
            <label className="flex items-center gap-2 cursor-pointer" title="Konverzije valuta se u jednoj valuti vide kao odliv, a u drugoj kao priliv">
              <input type="checkbox" checked={excludeConversions} onChange={(e) => setExcludeConversions(e.target.checked)} />
              Isključi konverzije valuta
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/30 pt-3">
          <span className="text-xs text-slate-500 mr-1">Grafikoni:</span>
          {CHARTS.map((c) => (
            <button key={c.id} onClick={() => toggleChart(c.id)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${selected.includes(c.id) ? 'bg-purple-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}>
              {c.label}
            </button>
          ))}
          {selected.some((s) => s === 'categories' || s === 'groups' || s === 'tags') && (
            <div className="ml-auto flex gap-1">
              <button onClick={() => setDirection('expense')} className={btn(direction === 'expense')}>Odlivi</button>
              <button onClick={() => setDirection('income')} className={btn(direction === 'income')}>Prilivi</button>
            </div>
          )}
        </div>
      </div>

      {empty ? (
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-10 text-center text-slate-400 space-y-2">
          <p>Nema transakcija u periodu {formatDate(range.start)} – {formatDate(range.end)} ({currency}).</p>
          {bounds && (
            <p className="text-sm">
              Podaci postoje za {formatDate(bounds.start)} – {formatDate(bounds.end)}.{' '}
              <button onClick={() => setAnchorOverride(null)} className="text-blue-400 hover:text-blue-300">Idi na zadnji period s podacima</button>
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Statistike */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><TrendingUp size={14} className="text-emerald-400" /> Prilivi</div>
              <div className="text-lg font-mono text-emerald-400">{money(stats.income)}</div>
              <Delta cur={stats.income} prev={prevStats.income} />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><TrendingDown size={14} className="text-red-400" /> Odlivi</div>
              <div className="text-lg font-mono text-red-400">{money(stats.expense)}</div>
              <Delta cur={stats.expense} prev={prevStats.expense} inverse />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Wallet size={14} className="text-blue-400" /> Neto</div>
              <div className={`text-lg font-mono ${stats.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{money(stats.net)}</div>
              <Delta cur={stats.net} prev={prevStats.net} />
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Receipt size={14} className="text-purple-400" /> Transakcija</div>
              <div className="text-lg font-mono text-white">{stats.count}</div>
              <span className="text-xs text-slate-500">{stats.incomeCount} priliva • {stats.expenseCount} odliva</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><CalendarDays size={14} className="text-amber-400" /> Prosječan odliv / dan</div>
              <div className="text-lg font-mono text-white">{money(stats.avgDailyExpense)}</div>
              <span className="text-xs text-slate-500">{stats.days} dana u periodu, {stats.activeDays} s prometom</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">Prosječan / medijan odliv</div>
              <div className="text-lg font-mono text-white">{money(stats.avgExpense)}</div>
              <span className="text-xs text-slate-500">medijan {money(stats.medianExpense)}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">Najveći odliv</div>
              <div className="text-lg font-mono text-red-400">{stats.maxExpense ? money(stats.maxExpense.debit) : '—'}</div>
              <span className="text-xs text-slate-500">{stats.maxExpense ? formatDate(stats.maxExpense.dateObj) : ''}</span>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Percent size={14} className="text-cyan-400" /> Stopa uštede</div>
              <div className={`text-lg font-mono ${stats.savingsRate !== null && stats.savingsRate < 0 ? 'text-red-400' : 'text-white'}`}>
                {stats.savingsRate === null ? '—' : `${stats.savingsRate.toFixed(1)}%`}
              </div>
              <span className="text-xs text-slate-500">(prilivi − odlivi) / prilivi</span>
            </div>
          </div>

          {/* Izabrani grafikoni */}
          {selected.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Izaberite bar jedan grafikon iznad.</p>
          ) : (
            <div className="space-y-6">{CHARTS.filter((c) => selected.includes(c.id)).map((c) => renderChart(c.id))}</div>
          )}

          {/* Najveće transakcije */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[{ title: 'Najveći odlivi', list: topExpenses, field: 'debit' as const, color: 'text-red-400' },
              { title: 'Najveći prilivi', list: topIncomes, field: 'credit' as const, color: 'text-emerald-400' }].map((block) => (
              <Card key={block.title} title={block.title}>
                {block.list.length === 0 ? (
                  <p className="text-sm text-slate-500">Nema transakcija.</p>
                ) : (
                  <div className="space-y-2">
                    {block.list.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 text-sm">
                        <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">{formatDate(t.dateObj)}</span>
                        <span className="text-slate-300 flex-1 line-clamp-2" title={t.description}>{t.description}</span>
                        <span className={`font-mono shrink-0 ${block.color}`}>{money(t[block.field])}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
