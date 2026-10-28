import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  UploadCloud,
  Download,
  Link,
  Trash2,
  Edit2,
  Phone,
  Mail,
  CheckCircle2,
  Building2,
  ExternalLink,
  Copy,
  Check,
  Send,
  AlertCircle,
  Hash,
  Square,
  CheckSquare,
  FileSpreadsheet,
  MessageCircle,
  Code,
  ChevronDown,
  ChevronUp,
  Smartphone,
  CheckCheck,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { CollaboratorContact } from '../types/contact';
import { ReceiptData } from '../types/receipt';
import {
  exportContactsToGoogleCsv,
  exportContactsToStandardCsv,
  exportContactsToVCard,
  exportContactsToExcel,
  parseWhatsAppRawText,
} from '../utils/contactParser';
import { forceBidirectionalSync, exportContactsToJson } from '../utils/contactSync';

interface ContactsSectionProps {
  contacts: CollaboratorContact[];
  receipts: ReceiptData[];
  onAddContact: () => void;
  onEditContact: (contact: CollaboratorContact) => void;
  onImportClick: () => void;
  onImportContacts?: (contacts: CollaboratorContact[], overwrite: boolean) => void;
  onDeleteContact: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onSyncWithReceipts: () => void;
  onOpenSendModalForReceipt?: (receipt: ReceiptData) => void;
  cloudSyncStatus?: {
    status: 'connecting' | 'synced' | 'error';
    details?: string;
  };
}

export const ContactsSection: React.FC<ContactsSectionProps> = ({
  contacts,
  receipts,
  onAddContact,
  onEditContact,
  onImportClick,
  onImportContacts,
  onDeleteContact,
  onDeleteMultiple,
  onSyncWithReceipts,
  onOpenSendModalForReceipt,
  cloudSyncStatus = { status: 'synced', details: 'Sincronizado na Nuvem' },
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_phone' | 'has_email' | 'linked'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteMultiple, setConfirmDeleteMultiple] = useState(false);

  // WhatsApp Web Extraction & Import State
  const [showWhatsAppPanel, setShowWhatsAppPanel] = useState(true);
  const [waRawInput, setWaRawInput] = useState('');
  const [waParsedList, setWaParsedList] = useState<Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSuccess, setWaSuccess] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Map of mechanical numbers and names to receipts for quick match check
  const receiptMecanSet = useMemo(() => {
    const s = new Set<string>();
    receipts.forEach((r) => {
      if (r.mechanicalNumber) s.add(r.mechanicalNumber.replace(/\D/g, ''));
    });
    return s;
  }, [receipts]);

  const receiptNameMap = useMemo(() => {
    const m = new Map<string, ReceiptData>();
    receipts.forEach((r) => {
      m.set(r.employeeName.toLowerCase().trim(), r);
      if (r.mechanicalNumber) {
        m.set(r.mechanicalNumber.replace(/\D/g, ''), r);
      }
    });
    return m;
  }, [receipts]);

  // Check if contact is linked to a receipt
  const getLinkedReceipt = (c: CollaboratorContact): ReceiptData | undefined => {
    if (c.mechanicalNumber) {
      const match = receiptNameMap.get(c.mechanicalNumber.replace(/\D/g, ''));
      if (match) return match;
    }
    return receiptNameMap.get(c.name.toLowerCase().trim());
  };

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.mechanicalNumber && c.mechanicalNumber.includes(q)) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.department && c.department.toLowerCase().includes(q));

      const isLinked = Boolean(getLinkedReceipt(c));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'has_phone'
          ? Boolean(c.phone)
          : statusFilter === 'has_email'
          ? Boolean(c.email)
          : isLinked;

      return matchesQuery && matchesStatus;
    });
  }, [contacts, searchTerm, statusFilter, receiptNameMap]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredContacts.length > 0 && selectedIds.size === filteredContacts.length;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportExcel = () => {
    const buffer = exportContactsToExcel(contacts);
    const blob = new Blob([buffer as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contactos_Colaboradores_${contacts.length}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGoogleCsv = () => {
    const csv = exportContactsToGoogleCsv(contacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Google_Contacts_${contacts.length}_Colaboradores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStandardCsv = () => {
    const csv = exportContactsToStandardCsv(contacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lista_Contactos_${contacts.length}_Colaboradores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportVCard = () => {
    const vcf = exportContactsToVCard(contacts);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contactos_WhatsApp_${contacts.length}_Colaboradores.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcessWhatsAppText = () => {
    setWaError(null);
    setWaSuccess(null);
    if (!waRawInput.trim()) {
      setWaError('Por favor cole o texto dos contactos ou participantes do WhatsApp Web.');
      return;
    }

    const parsed = parseWhatsAppRawText(waRawInput);
    if (parsed.length === 0) {
      setWaError('Nenhum número de telefone válido ou contacto foi detectado no texto colado.');
      setWaParsedList([]);
      return;
    }

    setWaParsedList(parsed);
  };

  const handleConfirmAddWhatsAppContacts = () => {
    if (!onImportContacts || waParsedList.length === 0) return;

    const fullContacts: CollaboratorContact[] = waParsedList.map((c, idx) => ({
      ...c,
      id: `contact_wa_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onImportContacts(fullContacts, true);
    setWaSuccess(`${fullContacts.length} contactos do WhatsApp Web foram adicionados e vinculados aos recibos!`);
    setWaParsedList([]);
    setWaRawInput('');
    setTimeout(() => setWaSuccess(null), 4000);
  };

  const consoleExtractorScript = `// Copie e cole na Consola do WhatsApp Web (F12 -> Console -> Enter):
const items = [];
document.querySelectorAll('span[title]').forEach(e => {
  const val = e.getAttribute('title');
  if (val && (val.includes('+') || /\\d{9}/.test(val))) items.push(val);
});
const list = [...new Set(items)].join(', ');
console.log(list);
if (list) {
  copy(list);
  alert('Contactos do WhatsApp Web copiados para a área de transferência! Cole agora na aplicação.');
} else {
  alert('Abra a informação de um grupo ou conversa no WhatsApp Web primeiro.');
}`;

  const copyExtractorScript = () => {
    navigator.clipboard.writeText(consoleExtractorScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleForceSync = async () => {
    try {
      setIsForceSyncing(true);
      setSyncNotice('A verificar contactos e a sincronizar com a base de dados Firestore na nuvem...');
      const res = await forceBidirectionalSync();
      if (res.uploadedCount > 0) {
        setSyncNotice(
          `Sincronização concluída com sucesso! ${res.uploadedCount} novos contactos foram enviados para a nuvem. Todos os ${res.totalCount} contactos estão disponíveis em todas as plataformas hospedadas.`
        );
      } else {
        setSyncNotice(
          `Todos os ${res.totalCount} contactos já se encontram 100% atualizados e sincronizados em todas as plataformas.`
        );
      }
      setTimeout(() => setSyncNotice(null), 7000);
    } catch (err: any) {
      console.error('Erro na sincronização forçada:', err);
      setSyncNotice(`Erro ao sincronizar com Firestore: ${err?.message || 'Falha de rede'}`);
      setTimeout(() => setSyncNotice(null), 6000);
    } finally {
      setIsForceSyncing(false);
    }
  };

  // Stats
  const totalCount = contacts.length;
  const withPhoneCount = contacts.filter((c) => c.phone).length;
  const withEmailCount = contacts.filter((c) => c.email).length;
  const linkedCount = contacts.filter((c) => getLinkedReceipt(c)).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card & Stats */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-app-primary dark:text-white font-bold text-lg">
              <Users className="w-5 h-5 text-app-primary" />
              <h2>Lista e Agenda de Contactos dos Colaboradores</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                  cloudSyncStatus.status === 'synced'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : cloudSyncStatus.status === 'connecting'
                    ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                }`}
                title="Sincronização em tempo real entre todos os sistemas hospedados via Firestore"
              >
                <Cloud className="w-3 h-3 shrink-0" />
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cloudSyncStatus.status === 'synced'
                      ? 'bg-emerald-500'
                      : cloudSyncStatus.status === 'connecting'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span>
                  {cloudSyncStatus.status === 'synced'
                    ? 'Sincronizado na Nuvem'
                    : cloudSyncStatus.status === 'connecting'
                    ? 'A ligar à Nuvem...'
                    : 'Modo Offline / Local'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Todos os contactos são sincronizados em tempo real entre todos os sistemas hospedados. Pode adicionar manualmente ou importar (Google Contacts CSV e WhatsApp Web).
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onAddContact}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-app-primary hover:opacity-95 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Adicionar e gravar um novo contacto manualmente"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Contacto</span>
            </button>

            {/* WhatsApp Web Quick Import Tool Button */}
            <button
              onClick={() => setShowWhatsAppPanel(!showWhatsAppPanel)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                showWhatsAppPanel
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="Abrir campo para importar contactos diretamente do WhatsApp Web"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Importar do WhatsApp Web</span>
              {showWhatsAppPanel ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={onImportClick}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Importar contactos de ficheiro CSV do Google ou Excel"
            >
              <UploadCloud className="w-4 h-4 text-emerald-700" />
              <span>Importar Ficheiro (CSV / Google)</span>
            </button>

            <button
              onClick={onSyncWithReceipts}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Vincular automaticamente contactos aos recibos pelo nome ou nº mecânico"
            >
              <Link className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">Vincular a Recibos</span>
            </button>

            {/* Export Dropdown / Buttons */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Exportar agenda de contactos para ficheiro Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportGoogleCsv}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Exportar para formato Google Contacts CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar Google CSV</span>
            </button>

            <button
              onClick={handleExportVCard}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Exportar agenda em formato vCard (.vcf) para WhatsApp ou telemóvel"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              <span>Exportar vCard</span>
            </button>

            <button
              onClick={() => exportContactsToJson(contacts)}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descarregar cópia de segurança completa de todos os contactos em formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Backup JSON</span>
            </button>

            <button
              onClick={handleForceSync}
              disabled={isForceSyncing}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
              title="Garantir que todos os 467 contactos e dados locais estão sincronizados no Firestore para todas as plataformas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isForceSyncing ? 'animate-spin' : ''}`} />
              <span>{isForceSyncing ? 'A Sincronizar...' : 'Sincronizar Nuvem (Todos)'}</span>
            </button>
          </div>
        </div>

        {/* Sync Notification Banner */}
        {syncNotice && (
          <div className="p-3 bg-sky-50 dark:bg-sky-950/80 border-b border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{syncNotice}</span>
            </div>
            <button
              onClick={() => setSyncNotice(null)}
              className="text-xs text-sky-700 hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/50">
          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Total de Contactos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-900">{totalCount}</span>
              <span className="text-xs text-slate-400">gravados</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Com WhatsApp</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-700">{withPhoneCount}</span>
              <span className="text-xs text-slate-400">números válidos</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Com E-mail</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-blue-800">{withEmailCount}</span>
              <span className="text-xs text-slate-400">endereços</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Vinculados a Recibos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-purple-700">{linkedCount}</span>
              <span className="text-xs text-slate-400">de {receipts.length} recibos</span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Web Contacts Extraction & Import Panel */}
      {showWhatsAppPanel && (
        <div className="bg-emerald-50/50 border border-emerald-300 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Campo para Importar Contactos a partir do WhatsApp Web
                </h3>
                <p className="text-xs text-slate-600">
                  Importe números e nomes copiados de conversas, grupos de colaboradores ou ficheiros de contacto (.vcf) do WhatsApp Web para o sistema.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                title="Abrir WhatsApp Web no navegador"
              >
                <span>Ir para WhatsApp Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                type="button"
                onClick={copyExtractorScript}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Copiar código para extrair todos os participantes no console do WhatsApp Web"
              >
                <Code className="w-3.5 h-3.5 text-blue-700" />
                <span>{copiedScript ? 'Script Copiado!' : 'Copiar Script Extrator'}</span>
              </button>
            </div>
          </div>

          {/* Quick Input Textarea */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Cole aqui os contactos copiados do WhatsApp Web para importar:
            </label>
            <textarea
              rows={3}
              value={waRawInput}
              onChange={(e) => setWaRawInput(e.target.value)}
              placeholder="Exemplo 1 (Grupo): +244 923 101 001, +244 923 101 002, Alfredo Macedo (+244 923 101 003)&#10;Exemplo 2 (Linhas): Alfredo Bumba: +244 923 101 001&#10;Exemplo 3 (vCard): BEGIN:VCARD..."
              className="w-full p-3 font-mono text-xs bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900 leading-relaxed shadow-2xs"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-[11px] text-slate-500">
                Suporta números de Angola (+244), Portugal (+351), internacionais, listas separadas por vírgula ou cartões vCard (.vcf).
              </div>
              <div className="flex items-center gap-2">
                {waRawInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setWaRawInput('');
                      setWaParsedList([]);
                      setWaError(null);
                    }}
                    className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleProcessWhatsAppText}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Analisar e Importar Contactos</span>
                </button>
              </div>
            </div>
          </div>

          {/* Success or error message */}
          {waError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{waError}</span>
            </div>
          )}

          {waSuccess && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{waSuccess}</span>
            </div>
          )}

          {/* Parsed WhatsApp List Preview */}
          {waParsedList.length > 0 && (
            <div className="p-3.5 bg-white border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{waParsedList.length} contactos detectados para importar do WhatsApp Web:</span>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmAddWhatsAppContacts}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Importar e Vincular ({waParsedList.length}) aos Recibos</span>
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3">Nome / Identificador</th>
                      <th className="py-1.5 px-3">Número de Telefone / WhatsApp</th>
                      <th className="py-1.5 px-3">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waParsedList.map((c, i) => (
                      <tr key={i} className="hover:bg-emerald-50/50">
                        <td className="py-1.5 px-3 font-semibold text-slate-800">{c.name}</td>
                        <td className="py-1.5 px-3 font-mono font-medium text-emerald-800">{c.phone}</td>
                        <td className="py-1.5 px-3 text-slate-500 text-[11px]">{c.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Guide */}
          <div className="p-3 bg-white/80 border border-slate-200 rounded-xl text-xs space-y-2">
            <span className="font-bold text-slate-800 block">
              💡 3 Formas Práticas de Importar Contactos a partir do WhatsApp Web:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-600">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <strong className="text-slate-800 block mb-0.5">1. Grupo de Colaboradores:</strong>
                Abra o grupo no WhatsApp Web, clique no nome do grupo no topo, selecione a lista de números/participantes e copie (`Ctrl+C`). Cole aqui para importar.
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <strong className="text-slate-800 block mb-0.5">2. Script Automático:</strong>
                Clique em «Copiar Script Extrator» acima, abra o WhatsApp Web, prima `F12` $\rightarrow$ Consola e cole (`Ctrl+V` + Enter). Os números são copiados automaticamente para colar aqui.
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <strong className="text-slate-800 block mb-0.5">3. Ficheiro vCard (.vcf):</strong>
                Recebeu ou descarregou contactos do WhatsApp? Arraste ou cole aqui o conteúdo para importar para a lista.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Toolbar: Search, Filters, Selection */}
        <div className="p-4 border-b border-slate-200/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por nome, nº mecânico, telefone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-blue-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos ({contacts.length})
              </button>
              <button
                onClick={() => setStatusFilter('has_phone')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'has_phone'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                WhatsApp ({withPhoneCount})
              </button>
              <button
                onClick={() => setStatusFilter('has_email')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'has_email'
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                E-mail ({withEmailCount})
              </button>
              <button
                onClick={() => setStatusFilter('linked')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'linked'
                    ? 'bg-purple-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Vinculados ({linkedCount})
              </button>
            </div>
          </div>

          {/* Selection and Batch Delete Row */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={isAllSelected ? clearSelection : selectAll}
                className="flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-800 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-800" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>{isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
              </button>
              <span className="text-slate-300">|</span>
              <span>
                A exibir <strong className="text-slate-800">{filteredContacts.length}</strong> de{' '}
                <strong className="text-slate-800">{contacts.length}</strong> contactos
              </span>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setConfirmDeleteMultiple(true)}
                className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Selecionados ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>

        {/* Delete Multiple Confirmation */}
        {confirmDeleteMultiple && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
            <div>
              <strong className="block">Eliminar {selectedIds.size} contactos selecionados?</strong>
              <span className="text-rose-700">Esta ação irá remover estes contactos permanentemente da agenda.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setConfirmDeleteMultiple(false)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteMultiple(Array.from(selectedIds));
                  setSelectedIds(new Set());
                  setConfirmDeleteMultiple(false);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
              >
                Sim, Eliminar
              </button>
            </div>
          </div>
        )}

        {/* Contacts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                <th className="py-3 px-4 w-10 text-center">
                  <span className="sr-only">Seleção</span>
                </th>
                <th className="py-3 px-4 font-semibold">Colaborador / Nome</th>
                <th className="py-3 px-4 font-semibold">Telefone / WhatsApp</th>
                <th className="py-3 px-4 font-semibold">Endereço de E-mail</th>
                <th className="py-3 px-4 font-semibold">Departamento / Categoria</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                    <p className="font-semibold text-slate-600 text-sm">Nenhum contacto encontrado</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {searchTerm
                        ? `Não foram encontrados contactos para a pesquisa "${searchTerm}".`
                        : 'Adicione um novo contacto gravando manualmente ou importe um ficheiro CSV do Google.'}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={onAddContact}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-2xs"
                      >
                        Novo Contacto
                      </button>
                      <button
                        onClick={onImportClick}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg"
                      >
                        Importar CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const linkedReceipt = getLinkedReceipt(c);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelect(c.id)}
                          className="text-slate-400 hover:text-blue-800"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-800" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Colaborador & Vinculação */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.mechanicalNumber && (
                                <span className="font-mono text-[10px] text-slate-400 font-normal">
                                  (Nº {c.mechanicalNumber})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {linkedReceipt ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-medium"
                                  title={`Recibo localizado: Folha ${linkedReceipt.pageNumber} (${linkedReceipt.period})`}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-purple-600" />
                                  <span>Recibo Vinculado ({linkedReceipt.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ)</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Sem recibo ativo correspondente
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp / Telefone (com múltiplos contactos) */}
                      <td className="py-3 px-4">
                        {c.phone ? (
                          <div className="space-y-1">
                            {/* Primary Phone */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-900">{c.phone}</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5">
                                <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                <span>WhatsApp</span>
                              </span>
                              <a
                                href={`https://web.whatsapp.com/send?phone=${c.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                title="Abrir chat direto no WhatsApp Web"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => copyToClipboard(c.phone, `phone_${c.id}`)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                title="Copiar número"
                              >
                                {copiedId === `phone_${c.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* Secondary Alternative Phones */}
                            {c.secondaryPhones && c.secondaryPhones.length > 0 && (
                              <div className="space-y-0.5 pt-0.5">
                                {c.secondaryPhones.map((sec, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/80 w-fit"
                                  >
                                    <span className="text-[10px] text-slate-400 font-medium">Alt {sIdx + 1}:</span>
                                    <span className="font-mono">{sec}</span>
                                    <a
                                      href={`https://web.whatsapp.com/send?phone=${sec.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-0.5 text-emerald-600 hover:text-emerald-800 rounded"
                                      title="Abrir este contacto alternativo no WhatsApp Web"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <button
                                      onClick={() => copyToClipboard(sec, `sec_${c.id}_${sIdx}`)}
                                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
                                      title="Copiar contacto alternativo"
                                    >
                                      {copiedId === `sec_${c.id}_${sIdx}` ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Não registado</span>
                        )}
                      </td>

                      {/* E-mail */}
                      <td className="py-3 px-4">
                        {c.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-800 font-medium truncate max-w-[200px]" title={c.email}>
                              {c.email}
                            </span>
                            <a
                              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Abrir no Gmail"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => copyToClipboard(c.email, `email_${c.id}`)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                              title="Copiar e-mail"
                            >
                              {copiedId === `email_${c.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Não registado</span>
                        )}
                      </td>

                      {/* Departamento / Categoria */}
                      <td className="py-3 px-4 text-slate-600">
                        <div>{c.department || c.category || '-'}</div>
                        {c.category && c.department && (
                          <div className="text-[11px] text-slate-400">{c.category}</div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Send receipt button if matched */}
                          {linkedReceipt && onOpenSendModalForReceipt && (
                            <button
                              onClick={() => onOpenSendModalForReceipt(linkedReceipt)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                              title={`Enviar recibo de ${c.name} por WhatsApp / E-mail`}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onEditContact(c)}
                            className="p-1.5 text-slate-500 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar contacto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteContact(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar contacto"
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
    </div>
  );
};
