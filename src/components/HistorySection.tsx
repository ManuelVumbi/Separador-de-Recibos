import React, { useState } from 'react';
import { History, Trash2, ChevronDown, ChevronUp, FileText, CheckCircle2, Clock, Calendar, Hash } from 'lucide-react';
import { BatchHistoryRecord } from '../types/receipt';

interface HistorySectionProps {
  history: BatchHistoryRecord[];
  onDeleteRecord: (id: string) => void;
  onClearHistory: () => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  onDeleteRecord,
  onClearHistory,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleConfirmClear = () => {
    onClearHistory();
    setConfirmClear(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-app-primary text-white rounded-lg">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Histórico de Lotes e Recibos Separados
              <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                ({history.length} {history.length === 1 ? 'registo' : 'registos'})
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registo permanente de separações, lotes adicionados e exportações realizadas
            </p>
          </div>
        </div>

        {history.length > 0 && !confirmClear && (
          <button
            onClick={() => setConfirmClear(true)}
            className="self-start sm:self-auto text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 font-medium flex items-center gap-1.5 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Todo o Histórico
          </button>
        )}
      </div>

      {/* In-app confirmation banner for clearing history */}
      {confirmClear && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 animate-in fade-in duration-150">
          <div>
            <strong className="block">Tem a certeza que deseja limpar todo o histórico?</strong>
            <span className="text-rose-700 dark:text-rose-300">Esta ação eliminará permanentemente todos os registos do histórico.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md transition-colors font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmClear}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors font-medium shadow-2xs cursor-pointer"
            >
              Sim, Limpar Todo o Histórico
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Nenhum registo de histórico disponível. As separações realizadas serão registadas automaticamente aqui.
          </div>
        ) : (
          history.map((record) => {
            const isExpanded = expandedId === record.id;

            return (
              <div key={record.id} className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{record.batchName}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded app-primary-subtle-btn font-medium border">
                        {record.receiptCount} recibos separados
                      </span>
                      {record.totalAmount > 0 && (
                        <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {record.totalAmount.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} {record.currency}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {record.timestamp}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-slate-500">
                        Regra: {record.patternUsed}
                      </span>
                      {record.notes && (
                        <>
                          <span>·</span>
                          <span className="text-slate-600 italic">{record.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => toggleExpand(record.id)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded-md transition-colors flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Ocultar Nomes' : 'Ver Nomes'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => onDeleteRecord(record.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Eliminar este registo de histórico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded list of employee names */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-600 mb-2">
                      Colaboradores incluídos ({record.receiptNames.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-2">
                      {record.receiptNames.map((name, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-700 truncate"
                        >
                          <FileText className="w-3 h-3 text-blue-700 shrink-0" />
                          <span className="truncate">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
