import React, { useState, useRef } from 'react';
import { X, PlusCircle, Upload, FileText, Check, AlertCircle, FileCheck2, ArrowDownCircle } from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { splitUploadedPdf } from '../utils/pdfGenerator';
import { extractTextFromPdfPages } from '../utils/pdfTextExtractor';
import { sanitizeFileName, formatFileName } from '../data';

interface AddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBatch: (batchName: string, newReceipts: ReceiptData[], note?: string) => void;
  initialFile?: File | null;
  namingPattern?: string;
}

export const AddBatchModal: React.FC<AddBatchModalProps> = ({
  isOpen,
  onClose,
  onAddBatch,
  initialFile,
  namingPattern = 'Recibo_{MECAN}_{NOME_LIMPO}.pdf',
}) => {
  const [batchName, setBatchName] = useState('Novo Lote de Recibos');
  const [period, setPeriod] = useState('Outubro 2026');
  const [companyName, setCompanyName] = useState('Espacie Services, Lda');
  const [companyNif, setCompanyNif] = useState('5402038937');

  // File upload state for original PDF documents
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const [filePageCount, setFilePageCount] = useState<number | null>(null);
  const [extractedPages, setExtractedPages] = useState<{ pageIndex: number; pdfBytes: Uint8Array }[]>([]);
  const [pageTextList, setPageTextList] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor selecione ou arraste um ficheiro PDF válido.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setBatchName(`Lote - ${file.name.replace('.pdf', '')}`);
    try {
      setIsAnalyzing(true);
      const buffer = await file.arrayBuffer();
      const pages = await splitUploadedPdf(buffer);
      setExtractedPages(pages);
      setFilePageCount(pages.length);

      try {
        const textInfo = await extractTextFromPdfPages(buffer);
        setPageTextList(textInfo);
      } catch (e) {
        console.warn('Text extraction fallback in modal:', e);
      }
    } catch (err: any) {
      setError('Erro ao ler páginas do PDF: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!batchName.trim()) {
      setError('Por favor especifique um nome para o lote.');
      return;
    }

    if (!selectedFile || !filePageCount) {
      setError('Por favor arraste ou selecione o ficheiro PDF original dos recibos.');
      return;
    }

    const createdReceipts: ReceiptData[] = [];

    // Extract and preserve each original leaf directly from the uploaded PDF
    for (let i = 1; i <= filePageCount; i++) {
      const pageTextInfo = pageTextList[i - 1];
      const employeeName = pageTextInfo?.employeeName?.trim() || `Colaborador Folha ${String(i).padStart(2, '0')}`;
      const mechanicalNumber = pageTextInfo?.mechanicalNumber || String(10500 + i);
      const category = pageTextInfo?.category || 'OPERADOR';
      const netPay = pageTextInfo?.netPay || 0;
      const totalEarnings = pageTextInfo?.totalEarnings || netPay;
      const totalDeductions = pageTextInfo?.totalDeductions || (totalEarnings > netPay ? totalEarnings - netPay : 0);

      const receiptRecord: ReceiptData = {
        id: `batch-${Date.now()}-${i}`,
        sourceDoc: batchName,
        pageNumber: i,
        companyName,
        companyNif,
        companyAddress: 'Base Residencial Kahina, Rua Pedro Van-Dúnem Loy, 234, Luanda',
        employeeName,
        mechanicalNumber,
        category,
        beneficiaryNumber: '00' + Math.floor(1000000 + Math.random() * 9000000),
        taxNumber: '00' + Math.floor(100000000 + Math.random() * 900000000) + 'LA011',
        department: 'DPT INDUSTRIAL',
        period,
        closingDate: new Date().toLocaleDateString('pt-PT'),
        daysWorked: 20,
        hourlyRate: 350.0,
        totalEarnings,
        totalDeductions,
        netPay,
        currency: 'AKZ',
        paymentMethod: 'Transferência',
        suggestedFileName: '',
        originalPdfBytes: extractedPages[i - 1]?.pdfBytes,
        items: [
          { code: 'R10', desc: 'Salário Base', earnings: Math.round(totalEarnings * 0.6) },
          { code: 'R333', desc: 'Subsidio Offshore', earnings: Math.round(totalEarnings * 0.4) },
          { code: 'D01', desc: 'Segurança Social (3%)', deductions: Math.round(totalEarnings * 0.03) },
          { code: 'D02', desc: 'IRT', deductions: Math.max(0, totalDeductions - Math.round(totalEarnings * 0.03)) },
        ],
      };

      receiptRecord.suggestedFileName = formatFileName(receiptRecord, namingPattern);
      createdReceipts.push(receiptRecord);
    }

    onAddBatch(batchName, createdReceipts, `Lote original adicionado e separado com ${createdReceipts.length} recibos.`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-900 text-white rounded-lg">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Adicionar Lote de Recibos para Separação
              </h3>
              <p className="text-xs text-slate-500">
                Arraste e solte o ficheiro PDF ou clique para carregar e separar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Batch Common Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Nome do Lote / Identificador:</label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700 text-xs"
                placeholder="Ex: Lote Outubro 2026"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Período de Vencimento:</label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700 text-xs"
                placeholder="Ex: Setembro 2026"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Empresa:</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">NIF da Empresa:</label>
              <input
                type="text"
                value={companyNif}
                onChange={(e) => setCompanyNif(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-700 text-xs"
              />
            </div>
          </div>

          {/* Mode Selector Tabs */}
          {/* Original PDF Upload & Leaf Extraction Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-800" />
                <span>Ficheiro PDF Original dos Recibos</span>
              </label>
              <span className="text-[10px] bg-blue-50 text-blue-800 font-medium px-2 py-0.5 rounded-full border border-blue-200">
                Processamento Fiel Folha a Folha
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="modal-pdf-file"
            />

            {/* Native Drag and Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all space-y-2.5 ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/80 scale-[1.01] ring-2 ring-blue-500/30'
                  : selectedFile
                  ? 'border-emerald-500 bg-emerald-50/30 hover:border-emerald-600'
                  : 'border-slate-300 hover:border-blue-700 bg-slate-50/60 hover:bg-blue-50/30'
              }`}
            >
              {isDragging ? (
                <div className="py-2 space-y-2">
                  <ArrowDownCircle className="w-10 h-10 text-blue-600 mx-auto animate-bounce" />
                  <div className="text-sm font-bold text-blue-900">
                    Solte o ficheiro PDF original aqui!
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="space-y-1.5">
                  <FileCheck2 className="w-9 h-9 text-emerald-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-900">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {filePageCount !== null ? `${filePageCount} recibos originais detetados` : 'A analisar...'}
                  </div>
                  <div className="text-[11px] text-blue-700 underline pt-1">
                    Clique ou arraste outro ficheiro PDF para substituir
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-800 mx-auto" />
                  <div className="text-sm font-semibold text-slate-800">
                    Arraste o PDF original para aqui, ou clique para procurar
                  </div>
                  <div className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Suporta ficheiros multipáginas da folha de vencimentos (ex: Primavera BSS). O sistema separa cada recibo exatamente como no original.
                  </div>
                </>
              )}
            </div>

            {isAnalyzing && (
              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                A analisar e extrair folhas originais do documento PDF...
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-900 hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar e Processar Lote
          </button>
        </div>
      </div>
    </div>
  );
};
