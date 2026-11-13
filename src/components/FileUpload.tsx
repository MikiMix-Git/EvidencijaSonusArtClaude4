import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  loading: boolean;
}

export function FileUpload({ onFilesSelect, loading }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) {
      onFilesSelect(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelect(Array.from(e.target.files));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Analiza Bankovnih Izvoda
        </h2>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Učitajte jedan ili više PDF bankovnih izvoda za automatsku analizu svih transakcija
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full max-w-xl p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-slate-600 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            isDragging ? 'bg-blue-500/20' : 'bg-slate-700/50'
          }`}>
            <Upload size={32} className={isDragging ? 'text-blue-400' : 'text-slate-400'} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-white mb-1">
              {isDragging ? 'Pustite fajlove ovdje' : 'Prevucite PDF fajlove ovdje'}
            </p>
            <p className="text-sm text-slate-400">ili kliknite za odabir (moguće je odabrati više fajlova)</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>PDF format • Više fajlova • Max 50 MB po fajlu</span>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {[
          { title: 'Više izvoda', desc: 'Učitajte i analizirajte više bankovnih izvoda istovremeno', icon: '📚' },
          { title: 'Sve stavke', desc: 'Automatsko prepoznavanje svih transakcija, datuma i iznosa', icon: '📊' },
          { title: 'Agregirani pregled', desc: 'Ukupni pregled svih izvoda sa graficima i statistikama', icon: '📈' },
        ].map((feature) => (
          <div key={feature.title} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-5 text-center">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
            <p className="text-sm text-slate-400">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
