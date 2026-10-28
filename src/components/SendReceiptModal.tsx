import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Send,
  Mail,
  MessageCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Download,
  Share2,
  User,
  Building2,
  Calendar,
  Wallet,
  FileText,
  Clock,
  ArrowRight,
  Filter,
  Smartphone,
  Users,
  BookmarkPlus,
} from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { CollaboratorContact } from '../types/contact';
import { findMatchingContact } from '../utils/contactStorage';
import { getReceiptPdfBlob } from '../utils/pdfGenerator';
import { downloadBlob } from '../utils/zipExport';
import { formatFileName } from '../data';

// Helper to format reference month and year in Portuguese: e.g. "Agosto de 2026"
export function formatReferenceMonthYear(period?: string): string {
  if (!period) return 'Agosto de 2026';
  const trimmed = period.trim();

  // If it already has " de " (e.g. "Agosto de 2026" or "Setembro de 2026")
  if (/^[A-Za-zÀ-ÿ]+\s+de\s+\d{4}$/i.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // If format like "Agosto 2026", "Setembro 2026", etc.
  const monthNameMatch = trimmed.match(/^([A-Za-zÀ-ÿ]+)\s+(\d{4})$/i);
  if (monthNameMatch) {
    const m = monthNameMatch[1];
    const y = monthNameMatch[2];
    const capM = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    return `${capM} de ${y}`;
  }

  // If numeric format like "08/2026" or "08-2026"
  const numericMatch = trimmed.match(/(\d{1,2})[\/\-](\d{4})/);
  if (numericMatch) {
    const monthNum = parseInt(numericMatch[1], 10);
    const year = numericMatch[2];
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${months[monthNum - 1]} de ${year}`;
    }
  }

  return trimmed;
}

interface SendReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: ReceiptData[];
  namingPattern: string;
  initialReceiptId?: string | null;
  onUpdateReceipt: (updated: ReceiptData) => void;
  contacts?: CollaboratorContact[];
  onSaveContact?: (contact: CollaboratorContact) => void;
}

export const SendReceiptModal: React.FC<SendReceiptModalProps> = ({
  isOpen,
  onClose,
  receipts,
  namingPattern,
  initialReceiptId,
  onUpdateReceipt,
  contacts = [],
  onSaveContact,
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [filterSent, setFilterSent] = useState<'all' | 'pending' | 'sent'>('all');
  const [waTemplateStyle, setWaTemplateStyle] = useState<'official' | 'detailed'>('official');
  const [copiedNameNotice, setCopiedNameNotice] = useState(false);

  // WhatsApp form
  const [countryCode, setCountryCode] = useState('+244');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customWaMessage, setCustomWaMessage] = useState('');

  // Email form
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Status
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize selected receipt when opening or changing initialReceiptId
  useEffect(() => {
    if (isOpen) {
      if (initialReceiptId && receipts.some((r) => r.id === initialReceiptId)) {
        setSelectedId(initialReceiptId);
      } else if (receipts.length > 0 && !selectedId) {
        setSelectedId(receipts[0].id);
      }
    }
  }, [isOpen, initialReceiptId, receipts]);

  // Current selected receipt
  const currentReceipt = useMemo(
    () => receipts.find((r) => r.id === selectedId) || receipts[0] || null,
    [receipts, selectedId]
  );

  // Look up matched contact from contacts agenda
  const matchedContact = useMemo(() => {
    if (!currentReceipt || !contacts.length) return undefined;
    return findMatchingContact(currentReceipt.employeeName, currentReceipt.mechanicalNumber, contacts);
  }, [currentReceipt, contacts]);

  // Synchronize contact fields and generate message template
  useEffect(() => {
    if (currentReceipt) {
      // Find matching contact directly based on the current receipt's employee name and mechanical number
      const contact =
        matchedContact ||
        findMatchingContact(currentReceipt.employeeName, currentReceipt.mechanicalNumber, contacts);

      const contactPhone = contact?.phone || '';
      const contactEmail = contact?.email || '';

      const rawPhone =
        contactPhone ||
        currentReceipt.phone ||
        localStorage.getItem(`phone_${currentReceipt.mechanicalNumber}`) ||
        '';

      const rawEmail =
        contactEmail ||
        currentReceipt.email ||
        localStorage.getItem(`email_${currentReceipt.mechanicalNumber}`) ||
        '';

      // Parse country code and local number cleanly
      let detectedCode = '+244';
      let cleanNum = rawPhone.trim();

      const possibleCodes = ['+244', '+351', '+55', '+258', '+238'];
      for (const code of possibleCodes) {
        if (cleanNum.startsWith(code)) {
          detectedCode = code;
          cleanNum = cleanNum.slice(code.length);
          break;
        }
      }

      setCountryCode(detectedCode);
      setPhoneNumber(cleanNum.replace(/^0+/, '').trim());
      setEmailAddress(rawEmail.trim());

      const fileName = formatFileName(currentReceipt, namingPattern);
      const formattedSalary = currentReceipt.netPay.toLocaleString('pt-PT', {
        minimumFractionDigits: 2,
      });
      const refMonthYear = formatReferenceMonthYear(currentReceipt.period);

      // Default WhatsApp message template according to exact user instruction:
      // "Saudações prezado (inclua o neme completo), encontre em anexo o recibo referente ao mês de (Agosto de 2026)"
      if (waTemplateStyle === 'official') {
        setCustomWaMessage(
          `Saudações prezado(a) ${currentReceipt.employeeName}, encontre em anexo o recibo referente ao mês de ${refMonthYear}.`
        );
      } else {
        setCustomWaMessage(
          `Saudações prezado(a) ${currentReceipt.employeeName},\n\n` +
            `Encontre em anexo o recibo referente ao mês de ${refMonthYear}.\n\n` +
            `📄 *Documento:* ${fileName}\n` +
            `💰 *Valor Líquido:* ${formattedSalary} ${currentReceipt.currency}\n` +
            `🏢 *Empresa:* ${currentReceipt.companyName}\n` +
            `📅 *Data de Fecho:* ${currentReceipt.closingDate}\n\n` +
            `Com os melhores cumprimentos,\nEspacie Services, Lda`
        );
      }

      // Default Email template
      setEmailSubject(`Recibo de Vencimento - ${currentReceipt.employeeName} (${refMonthYear})`);
      setEmailBody(
        `Saudações prezado(a) ${currentReceipt.employeeName},\n\n` +
          `Encontre em anexo o recibo de vencimento referente ao mês de ${refMonthYear}.\n\n` +
          `Resumo dos Dados:\n` +
          `- Colaborador: ${currentReceipt.employeeName}\n` +
          `- N.º Mecanográfico: ${currentReceipt.mechanicalNumber}\n` +
          `- Categoria: ${currentReceipt.category}\n` +
          `- Mês de Referência: ${refMonthYear}\n` +
          `- Salário Líquido: ${formattedSalary} ${currentReceipt.currency}\n` +
          `- Ficheiro PDF anexo: ${fileName}\n\n` +
          `O documento oficial em formato PDF encontra-se em anexo a esta mensagem.\n\n` +
          `Atenciosamente,\n` +
          `Departamento de Recursos Humanos & Salários\n` +
          `Espacie Services, Lda · Luanda`
      );
    }
  }, [currentReceipt, matchedContact, contacts, namingPattern, waTemplateStyle]);

  // Filter receipts for search
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.employeeName.toLowerCase().includes(q) ||
        r.mechanicalNumber.includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.sourceDoc.toLowerCase().includes(q);

      const matchesStatus =
        filterSent === 'all'
          ? true
          : filterSent === 'sent'
          ? Boolean(r.sentAt)
          : !r.sentAt;

      return matchesQuery && matchesStatus;
    });
  }, [receipts, searchQuery, filterSent]);

  if (!isOpen || !currentReceipt) return null;

  const currentFileName = formatFileName(currentReceipt, namingPattern);

  // Helper to ensure original PDF is retrieved and downloaded
  const getPdfBlobAndDownload = async (): Promise<Blob> => {
    const { blob } = await getReceiptPdfBlob(currentReceipt);
    downloadBlob(blob, currentFileName);
    return blob;
  };

  // Mark receipt as sent
  const handleMarkAsSent = (channel: 'whatsapp' | 'email') => {
    const timestamp = new Date().toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const updated: ReceiptData = {
      ...currentReceipt,
      phone: phoneNumber ? `${countryCode}${phoneNumber.replace(/\s+/g, '')}` : currentReceipt.phone,
      email: emailAddress || currentReceipt.email,
      sentAt: timestamp,
      sentChannel: channel,
    };

    if (phoneNumber) {
      localStorage.setItem(`phone_${currentReceipt.mechanicalNumber}`, `${countryCode}${phoneNumber.replace(/\s+/g, '')}`);
    }
    if (emailAddress) {
      localStorage.setItem(`email_${currentReceipt.mechanicalNumber}`, emailAddress);
    }

    onUpdateReceipt(updated);
    setSuccessNotice(`Marcado como enviado via ${channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}!`);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  // Switch phone number when collaborator has multiple contacts
  const handleSelectPhone = (rawPhone: string) => {
    let detectedCode = '+244';
    let cleanNum = rawPhone.trim();
    const possibleCodes = ['+244', '+351', '+55', '+258', '+238'];
    for (const code of possibleCodes) {
      if (cleanNum.startsWith(code)) {
        detectedCode = code;
        cleanNum = cleanNum.slice(code.length);
        break;
      }
    }
    setCountryCode(detectedCode);
    setPhoneNumber(cleanNum.replace(/^0+/, '').trim());
  };

  // Copy employee name for WhatsApp Web search bar
  const copyEmployeeNameToClipboard = () => {
    if (currentReceipt) {
      navigator.clipboard.writeText(currentReceipt.employeeName);
      setCopiedNameNotice(true);
      setTimeout(() => setCopiedNameNotice(false), 3000);
    }
  };

  // Send via WhatsApp (Web or App)
  const handleSendWhatsApp = async (target: 'web' | 'app' = 'web') => {
    try {
      setSending(true);
      await getPdfBlobAndDownload();

      // If user hasn't set a phone number, copy employee name so they can paste it directly in the WhatsApp Web search bar
      if (!phoneNumber && currentReceipt) {
        try {
          await navigator.clipboard.writeText(currentReceipt.employeeName);
          setCopiedNameNotice(true);
          setTimeout(() => setCopiedNameNotice(false), 4000);
        } catch {
          // ignore clipboard errors
        }
      }

      // Clean phone number
      const cleanPhone = phoneNumber ? `${countryCode.replace(/\D/g, '')}${phoneNumber.replace(/\D/g, '')}` : '';

      // Determine text to send
      const encodedMsg = customWaMessage ? encodeURIComponent(customWaMessage) : '';

      // WhatsApp Web URL vs WhatsApp App URL
      let waUrl = '';
      if (target === 'web') {
        if (cleanPhone) {
          waUrl = encodedMsg
            ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
            : `https://web.whatsapp.com/send?phone=${cleanPhone}`;
        } else {
          waUrl = encodedMsg
            ? `https://web.whatsapp.com/send?text=${encodedMsg}`
            : `https://web.whatsapp.com`;
        }
      } else {
        if (cleanPhone) {
          waUrl = encodedMsg
            ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
            : `https://api.whatsapp.com/send?phone=${cleanPhone}`;
        } else {
          waUrl = encodedMsg
            ? `https://api.whatsapp.com/send?text=${encodedMsg}`
            : `https://api.whatsapp.com`;
        }
      }

      window.open(waUrl, '_blank');
      handleMarkAsSent('whatsapp');
    } catch (err) {
      console.error('Erro ao baixar recibo ou abrir WhatsApp:', err);
    } finally {
      setSending(false);
    }
  };

  // Send via Mailto (Default Mail Client like Outlook / Thunderbird)
  const handleSendMailto = async () => {
    try {
      setSending(true);
      await getPdfBlobAndDownload();

      const mailtoUrl = `mailto:${encodeURIComponent(emailAddress)}?subject=${encodeURIComponent(
        emailSubject
      )}&body=${encodeURIComponent(emailBody)}`;

      window.location.href = mailtoUrl;
      handleMarkAsSent('email');
    } finally {
      setSending(false);
    }
  };

  // Open in Gmail Web
  const handleOpenGmail = async () => {
    try {
      setSending(true);
      await getPdfBlobAndDownload();

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        emailAddress
      )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

      window.open(gmailUrl, '_blank');
      handleMarkAsSent('email');
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Enviar Recibo por WhatsApp ou E-mail</h2>
              <p className="text-xs text-slate-300">
                Pesquise o colaborador, personalize os dados de contacto e envie o PDF formatado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout: Left search list & Right sending form */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Collaborator Search & Selection */}
          <div className="md:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/70 h-full overflow-hidden">
            {/* Search Bar */}
            <div className="p-3 border-b border-slate-200 bg-white space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou nº mecânico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setFilterSent('all')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    filterSent === 'all'
                      ? 'bg-blue-800 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos ({receipts.length})
                </button>
                <button
                  onClick={() => setFilterSent('pending')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    filterSent === 'pending'
                      ? 'bg-amber-700 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pendentes ({receipts.filter((r) => !r.sentAt).length})
                </button>
                <button
                  onClick={() => setFilterSent('sent')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    filterSent === 'sent'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Enviados ({receipts.filter((r) => Boolean(r.sentAt)).length})
                </button>
              </div>
            </div>

            {/* List of Collaborators */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredReceipts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum colaborador encontrado com "{searchQuery}".
                </div>
              ) : (
                filteredReceipts.map((r) => {
                  const isSelected = r.id === selectedId;
                  const isSent = Boolean(r.sentAt);

                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50/80 border-l-4 border-blue-800'
                          : 'hover:bg-slate-100/70 border-l-4 border-transparent'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-blue-800 text-white'
                            : isSent
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {r.employeeName.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {r.employeeName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            Nº {r.mechanicalNumber}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                          <span className="truncate">{r.category}</span>
                          <span className="font-mono font-medium text-slate-800 shrink-0">
                            {r.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ
                          </span>
                        </div>

                        {/* Sent Badge */}
                        {isSent && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Enviado via {r.sentChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Dispatch Details & Channel Form */}
          <div className="md:col-span-7 flex flex-col h-full overflow-y-auto p-5 space-y-4">
            {/* Top Selected Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{currentReceipt.employeeName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Nº {currentReceipt.mechanicalNumber}</span>
                    <span>·</span>
                    <span>{currentReceipt.category}</span>
                    <span>·</span>
                    <span>{currentReceipt.period}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Valor Líquido</span>
                  <span className="text-sm font-bold font-mono text-blue-900">
                    {currentReceipt.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} AKZ
                  </span>
                </div>
              </div>

              {/* PDF file info badge */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px] truncate">
                  <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="truncate">{currentFileName}</span>
                </div>
                <button
                  onClick={getPdfBlobAndDownload}
                  className="text-[11px] text-blue-800 hover:text-blue-950 font-medium flex items-center gap-1 shrink-0 ml-2"
                  title="Baixar ficheiro PDF original deste colaborador"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar PDF Original</span>
                </button>
              </div>

              {/* Status if previously sent */}
              {currentReceipt.sentAt && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Recibo enviado em <strong>{currentReceipt.sentAt}</strong> via{' '}
                      <strong>{currentReceipt.sentChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</strong>.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notification alert banner */}
            {successNotice && (
              <div className="p-2.5 bg-emerald-600 text-white rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Channel Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveChannel('whatsapp')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeChannel === 'whatsapp'
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => setActiveChannel('email')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeChannel === 'email'
                    ? 'border-blue-700 text-blue-800 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mail className="w-4 h-4 text-blue-700" />
                <span>E-mail</span>
              </button>
            </div>

            {/* Channel Panel: WhatsApp */}
            {activeChannel === 'whatsapp' && (
              <div className="space-y-4">
                {/* Collaborator Search Assist in WhatsApp Web */}
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                        Colaborador para Pesquisa no WhatsApp
                      </span>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span>{currentReceipt.employeeName}</span>
                        <span className="text-[10px] font-mono text-slate-500 font-normal">
                          (Nº {currentReceipt.mechanicalNumber})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={copyEmployeeNameToClipboard}
                      className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Copiar nome do colaborador para colar na barra de pesquisa do WhatsApp Web (Ctrl+V)"
                    >
                      <Copy className="w-3 h-3 text-blue-700" />
                      <span>{copiedNameNotice ? 'Nome Copiado!' : 'Copiar Nome para Pesquisa'}</span>
                    </button>
                  </div>

                  {matchedContact && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-800 font-semibold bg-blue-100/70 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span>Contacto vinculado da Agenda: {matchedContact.name} ({matchedContact.phone || matchedContact.email})</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-600">
                    {phoneNumber
                      ? `Número preenchido: o WhatsApp Web abrirá diretamente na conversa de ${currentReceipt.employeeName}.`
                      : `Ao abrir o WhatsApp Web, o nome "${currentReceipt.employeeName}" é copiado automaticamente: basta premir Ctrl+V no campo de pesquisa do WhatsApp.`}
                  </p>
                </div>


                {/* Phone number input (optional) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Número de Telefone / WhatsApp do Colaborador (Opcional)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="+244">🇦🇴 +244 (Angola)</option>
                      <option value="+351">🇵🇹 +351 (Portugal)</option>
                      <option value="+55">🇧🇷 +55 (Brasil)</option>
                      <option value="+258">🇲🇿 +258 (Moçambique)</option>
                      <option value="+238">🇨🇻 +238 (Cabo Verde)</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Ex.: 923 456 789 (se omitido, pesquisa por nome)"
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('+244')) {
                          setCountryCode('+244');
                          setPhoneNumber(val.replace(/^.*?\+244/, '').replace(/\D/g, ''));
                        } else if (val.includes('+351')) {
                          setCountryCode('+351');
                          setPhoneNumber(val.replace(/^.*?\+351/, '').replace(/\D/g, ''));
                        } else if (val.includes('+55')) {
                          setCountryCode('+55');
                          setPhoneNumber(val.replace(/^.*?\+55/, '').replace(/\D/g, ''));
                        } else {
                          setPhoneNumber(val);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  {matchedContact?.phone && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Telefone associado automaticamente: <strong>{matchedContact.name}</strong> ({matchedContact.phone})
                        </span>
                      </div>

                      {/* Multi-contact selector pills if collaborator has multiple numbers */}
                      {matchedContact.secondaryPhones && matchedContact.secondaryPhones.length > 0 && (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Múltiplos Contactos do Colaborador (clique para alternar):
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSelectPhone(matchedContact.phone)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                phoneNumber && matchedContact.phone.includes(phoneNumber)
                                  ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                              title="Usar número principal (prioritário do WhatsApp)"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>1º WhatsApp: {matchedContact.phone}</span>
                            </button>
                            {matchedContact.secondaryPhones.map((sec, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectPhone(sec)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 cursor-pointer ${
                                  phoneNumber && sec.includes(phoneNumber)
                                    ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                                }`}
                                title={`Usar contacto alternativo ${idx + 1}`}
                              >
                                <span>Alt {idx + 1}: {sec}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {phoneNumber && !matchedContact?.phone && onSaveContact && (
                    <button
                      type="button"
                      onClick={() => {
                        const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
                        const newContact: CollaboratorContact = {
                          id: `contact_${Date.now()}`,
                          name: currentReceipt.employeeName,
                          mechanicalNumber: currentReceipt.mechanicalNumber,
                          phone: fullPhone,
                          email: emailAddress || currentReceipt.email || '',
                          department: currentReceipt.department,
                          category: currentReceipt.category,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        onSaveContact(newContact);
                        setSuccessNotice(`Contacto gravado na agenda: ${currentReceipt.employeeName}`);
                        setTimeout(() => setSuccessNotice(null), 3000);
                      }}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 mt-1.5 cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Gravar este número na Agenda de Contactos</span>
                    </button>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se introduzir o número, abre o chat direto. Caso contrário, pesquisa pelo nome do colaborador no WhatsApp.
                  </p>
                </div>

                {/* Message preview and template style */}
                <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <label className="text-xs font-semibold text-slate-800">Mensagem Automática</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setWaTemplateStyle('official')}
                          className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                            waTemplateStyle === 'official'
                              ? 'bg-emerald-700 text-white font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Formato solicitado: Saudações prezado [Nome], encontre em anexo o recibo referente ao mês de [Mês de Ano]"
                        >
                          Padrão Oficial
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaTemplateStyle('detailed')}
                          className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                            waTemplateStyle === 'detailed'
                              ? 'bg-emerald-700 text-white font-semibold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Formato com detalhes: Documento, Valor Líquido e Empresa"
                        >
                          Com Detalhes
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(customWaMessage)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors ml-1.5 px-1.5 py-0.5 rounded hover:bg-slate-100"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      value={customWaMessage}
                      onChange={(e) => setCustomWaMessage(e.target.value)}
                      className="w-full p-2.5 text-xs font-sans bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 leading-relaxed"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pode editar o texto livremente antes de enviar.
                    </p>
                  </div>

                {/* WhatsApp Action Buttons prioritized for WhatsApp Web */}
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={() => handleSendWhatsApp('web')}
                    disabled={sending}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    title="Baixar recibo original e abrir conversa no WhatsApp Web com mensagem automática"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{sending ? 'A transferir recibo...' : 'Abrir no WhatsApp Web com Mensagem'}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleSendWhatsApp('app')}
                      disabled={sending}
                      className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      title="Baixar recibo original e abrir no aplicativo WhatsApp instalado no computador ou telemóvel"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{sending ? 'A transferir...' : 'Abrir no WhatsApp App / Móvel'}</span>
                    </button>

                    <button
                      onClick={copyEmployeeNameToClipboard}
                      className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      title="Copiar nome do colaborador para a pesquisa"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{copiedNameNotice ? 'Nome Copiado!' : 'Copiar Nome'}</span>
                    </button>
                  </div>

                  {/* WhatsApp Web Guidance Box */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Envio de Notificação via WhatsApp: {currentReceipt.employeeName}</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5 pl-1">
                      <li>O recibo original em PDF é descarregado automaticamente para o seu dispositivo ao abrir.</li>
                      <li>A mensagem automática com o aviso de vencimento ({formatReferenceMonthYear(currentReceipt.period)}) é inserida diretamente no WhatsApp.</li>
                      <li>
                        O nome <strong>{currentReceipt.employeeName}</strong> fica copiado para pesquisar no WhatsApp Web (basta premir <code>Ctrl+V</code> na barra de busca se não tiver o número gravado).
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Channel Panel: E-mail */}
            {activeChannel === 'email' && (
              <div className="space-y-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Endereço de E-mail do Colaborador
                  </label>
                  <input
                    type="email"
                    placeholder="exemplo@espacieservices.com ou colaborador@gmail.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  {matchedContact?.email && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-800 font-medium bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg mt-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        E-mail associado automaticamente do contacto: <strong>{matchedContact.name}</strong> ({matchedContact.email})
                      </span>
                    </div>
                  )}
                </div>

                {/* Email Subject */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assunto do E-mail</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Email Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700">Corpo do E-mail</label>
                    <button
                      onClick={() => copyToClipboard(emailBody)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full p-2.5 text-xs font-sans bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Email Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleOpenGmail}
                    disabled={sending}
                    className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Abrir no Gmail Web</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>

                  <button
                    onClick={handleSendMailto}
                    disabled={sending}
                    className="py-2.5 px-3 bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Outlook / Mail Client (mailto)</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 text-center">
                  O ficheiro <code className="text-blue-800">{currentFileName}</code> é descarregado para a sua pasta de transferências para anexar diretamente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="text-slate-500">
            Total de {receipts.length} recibos disponíveis para expedição
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
