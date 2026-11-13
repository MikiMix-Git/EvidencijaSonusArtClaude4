/**
 * Pomoćne funkcije za analize i statistike po periodima
 * (sedmica, mjesec, 3 mjeseca, 6 mjeseci, godina, sve, proizvoljno).
 */

export type PeriodKind = 'week' | 'month' | 'quarter' | 'half' | 'year' | 'all' | 'custom';
export type Granularity = 'day' | 'week' | 'month';
export type Direction = 'expense' | 'income';

export interface DateRange {
  start: Date; // uključivo, lokalna ponoć
  end: Date; // uključivo, lokalna ponoć
}

export interface TxLike {
  dateObj: Date;
  debit: number;
  credit: number;
  description: string;
  category?: string;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
/** Ponedjeljak kao prvi dan sedmice */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

export function addMonths(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), lastDay));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fromInputDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * Raspon perioda koji sadrži datum `anchor`.
 * 3 i 6 mjeseci su prozori koji se završavaju krajem mjeseca u kojem je `anchor`.
 */
export function getRange(kind: PeriodKind, anchor: Date, bounds: DateRange | null, custom: DateRange | null): DateRange {
  switch (kind) {
    case 'week': {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case 'quarter':
      return { start: startOfMonth(addMonths(anchor, -2)), end: endOfMonth(anchor) };
    case 'half':
      return { start: startOfMonth(addMonths(anchor, -5)), end: endOfMonth(anchor) };
    case 'year':
      return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear(), 11, 31) };
    case 'all':
      return bounds ?? { start: startOfDay(anchor), end: startOfDay(anchor) };
    case 'custom':
      return custom ?? { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
}

export function shiftAnchor(kind: PeriodKind, anchor: Date, dir: -1 | 1): Date {
  switch (kind) {
    case 'week': return addDays(anchor, 7 * dir);
    case 'month': return addMonths(anchor, dir);
    case 'quarter': return addMonths(anchor, 3 * dir);
    case 'half': return addMonths(anchor, 6 * dir);
    case 'year': return addMonths(anchor, 12 * dir);
    default: return anchor;
  }
}

/** Prethodni period iste dužine (za poređenje) */
export function getPreviousRange(kind: PeriodKind, anchor: Date, range: DateRange): DateRange {
  if (kind === 'all' || kind === 'custom') {
    const len = daysBetween(range.start, range.end) + 1;
    return { start: addDays(range.start, -len), end: addDays(range.start, -1) };
  }
  return getRange(kind, shiftAnchor(kind, anchor, -1), null, null);
}

export function inRange<T extends { dateObj: Date }>(txs: T[], range: DateRange): T[] {
  const s = range.start.getTime();
  const e = addDays(range.end, 1).getTime(); // kraj uključivo
  return txs.filter((t) => {
    const x = startOfDay(t.dateObj).getTime();
    return x >= s && x < e;
  });
}

export function autoGranularity(range: DateRange): Granularity {
  const days = daysBetween(range.start, range.end) + 1;
  if (days <= 45) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

export interface SeriesPoint {
  key: number;
  label: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
}

export function buildTimeSeries(txs: TxLike[], range: DateRange, gran: Granularity): SeriesPoint[] {
  const bucketStart = (d: Date) =>
    gran === 'day' ? startOfDay(d) : gran === 'week' ? startOfWeek(d) : startOfMonth(d);
  const next = (d: Date) => (gran === 'day' ? addDays(d, 1) : gran === 'week' ? addDays(d, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const points = new Map<number, SeriesPoint>();
  let cursor = bucketStart(range.start);
  let guard = 0;
  while (cursor.getTime() <= range.end.getTime() && guard++ < 1000) {
    const shown = cursor.getTime() < range.start.getTime() ? range.start : cursor;
    const label =
      gran === 'month'
        ? `${MONTHS_SHORT[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`
        : `${String(shown.getDate()).padStart(2, '0')}.${String(shown.getMonth() + 1).padStart(2, '0')}.`;
    points.set(cursor.getTime(), { key: cursor.getTime(), label, income: 0, expense: 0, net: 0, cumulative: 0 });
    cursor = next(cursor);
  }

  for (const t of txs) {
    const p = points.get(bucketStart(t.dateObj).getTime());
    if (!p) continue;
    p.income += t.credit;
    p.expense += t.debit;
  }

  let running = 0;
  const result = Array.from(points.values()).sort((a, b) => a.key - b.key);
  for (const p of result) {
    p.income = round2(p.income);
    p.expense = round2(p.expense);
    p.net = round2(p.income - p.expense);
    running += p.net;
    p.cumulative = round2(running);
  }
  return result;
}

export interface PeriodStats {
  income: number;
  expense: number;
  net: number;
  count: number;
  incomeCount: number;
  expenseCount: number;
  days: number;
  activeDays: number;
  avgDailyExpense: number;
  avgExpense: number;
  medianExpense: number;
  maxExpense: TxLike | null;
  maxIncome: TxLike | null;
  savingsRate: number | null; // (prilivi - odlivi) / prilivi u %
}

export function computeStats(txs: TxLike[], range: DateRange): PeriodStats {
  const expenses = txs.filter((t) => t.debit > 0);
  const incomes = txs.filter((t) => t.credit > 0);
  const income = incomes.reduce((s, t) => s + t.credit, 0);
  const expense = expenses.reduce((s, t) => s + t.debit, 0);
  const days = Math.max(1, daysBetween(range.start, range.end) + 1);
  const sorted = expenses.map((t) => t.debit).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    income: round2(income),
    expense: round2(expense),
    net: round2(income - expense),
    count: txs.length,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    days,
    activeDays: new Set(txs.map((t) => startOfDay(t.dateObj).getTime())).size,
    avgDailyExpense: round2(expense / days),
    avgExpense: expenses.length ? round2(expense / expenses.length) : 0,
    medianExpense: round2(median),
    maxExpense: expenses.reduce<TxLike | null>((m, t) => (!m || t.debit > m.debit ? t : m), null),
    maxIncome: incomes.reduce<TxLike | null>((m, t) => (!m || t.credit > m.credit ? t : m), null),
    savingsRate: income > 0 ? round2(((income - expense) / income) * 100) : null,
  };
}

export interface BreakdownItem {
  name: string;
  value: number;
  count: number;
}

/** Zbir po ključevima (kategorija, grupa, tag...). Jedna transakcija može imati više ključeva (tagovi). */
export function sumBy<T extends TxLike>(txs: T[], keysOf: (t: T) => string[], direction: Direction): BreakdownItem[] {
  const map = new Map<string, BreakdownItem>();
  for (const t of txs) {
    const amount = direction === 'expense' ? t.debit : t.credit;
    if (amount <= 0) continue;
    for (const key of keysOf(t)) {
      const item = map.get(key) ?? { name: key, value: 0, count: 0 };
      item.value += amount;
      item.count += 1;
      map.set(key, item);
    }
  }
  return Array.from(map.values())
    .map((i) => ({ ...i, value: round2(i.value) }))
    .sort((a, b) => b.value - a.value);
}

const WEEKDAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

/** Prosječan odliv po danu u sedmici (zbir / broj tih dana u periodu) */
export function weekdayStats(txs: TxLike[], range: DateRange) {
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const t of txs) {
    if (t.debit > 0) {
      totals[(t.dateObj.getDay() + 6) % 7] += t.debit;
      counts[(t.dateObj.getDay() + 6) % 7] += 1;
    }
  }
  const occurrences = Array(7).fill(0);
  const total = daysBetween(range.start, range.end) + 1;
  for (let i = 0; i < total; i++) occurrences[(addDays(range.start, i).getDay() + 6) % 7]++;

  return WEEKDAYS.map((name, i) => ({
    name,
    total: round2(totals[i]),
    average: occurrences[i] ? round2(totals[i] / occurrences[i]) : 0,
    count: counts[i],
  }));
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
