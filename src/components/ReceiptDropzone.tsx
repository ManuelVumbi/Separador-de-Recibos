import React, { useState, useRef } from 'react';
import { FileUp, UploadCloud, Loader2, FileText, CheckCircle2, ShieldCheck, Sparkles, SlidersHorizontal } from 'lucide-react';

interface ReceiptDropzoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  processingFileName?: string | null;
  onOpenAdvancedModal?: () => void;
  totalReceiptsCount: number;
}

export const ReceiptDropzone: React.FC<ReceiptDropzoneProps> = ({
  onFileSelect,
  isProcessing,
  processingFileName,
  onOpenAdvancedModal,
  totalReceiptsCount,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        onFileSelect(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const triggerBrowse = () => {
    if (isProcessing) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Drag-and-Drop Zone */}
      <div
        onClick={triggerBrowse}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer p-6 sm:p-7 text-center group ${
          isDragOver
            ? 'border-app-primary bg-app-primary/10 dark:bg-app-primary/20 ring-4 ring-app-primary/20 scale-[1.008]'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-app-primary dark:hover:border-app-primary hover:bg-slate-50/70 dark:hover:bg-slate-800/60 shadow-xs'
        }`}
      >
        {/* Subtle decorative background glow when hovering */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-app-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-app-primary/10 transition-colors" />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="w-14 h-14 rounded-full bg-app-primary/10 dark:bg-app-primary/20 text-app-primary flex items-center justify-center animate-pulse">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                A processar o ficheiro PDF...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {processingFileName
                  ? `A ler «${processingFileName}», a individualizar folhas e a associar colaboradores...`
                  : 'A ler páginas originais e a separar os recibos folha a folha sem alterações...'}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[11px] text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Conserva o ficheiro e os bytes originais</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            {/* Icon */}
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 duration-200 ${
                isDragOver
                  ? 'bg-app-primary text-white shadow-md'
                  : 'bg-app-primary/10 dark:bg-app-primary/20 text-app-primary'
              }`}
            >
              {isDragOver ? (
                <UploadCloud className="w-7 h-7 animate-bounce" />
              ) : (
                <FileUp className="w-7 h-7" />
              )}
            </div>

            {/* Main Headings */}
            <div className="space-y-1 max-w-xl">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <span>{isDragOver ? 'Solte o ficheiro PDF agora!' : 'Adicionar ou Arrastar Lote de Recibos em PDF'}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isDragOver
                  ? 'O sistema irá separar imediatamente cada folha mantendo os recibos originais.'
                  : 'Arraste o ficheiro PDF do lote para este campo ou clique para procurar no seu computador.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div
              className="flex flex-wrap items-center justify-center gap-2.5 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={triggerBrowse}
                className="px-4 py-2 text-xs font-semibold text-white bg-app-primary hover:opacity-95 rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Selecionar Ficheiro PDF</span>
              </button>

              {onOpenAdvancedModal && (
                <button
                  type="button"
                  onClick={onOpenAdvancedModal}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Assistente com Pré-visualização</span>
                </button>
              )}
            </div>

            {/* Key feature benefits badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 w-full max-w-2xl">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Separação automática folha a folha</span>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-app-primary" />
                <span>Recibos originais sem alteração</span>
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Nomeação inteligente por colaborador</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
