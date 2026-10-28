import React, { useState } from 'react';
import {
  Search,
  Download,
  Eye,
  CheckSquare,
  Square,
  Filter,
  Trash2,
  AlertTriangle,
  Pencil,
  Check,
  X,
  Send,
  MessageCircle,
  Mail,
  FileText,
} from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { generateReceiptPdf, getReceiptPdfBlob, openReceiptPdfInNewTab } from '../utils/pdfGenerator';
import { downloadBlob } from '../utils/zipExport';
import { formatFileName } from '../data';

interface ReceiptListProps {
  receipts: ReceiptData[];
  namingPattern: string;
  onSelectReceipt: (r: ReceiptData) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteReceipt: (id: string) => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onUpdateReceipt?: (updated: ReceiptData) => void;
  onOpenSendModal?: (r?: ReceiptData) => void;
}

export const ReceiptList: React.FC<ReceiptListProps> = ({
  receipts,
  namingPattern,
  onSelectReceipt,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteReceipt,
  onDeleteSelected,
  onDeleteAll,
  onUpdateReceipt,
  onOpenSendModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingNetPayId, setEditingNetPayId] = useState<string | null>(null);
  const [editNetPayValue, setEditNetPayValue] = useState('');

  const startEdit = (r: ReceiptData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(r.id);
    setEditName(r.employeeName);
  };

  const saveEdit = (r: ReceiptData, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (editName.trim() && onUpdateReceipt) {
      const updated = {
        ...r,
        employeeName: editName.trim(),
        suggestedFileName: formatFileName({ ...r, employeeName: editName.trim() }, namingPattern),
      };
      onUpdateReceipt(updated);
    }
    setEditingId(null);
  };

  const startEditNetPay = (r: ReceiptData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNetPayId(r.id);
    setEditNetPayValue(r.netPay > 0 ? String(r.netPay) : '');
  };

  const saveEditNetPay = (r: ReceiptData, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const parsed = parseFloat(editNetPayValue.replace(/\s+/g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && onUpdateReceipt) {
      onUpdateReceipt({
        ...r,
        netPay: parsed,
      });
    }
    setEditingNetPayId(null);
  };

  // Extract unique batches and categories
  const sources = Array.from(new Set(receipts.map((r) => r.sourceDoc))).sort();
  const categories = Array.from(new Set(receipts.map((r) => r.category))).sort();

  const filtered = receipts.filter((r) => {
    const matchesSearch =
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mechanicalNumber.includes(searchTerm) ||
      r.taxNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSource = sourceFilter === 'all' || r.sourceDoc === sourceFilter;
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    return matchesSearch && matchesSource && matchesCategory;
  });

  const handleOpenSingle = async (r: ReceiptData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await openReceiptPdfInNewTab(r);
    } catch (err) {
      console.error('Erro ao abrir PDF:', err);
    }
  };

  const handleDownloadSingle = async (r: ReceiptData, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(r.id);
      const { blob } = await getReceiptPdfBlob(r);
      const fileName = formatFileName(r, namingPattern);
      downloadBlob(blob, fileName);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteSingle = (r: ReceiptData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem a certeza que deseja eliminar o recibo de "${r.employeeName}"?`)) {
      onDeleteReceipt(r.id);
    }
  };

  const isAllSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-colors">
      {/* Control Bar: Search & Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome, mecânico, categoria ou NIF..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-app-primary"
            />
          </div>

          {/* Source filters dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium hidden md:inline">Lote:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-app-primary cursor-pointer"
            >
              <option value="all">Todos os Lotes ({receipts.length})</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s} ({receipts.filter((r) => r.sourceDoc === s).length})
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-app-primary cursor-pointer"
            >
              <option value="all">Todas as Funções</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection & Batch Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-app-primary transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-app-primary" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              )}
              <span>{isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>
              A exibir <strong className="text-slate-800 dark:text-white">{filtered.length}</strong> de{' '}
              <strong className="text-slate-800 dark:text-white">{receipts.length}</strong> recibos
            </span>
          </div>

          {/* Delete controls and Send button */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {onOpenSendModal && receipts.length > 0 && (
              <button
                onClick={() => onOpenSendModal()}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Abrir painel de expedição por WhatsApp ou E-mail"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700" />
                <span>Enviar (WhatsApp / E-mail)</span>
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={() => setConfirmDeleteSelected(true)}
                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Selecionados ({selectedIds.size})</span>
              </button>
            )}

            {receipts.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors flex items-center gap-1.5"
                title="Eliminar todos os recibos da lista"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Todos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Delete All */}
      {confirmDeleteAll && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <strong className="block">Tem a certeza que deseja eliminar TODOS os {receipts.length} recibos?</strong>
              <span className="text-rose-700">Esta ação irá remover todos os recibos da lista de trabalho atual.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmDeleteAll(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onDeleteAll();
                setConfirmDeleteAll(false);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors font-medium"
            >
              Sim, Eliminar Todos
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete Selected */}
      {confirmDeleteSelected && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Deseja eliminar os <strong>{selectedIds.size}</strong> recibos selecionados?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmDeleteSelected(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onDeleteSelected();
                setConfirmDeleteSelected(false);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors font-medium"
            >
              Confirmar Eliminação
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4 w-10 text-center">Sel.</th>
              <th className="py-3 px-4">N.º Mec.</th>
              <th className="py-3 px-4">Nome do Colaborador</th>
              <th className="py-3 px-4">Nome do Ficheiro Gerado (.pdf)</th>
              <th className="py-3 px-4">Função / Categoria</th>
              <th className="py-3 px-4 text-right">Líquido (AKZ)</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {receipts.length === 0
                      ? 'Nenhum recibo carregado no momento'
                      : 'Nenhum recibo corresponde aos filtros aplicados'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {receipts.length === 0
                      ? 'Arraste o ficheiro PDF de várias páginas para o campo de upload acima ou clique em "Selecionar Ficheiro PDF".'
                      : 'Tente alterar a pesquisa ou selecionar outro filtro de período e categoria.'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isSelected = selectedIds.has(r.id);
                const generatedName = formatFileName(r, namingPattern);
                const isDownloading = downloadingId === r.id;

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectReceipt(r)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100/80 dark:bg-slate-800/80' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td
                      className="py-3 px-4 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(r.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-app-primary mx-auto" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-500 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">{r.mechanicalNumber}</td>
                    <td className="py-3 px-4">
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(r, e);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="px-2 py-1 text-xs border border-app-primary rounded bg-white dark:bg-slate-950 font-medium text-slate-900 dark:text-white focus:outline-none ring-1 ring-app-primary max-w-[180px]"
                            autoFocus
                          />
                          <button
                            onClick={(e) => saveEdit(r, e)}
                            className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded"
                            title="Gravar nome"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="group/name flex items-center gap-1.5">
                          <span className={`font-semibold ${r.employeeName.startsWith('Colaborador Folha') ? 'text-amber-700 dark:text-amber-400 font-normal italic' : 'text-slate-900 dark:text-white'}`}>
                            {r.employeeName}
                          </span>
                          <button
                            onClick={(e) => startEdit(r, e)}
                            className="opacity-0 group-hover/name:opacity-100 p-0.5 text-slate-400 hover:text-app-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-opacity"
                            title="Editar ou corrigir nome do colaborador"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {r.sourceDoc} · Folha {r.pageNumber}
                        </span>
                        <span className="inline-flex items-center text-[9px] font-semibold text-app-primary app-primary-subtle-btn border px-1 py-0.2 rounded" title="Recibo original extraído folha a folha">
                          Original
                        </span>
                        {r.sentAt && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded"
                            title={`Enviado em ${r.sentAt}`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>{r.sentChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-app-primary max-w-[240px] truncate" title={generatedName}>
                      {generatedName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{r.category}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums" onClick={(e) => e.stopPropagation()}>
                      {editingNetPayId === r.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            value={editNetPayValue}
                            onChange={(e) => setEditNetPayValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditNetPay(r, e);
                              if (e.key === 'Escape') setEditingNetPayId(null);
                            }}
                            placeholder="0,00"
                            className="w-24 px-1.5 py-0.5 text-xs text-right font-mono border border-blue-600 rounded bg-white text-slate-900 focus:outline-none ring-1 ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={(e) => saveEditNetPay(r, e)}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                            title="Gravar valor"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNetPayId(null);
                            }}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : r.netPay === 0 ? (
                        <button
                          onClick={(e) => startEditNetPay(r, e)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors group/zero cursor-pointer"
                          title="Clique para inserir o valor líquido deste recibo"
                        >
                          <span>0,00</span>
                          <Pencil className="w-2.5 h-2.5 opacity-60 group-hover/zero:opacity-100" />
                        </button>
                      ) : (
                        <div className="group/pay inline-flex items-center justify-end gap-1.5 text-slate-900 dark:text-white">
                          <span>{r.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
                          <button
                            onClick={(e) => startEditNetPay(r, e)}
                            className="opacity-0 group-hover/pay:opacity-100 p-0.5 text-slate-400 hover:text-app-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-opacity"
                            title="Editar valor líquido"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                          title="Ver detalhes do recibo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onOpenSendModal && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSendModal(r);
                            }}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/80 rounded-md transition-colors cursor-pointer"
                            title={`Enviar recibo de ${r.employeeName} por WhatsApp ou E-mail`}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleOpenSingle(r, e)}
                          className="p-1.5 text-app-primary hover:opacity-80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                          title="Abrir e visualizar o recibo original em PDF numa nova aba"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadSingle(r, e)}
                          disabled={isDownloading}
                          className="px-2 py-1 text-[11px] font-medium text-white bg-app-primary hover:opacity-95 rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Descarregar o ficheiro PDF do recibo original com o nome padronizado"
                        >
                          <Download className="w-3 h-3" />
                          <span>{isDownloading ? '...' : 'PDF'}</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteSingle(r, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors cursor-pointer"
                          title={`Eliminar recibo de ${r.employeeName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
