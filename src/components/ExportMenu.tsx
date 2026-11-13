import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import {
  ExportGroup, ExportMeta, downloadCSV, downloadPDF, filterGroupsByRange, rowsBounds,
} from '../utils/exportGroups';
import { addDays, addMonths, formatDate, fromInputDate, toInputDate } from '../utils/analytics';

interface ExportMenuProps {
  /** Poziva se tek kad se meni otvori ili izvoz pokrene (da se ne računa za svaku grupu pri renderu) */
  getGroups: () => ExportGroup[];
  meta: ExportMeta;
  label?: string;
}

type Preset = 'all' | 'week' | 'month' | 'quarter' | 'half' | 'year' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'all', label: 'Sve' },
  { id: 'week', label: 'Zadnja sedmica' },
  { id: 'month', label: 'Zadnji mjesec' },
  { id: 'quarter', label: 'Zadnja 3 mjeseca' },
  { id: 'half', label: 'Zadnjih 6 mjeseci' },
  { id: 'year', label: 'Zadnja godina' },
];

/** Dugme "Izvezi" sa izborom vremenskog perioda i formata (CSV / PDF) */
export function ExportMenu({ getGroups, meta, label }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [groups, setGroups] = useState<ExportGroup[]>([]);
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => rowsBounds(groups), [groups]);

  const openMenu = () => {
    const data = getGroups();
    const b = rowsBounds(data);
    setGroups(data);
    setPreset('all');
    setFrom(b ? toInputDate(b.start) : '');
    setTo(b ? toInputDate(b.end) : '');
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 320;
      setPos({
        top: Math.min(rect.bottom + 6, window.innerHeight - 380),
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  // Zatvori klikom van panela, Esc-om, skrolom ili promjenom veličine prozora
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const applyPreset = (id: Preset) => {
    setPreset(id);
    if (!bounds) return;
    const end = bounds.end;
    const start =
      id === 'all' ? bounds.start
      : id === 'week' ? addDays(end, -6)
      : id === 'month' ? addDays(addMonths(end, -1), 1)
      : id === 'quarter' ? addDays(addMonths(end, -3), 1)
      : id === 'half' ? addDays(addMonths(end, -6), 1)
      : addDays(addMonths(end, -12), 1);
    setFrom(toInputDate(id === 'all' ? bounds.start : start));
    setTo(toInputDate(end));
  };

  const fromDate = fromInputDate(from);
  const toDate = fromInputDate(to);
  const validRange = fromDate && toDate && fromDate <= toDate;
  const isAll = !!bounds && !!validRange && fromDate!.getTime() <= bounds.start.getTime() && toDate!.getTime() >= bounds.end.getTime();
  const range = validRange ? { start: fromDate!, end: toDate! } : null;

  const totalCount = groups.reduce((s, g) => s + g.rows.length, 0);
  const filtered = useMemo(() => (range ? filterGroupsByRange(groups, range) : []), [groups, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredCount = filtered.reduce((s, g) => s + g.rows.length, 0);

  const run = async (format: 'csv' | 'pdf') => {
    if (!range || filteredCount === 0) return;
    const finalMeta: ExportMeta = { ...meta, range: isAll ? null : range };
    if (format === 'csv') {
      downloadCSV(filtered, finalMeta);
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await downloadPDF(filtered, finalMeta);
      setOpen(false);
    } catch (err) {
      console.error('Greška pri izvozu PDF-a:', err);
      alert('Izvoz u PDF nije uspio. Pogledajte konzolu za detalje.');
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `px-2 py-1 rounded-md text-xs transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'}`;
  const dateInput = 'w-full bg-slate-900 border border-slate-600/60 rounded-md px-2 py-1 text-sm text-white';

  return (
    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      {label && <span className="text-xs text-slate-400 mr-1">{label}</span>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="px-2.5 py-1 bg-slate-700/50 hover:bg-slate-600/60 text-slate-200 text-xs rounded-md flex items-center gap-1.5 transition-colors"
        title="Izvezi u CSV ili PDF, uz izbor perioda"
      >
        <Download size={13} /> Izvezi
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 320, zIndex: 1000 }}
          className="bg-slate-800 border border-slate-600/60 rounded-xl shadow-2xl p-4 space-y-3 text-left"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Izvoz — izaberite period</h4>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
          </div>

          {!bounds ? (
            <p className="text-sm text-slate-400">Nema stavki za izvoz.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className={chip(preset === p.id)}>{p.label}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400 space-y-1">
                  Od
                  <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); }} className={dateInput} />
                </label>
                <label className="text-xs text-slate-400 space-y-1">
                  Do
                  <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset('custom'); }} className={dateInput} />
                </label>
              </div>

              <p className="text-xs text-slate-500">
                Podaci postoje za {formatDate(bounds.start)} – {formatDate(bounds.end)}.
              </p>

              {!validRange ? (
                <p className="text-xs text-red-400">Unesite ispravan period (Od ne smije biti poslije Do).</p>
              ) : (
                <p className={`text-xs ${filteredCount === 0 ? 'text-red-400' : 'text-slate-300'}`}>
                  {filteredCount === 0 ? 'Nema stavki u izabranom periodu.' : `U izabranom periodu: ${filteredCount} od ${totalCount} stavki.`}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={!validRange || filteredCount === 0 || busy}
                  onClick={() => run('csv')}
                  className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <FileSpreadsheet size={15} /> CSV
                </button>
                <button
                  type="button"
                  disabled={!validRange || filteredCount === 0 || busy}
                  onClick={() => run('pdf')}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} PDF
                </button>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
