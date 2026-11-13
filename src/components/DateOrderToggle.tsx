import { ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';
import type { DateOrder } from '../utils/dateSort';

interface DateOrderToggleProps {
  order: DateOrder;
  onChange: (order: DateOrder) => void;
  label?: string;
}

/** Prekidač hronološkog redoslijeda po datumu: najstarije prvo ↔ najnovije prvo */
export function DateOrderToggle({ order, onChange, label = 'Datum' }: DateOrderToggleProps) {
  const next: DateOrder = order === 'asc' ? 'desc' : 'asc';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={order === 'asc' ? 'Sortirano od najstarijeg. Klik za najnovije prvo.' : 'Sortirano od najnovijeg. Klik za najstarije prvo.'}
      className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white hover:bg-slate-700/50 transition-colors flex items-center gap-2"
    >
      {order === 'asc' ? <ArrowUpNarrowWide size={16} /> : <ArrowDownNarrowWide size={16} />}
      <span>{label}: {order === 'asc' ? 'najstarije prvo' : 'najnovije prvo'}</span>
    </button>
  );
}
