import { PDFMetadata } from '../types/App.types';
import { FileText, User, Calendar, HardDrive, Hash } from 'lucide-react';

interface FileInfoProps {
  metadata: PDFMetadata;
  expanded?: boolean;
}

export function FileInfo({ metadata, expanded = false }: FileInfoProps) {
  if (expanded) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText size={20} className="text-blue-400" />
          Informacije o dokumentu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow icon={<FileText size={16} />} label="Naziv fajla" value={metadata.fileName} />
          <InfoRow icon={<Hash size={16} />} label="Broj stranica" value={String(metadata.pageCount)} />
          <InfoRow icon={<HardDrive size={16} />} label="Veličina fajla" value={metadata.fileSize} />
          <InfoRow icon={<User size={16} />} label="Autor" value={metadata.author} />
          <InfoRow icon={<FileText size={16} />} label="Naslov" value={metadata.title} />
          <InfoRow icon={<FileText size={16} />} label="Predmet" value={metadata.subject} />
          <InfoRow icon={<Calendar size={16} />} label="Kreator" value={metadata.creator} />
          <InfoRow icon={<Calendar size={16} />} label="Producer" value={metadata.producer} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <FileText size={16} className="text-blue-400" />
        <span className="font-medium text-white">{metadata.fileName}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Hash size={14} />
        <span>{metadata.pageCount} stranica</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <HardDrive size={14} />
        <span>{metadata.fileSize}</span>
      </div>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg">
      <div className="text-slate-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-white mt-0.5 break-all">{value}</p>
      </div>
    </div>
  );
}
