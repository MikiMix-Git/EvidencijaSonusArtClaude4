import { useState } from 'react';
import type { PageData } from '../types/App.types';
import { X } from 'lucide-react';

interface DebugViewProps {
  pages: PageData[];
  onClose: () => void;
}

export function DebugView({ pages, onClose }: DebugViewProps) {
  const [selectedPage, setSelectedPage] = useState(0);

  if (pages.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="bg-slate-800 rounded-lg p-8 max-w-2xl">
          <p className="text-white">Nema podataka za prikaz</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Zatvori
          </button>
        </div>
      </div>
    );
  }

  const page = pages[selectedPage];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto p-4">
      <div className="max-w-7xl mx-auto bg-slate-900 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Debug: PDF Elementi</h2>
          <button onClick={onClose} className="text-white hover:text-red-400">
            <X size={24} />
          </button>
        </div>

        <div className="mb-4">
          <label className="text-white mr-2">Stranica:</label>
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(Number(e.target.value))}
            className="bg-slate-700 text-white px-3 py-1 rounded"
          >
            {pages.map((_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Sirovi tekst</h3>
            <div className="bg-slate-800 p-4 rounded overflow-auto max-h-[600px]">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">{page.text}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Elementi ({page.items.length})
            </h3>
            <div className="bg-slate-800 p-4 rounded overflow-auto max-h-[600px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">X</th>
                    <th className="text-left py-1">Y</th>
                    <th className="text-left py-1">Tekst</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-1 text-slate-500">{i}</td>
                      <td className="py-1 text-blue-400">{item.x.toFixed(1)}</td>
                      <td className="py-1 text-green-400">{item.y.toFixed(1)}</td>
                      <td className="py-1 text-white">{item.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Grupisani redovi</h3>
          <div className="bg-slate-800 p-4 rounded overflow-auto max-h-[400px]">
            {groupItemsIntoLines(page.items).map((line, i) => (
              <div key={i} className="mb-2 border-b border-slate-700/50 pb-2">
                <div className="text-xs text-slate-400 mb-1">
                  Y: {line.y.toFixed(1)} ({line.items.length} elemenata)
                </div>
                <div className="text-sm text-white">
                  {line.items.map((item, j) => (
                    <span key={j} className="mr-2">
                      <span className="text-blue-400">[{item.x.toFixed(0)}]</span>{' '}
                      {item.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupItemsIntoLines(items: { text: string; x: number; y: number }[]) {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: { y: number; items: { text: string; x: number }[] }[] = [];
  let currentLine = { y: sorted[0].y, items: [] as { text: string; x: number }[] };

  for (const item of sorted) {
    if (Math.abs(item.y - currentLine.y) < 3) {
      currentLine.items.push({ text: item.text, x: item.x });
    } else {
      currentLine.items.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = { y: item.y, items: [{ text: item.text, x: item.x }] };
    }
  }
  currentLine.items.sort((a, b) => a.x - b.x);
  lines.push(currentLine);

  return lines;
}
