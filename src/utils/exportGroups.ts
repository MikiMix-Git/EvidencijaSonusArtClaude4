import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { parseDMY } from './dateSort';
import { formatDate, startOfDay, addDays } from './analytics';

export interface ExportRow {
  date: string;
  reference?: string;
  description: string;
  debit: number;
  credit: number;
}

export interface ExportGroup {
  name: string;
  rows: ExportRow[];
}

export interface ExportMeta {
  /** "Grupa" ili "Tag" */
  kind: 'Grupa' | 'Tag';
  currency: string;
  /** Naslov dokumenta kad se izvozi više grupa odjednom */
  title: string;
  /** Izabrani vremenski period (ako je izvoz ograničen); null = sve */
  range?: { start: Date; end: Date } | null;
}

/** Zadrži samo stavke u periodu (uključivo); prazne grupe se izbacuju */
export function filterGroupsByRange(groups: ExportGroup[], range: { start: Date; end: Date } | null | undefined): ExportGroup[] {
  if (!range) return groups;
  const from = startOfDay(range.start).getTime();
  const to = addDays(startOfDay(range.end), 1).getTime(); // kraj uključivo
  return groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => { const t = parseDMY(r.date); return t >= from && t < to; }) }))
    .filter((g) => g.rows.length > 0);
}

/** Najraniji i najkasniji datum u grupama */
export function rowsBounds(groups: ExportGroup[]): { start: Date; end: Date } | null {
  const times = groups.flatMap((g) => g.rows.map((r) => parseDMY(r.date))).filter((t) => t > 0);
  if (times.length === 0) return null;
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function groupTotals(rows: ExportRow[]) {
  const debit = round2(rows.reduce((s, r) => s + r.debit, 0));
  const credit = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { count: rows.length, debit, credit, net: round2(credit - debit) };
}

function period(groups: ExportGroup[]): string {
  const times = groups.flatMap((g) => g.rows.map((r) => parseDMY(r.date))).filter((t) => t > 0);
  if (times.length === 0) return '—';
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };
  const min = Math.min(...times);
  const max = Math.max(...times);
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

// ---------- CSV ----------

/** Iznos za Excel u BiH/HR postavkama: decimalni zarez, bez razdvajanja hiljada */
const csvNumber = (n: number) => (n === 0 ? '' : n.toFixed(2).replace('.', ','));

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCSV(groups: ExportGroup[], meta: ExportMeta): string {
  const header = [meta.kind, 'Datum', 'Referenca', 'Opis', 'Odliv (Duguje)', 'Priliv (Potražuje)', 'Valuta'];
  const lines = [header.join(';')];
  for (const g of groups) {
    for (const r of g.rows) {
      lines.push(
        [g.name, r.date, r.reference ?? '', r.description, csvNumber(r.debit), csvNumber(r.credit), meta.currency]
          .map(csvField)
          .join(';')
      );
    }
  }
  // BOM da Excel ispravno prikaže č, ć, đ, š, ž
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ---------- PDF ----------

const SYMBOLS: Record<string, string> = { BAM: 'KM', EUR: '€' };
const pdfNumber = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pdfMoney = (n: number, currency: string) => `${pdfNumber(n)} ${SYMBOLS[currency] ?? currency}`;

export function buildPdfDefinition(groups: ExportGroup[], meta: ExportMeta): TDocumentDefinitions {
  const all = groups.flatMap((g) => g.rows);
  const totals = groupTotals(all);
  const single = groups.length === 1;
  const title = single ? `${meta.kind}: ${groups[0].name}` : meta.title;
  const generated = new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

  const th = (text: string, alignment: 'left' | 'right' = 'left'): TableCell => ({
    text, bold: true, fillColor: '#e2e8f0', alignment, fontSize: 8,
  });
  const num = (n: number, currency: string, color?: string): TableCell => ({
    text: n === 0 ? '' : pdfMoney(n, currency), alignment: 'right', fontSize: 8, color,
  });

  const content: Content[] = [
    { text: title, fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
    {
      text: `Valuta: ${meta.currency}   •   Period: ${meta.range ? `${formatDate(meta.range.start)} – ${formatDate(meta.range.end)}` : period(groups)}   •   Generisano: ${generated}`,
      fontSize: 8, color: '#64748b', margin: [0, 0, 0, 10],
    },
    {
      columns: [
        { text: [{ text: 'Transakcija\n', fontSize: 8, color: '#64748b' }, { text: String(totals.count), bold: true }] },
        { text: [{ text: 'Odliv\n', fontSize: 8, color: '#64748b' }, { text: pdfMoney(totals.debit, meta.currency), bold: true, color: '#dc2626' }] },
        { text: [{ text: 'Priliv\n', fontSize: 8, color: '#64748b' }, { text: pdfMoney(totals.credit, meta.currency), bold: true, color: '#16a34a' }] },
        { text: [{ text: 'Neto\n', fontSize: 8, color: '#64748b' }, { text: pdfMoney(totals.net, meta.currency), bold: true }] },
      ],
      margin: [0, 0, 0, 12],
    },
  ];

  // Pregled po grupama (samo kad se izvozi više grupa)
  if (!single) {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 50, 80, 80, 80],
        body: [
          [th(meta.kind), th('Transakcija', 'right'), th('Odliv', 'right'), th('Priliv', 'right'), th('Neto', 'right')],
          ...groups.map((g): TableCell[] => {
            const t = groupTotals(g.rows);
            return [
              { text: g.name, fontSize: 8 },
              { text: String(t.count), alignment: 'right', fontSize: 8 },
              num(t.debit, meta.currency),
              num(t.credit, meta.currency),
              num(t.net, meta.currency),
            ];
          }),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 14],
    });
  }

  for (const g of groups) {
    const t = groupTotals(g.rows);
    if (!single) {
      content.push({ text: g.name, fontSize: 11, bold: true, margin: [0, 8, 0, 4] });
    }
    content.push({
      table: {
        headerRows: 1,
        widths: [48, 58, '*', 62, 62],
        body: [
          [th('Datum'), th('Referenca'), th('Opis'), th('Odliv', 'right'), th('Priliv', 'right')],
          ...g.rows.map((r): TableCell[] => [
            { text: r.date, fontSize: 8 },
            { text: r.reference ?? '', fontSize: 7, color: '#64748b' },
            { text: r.description, fontSize: 8 },
            num(r.debit, meta.currency, '#dc2626'),
            num(r.credit, meta.currency, '#16a34a'),
          ]),
          [
            { text: 'UKUPNO', bold: true, fontSize: 8, colSpan: 3, fillColor: '#f1f5f9' }, {}, {},
            { text: pdfMoney(t.debit, meta.currency), alignment: 'right', fontSize: 8, bold: true, fillColor: '#f1f5f9' },
            { text: pdfMoney(t.credit, meta.currency), alignment: 'right', fontSize: 8, bold: true, fillColor: '#f1f5f9' },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 10],
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: [36, 40, 36, 44],
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    footer: (current: number, total: number) => ({
      text: `${current} / ${total}`, alignment: 'center', fontSize: 8, color: '#94a3b8', margin: [0, 12, 0, 0],
    }),
  };
}

// ---------- Preuzimanje u pregledniku ----------

/** Naziv fajla bez dijakritika i posebnih znakova */
export function fileSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'export';
}

export function exportFileName(groups: ExportGroup[], meta: ExportMeta, ext: 'csv' | 'pdf'): string {
  const base = groups.length === 1 ? `${meta.kind.toLowerCase()}-${fileSlug(groups[0].name)}` : fileSlug(meta.title);
  const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const periodPart = meta.range ? `-${ymd(meta.range.start)}_${ymd(meta.range.end)}` : `-${new Date().toISOString().slice(0, 10)}`;
  return `${base}-${meta.currency}${periodPart}.${ext}`;
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(groups: ExportGroup[], meta: ExportMeta) {
  download(new Blob([buildCSV(groups, meta)], { type: 'text/csv;charset=utf-8' }), exportFileName(groups, meta, 'csv'));
}

export async function downloadPDF(groups: ExportGroup[], meta: ExportMeta) {
  // Biblioteka za PDF je velika, pa se učitava tek pri prvom izvozu
  const [pdfMakeModule, vfsModule]: any[] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  pdfMake.addVirtualFileSystem(vfsModule.default ?? vfsModule);
  pdfMake.createPdf(buildPdfDefinition(groups, meta)).download(exportFileName(groups, meta, 'pdf'));
}
