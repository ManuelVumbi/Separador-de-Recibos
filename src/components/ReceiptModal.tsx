import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Trash2, Pencil, Check, Send, ExternalLink, Eye } from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { generateReceiptPdf, getReceiptPdfBlob, openReceiptPdfInNewTab } from '../utils/pdfGenerator';
import { downloadBlob } from '../utils/zipExport';
import { formatFileName } from '../data';

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  namingPattern: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onUpdateReceipt?: (updated: ReceiptData) => void;
  onOpenSendModal?: (r: ReceiptData) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  namingPattern,
  onClose,
  onDelete,
  onUpdateReceipt,
  onOpenSendModal,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMecan, setEditMecan] = useState('');
  const [editNetPay, setEditNetPay] = useState('');

  useEffect(() => {
    if (receipt) {
      setEditName(receipt.employeeName);
      setEditMecan(receipt.mechanicalNumber);
      setEditNetPay(String(receipt.netPay || ''));
      setIsEditing(false);
    }
  }, [receipt]);

  if (!receipt) return null;

  const currentFileName = formatFileName(receipt, namingPattern);

  const handleSaveEdit = () => {
    if (editName.trim() && onUpdateReceipt) {
      const parsedNet = parseFloat(editNetPay.replace(/\s+/g, '').replace(',', '.'));
      const finalNet = !isNaN(parsedNet) && parsedNet > 0 ? parsedNet : receipt.netPay;
      const updated: ReceiptData = {
        ...receipt,
        employeeName: editName.trim(),
        mechanicalNumber: editMecan.trim() || receipt.mechanicalNumber,
        netPay: finalNet,
        suggestedFileName: formatFileName(
          { ...receipt, employeeName: editName.trim(), mechanicalNumber: editMecan.trim() },
          namingPattern
        ),
      };
      onUpdateReceipt(updated);
    }
    setIsEditing(false);
  };

  const handleOpenPdf = async () => {
    try {
      setOpening(true);
      await openReceiptPdfInNewTab(receipt);
    } catch (err) {
      console.error('Erro ao abrir PDF:', err);
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const { blob } = await getReceiptPdfBlob(receipt);
      downloadBlob(blob, currentFileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-app-primary text-white flex items-center justify-center font-bold text-sm">
              ES
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do colaborador"
                    className="px-2.5 py-1 text-xs border border-app-primary rounded bg-white dark:bg-slate-950 font-medium text-slate-900 dark:text-white focus:outline-none ring-1 ring-app-primary w-52"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editMecan}
                    onChange={(e) => setEditMecan(e.target.value)}
                    placeholder="N.º Mecânico"
                    className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 font-mono text-slate-800 dark:text-slate-200 focus:outline-none w-24"
                  />
                  <input
                    type="text"
                    value={editNetPay}
                    onChange={(e) => setEditNetPay(e.target.value)}
                    placeholder="Líquido AKZ"
                    className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 font-mono text-slate-800 dark:text-slate-200 focus:outline-none w-28"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Gravar</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{receipt.employeeName}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Nº {receipt.mechanicalNumber}</span>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-slate-400 hover:text-app-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="Editar nome ou número mecanográfico"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{receipt.companyName} · {receipt.period}</p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* File Name preview banner */}
          <div className="flex items-center justify-between p-3.5 app-primary-subtle-btn border rounded-lg text-xs">
            <div className="flex items-center gap-2 font-mono truncate">
              <FileText className="w-4 h-4 text-app-primary shrink-0" />
              <span className="font-semibold text-slate-600 dark:text-slate-400">Recibo Original em PDF:</span>
              <span className="text-app-primary font-medium truncate">{currentFileName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={handleOpenPdf}
                disabled={opening}
                className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-100/90 hover:bg-blue-200 rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                title="Abrir e visualizar o recibo original diretamente numa nova aba do navegador"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{opening ? 'A abrir...' : 'Visualizar Original'}</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                title="Descarregar ficheiro PDF original deste colaborador"
              >
                <Download className="w-3.5 h-3.5" />
                {downloading ? 'A descarregar...' : 'Baixar PDF Original'}
              </button>
              {onOpenSendModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSendModal(receipt);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                  title="Enviar por WhatsApp ou E-mail"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Categoria</span>
              <span className="font-semibold text-slate-800">{receipt.category}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Departamento</span>
              <span className="font-semibold text-slate-800">{receipt.department}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">N.º Contribuinte</span>
              <span className="font-semibold text-slate-800 font-mono">{receipt.taxNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">N.º Beneficiário</span>
              <span className="font-semibold text-slate-800 font-mono">{receipt.beneficiaryNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Data de Fecho</span>
              <span className="font-semibold text-slate-800">{receipt.closingDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Dias Trabalhados</span>
              <span className="font-semibold text-slate-800">{receipt.daysWorked} dias</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Vencimento/Hora</span>
              <span className="font-semibold text-slate-800 font-mono">
                {receipt.hourlyRate ? `${receipt.hourlyRate.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ` : '0,00 AKZ'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Origem / Folha</span>
              <span className="font-semibold text-slate-800">Página {receipt.pageNumber}</span>
            </div>
          </div>

          {/* Items breakdown table */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Discriminação de Remunerações e Descontos
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Cód.</th>
                    <th className="py-2.5 px-3">Descrição da Rubrica</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Valor Unit.</th>
                    <th className="py-2.5 px-3 text-right">Remunerações</th>
                    <th className="py-2.5 px-3 text-right">Descontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipt.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-mono text-slate-500">{item.code}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{item.desc}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.qty ?? '-'}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        {item.unitValue ? item.unitValue.toLocaleString('pt-PT', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                        {item.earnings ? `${item.earnings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-red-700">
                        {item.deductions ? `${item.deductions.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-900 text-white rounded-lg">
            <div>
              <span className="text-xs text-slate-400 block">Total Remunerações</span>
              <span className="text-sm font-semibold font-mono tabular-nums">
                {receipt.totalEarnings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Total Descontos</span>
              <span className="text-sm font-semibold text-rose-300 font-mono tabular-nums">
                {receipt.totalDeductions.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ
              </span>
            </div>
            <div>
              <span className="text-xs text-emerald-400 block font-medium">Líquido a Pagar</span>
              <span className="text-lg font-bold text-emerald-300 font-mono tabular-nums">
                {receipt.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-xs text-slate-500">
            Forma de Pagamento: <strong className="text-slate-700">{receipt.paymentMethod}</strong>
          </div>
          <div className="flex items-center gap-3">
            {onDelete && (
              <button
                onClick={() => {
                  if (window.confirm(`Eliminar o recibo de ${receipt.employeeName}?`)) {
                    onDelete(receipt.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleOpenPdf}
              disabled={opening}
              className="px-3.5 py-2 text-xs font-semibold app-primary-subtle-btn border rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Abrir o PDF numa nova aba"
            >
              <Eye className="w-3.5 h-3.5 text-app-primary" />
              <span>{opening ? 'A abrir...' : 'Abrir PDF no Navegador'}</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 text-xs font-medium text-white bg-app-primary hover:opacity-95 rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'A transferir...' : 'Descarregar Recibo PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
