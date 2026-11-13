import { useCallback, useState } from 'react';

export type DateOrder = 'asc' | 'desc';

const STORAGE_KEY = 'dateSortOrder';

/** "dd.mm.yyyy" (ili dd.mm.yy) → vrijeme u ms; nepoznat datum ide na početak */
export function parseDMY(value: string | undefined): number {
  const m = value?.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return 0;
  const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(year, Number(m[2]) - 1, Number(m[1])).getTime();
}

/** Vrijeme transakcije: dateObj ako postoji, inače iz teksta datuma */
export function txTime(t: { dateObj?: Date; date?: string }): number {
  const time = t.dateObj instanceof Date ? t.dateObj.getTime() : NaN;
  return Number.isNaN(time) ? parseDMY(t.date) : time;
}

/**
 * Stabilno sortiranje po datumu. Stavke istog dana ostaju u redoslijedu iz izvoda,
 * i kad se bira "najnovije prvo".
 */
export function sortByDate<T>(items: T[], order: DateOrder, getTime: (item: T) => number): T[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => dir * (getTime(a) - getTime(b)));
}

/** Izbor redoslijeda se pamti u pregledniku i vrijedi za sve preglede */
export function useDateOrder(): [DateOrder, (order: DateOrder) => void] {
  const [order, setOrderState] = useState<DateOrder>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'desc' ? 'desc' : 'asc';
    } catch {
      return 'asc';
    }
  });
  const setOrder = useCallback((next: DateOrder) => {
    setOrderState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch { /* ignore */ }
  }, []);
  return [order, setOrder];
}
