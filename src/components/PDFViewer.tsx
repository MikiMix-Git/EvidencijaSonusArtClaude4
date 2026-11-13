import { useState, useMemo } from 'react';
import { PageData } from '../types/App.types';
import { Search, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';

interface PDFViewerProps {
  pages: PageData[];
}

export function PDFViewer({ pages }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredPages = useMemo(() => {
    if (!searchTerm.trim()) return pages;
    return pages.filter((page) => page.text.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [pages, searchTerm]);

  const displayPage = filteredPages.length > 0 ? filteredPages[Math.min(currentPage - 1, filteredPages.length - 1)] : null;

  const handleCopy = async () => {
    if (displayPage) {
      await navigator.clipboard.writeText(displayPage.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (pages.length === 0) return <div className="text-center py-12 text-slate-400">Nema podataka za prikaz.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Pretraži tekst u dokumentu..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50" />
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Stranica</span>
          <span className="text-lg font-bold text-white">{currentPage} / {filteredPages.length}</span>
          {displayPage && <span className="text-xs text-slate-500">(Original: stranica {displayPage.pageNumber})</span>}
        </div>
        <button onClick={() => setCurrentPage((p) => Math.min(filteredPages.length, p + 1))} disabled={currentPage >= filteredPages.length} className="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {displayPage ? (
        <div className="relative bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between p-3 border-b border-slate-700/30">
            <span className="text-sm font-medium text-slate-300">Stranica {displayPage.pageNumber}</span>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-sm text-slate-300 transition-colors">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? 'Kopirano!' : 'Kopiraj'}
            </button>
          </div>
          <div className="p-5 max-h-[500px] overflow-y-auto">
            <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{displayPage.text || '(Ova stranica ne sadrži tekst)'}</p>
          </div>
          <div className="p-3 border-t border-slate-700/30 text-xs text-slate-500">{displayPage.text.length} karaktera • {displayPage.items.length} tekstualnih elemenata</div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">Nema rezultata za pretragu "{searchTerm}"</div>
      )}
    </div>
  );
}
