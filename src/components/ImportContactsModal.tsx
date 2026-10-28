import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  Check,
  HelpCircle,
  Download,
  MessageCircle,
  Code,
  ExternalLink,
  Phone,
  Sparkles,
} from 'lucide-react';
import { CollaboratorContact } from '../types/contact';
import {
  parseContactsFile,
  parseWhatsAppRawText,
  parseExcelBuffer,
  generateSampleExcelWorkbook,
} from '../utils/contactParser';
import { downloadBlob } from '../utils/zipExport';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newContacts: CollaboratorContact[], overwriteDuplicates: boolean) => void;
}

export const ImportContactsModal: React.FC<ImportContactsModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<
    'excel' | 'google_csv' | 'standard_csv' | 'heuristic' | 'whatsapp' | null
  >(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [parsedList, setParsedList] = useState<
    Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[]
  >([]);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeInputMode, setActiveInputMode] = useState<'excel' | 'whatsapp' | 'paste'>('excel');
  const [pastedText, setPastedText] = useState('');
  const [waRawText, setWaRawText] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    setSheetName(null);

    const fileNameLower = selectedFile.name.toLowerCase();

    // 1. Excel files (.xlsx, .xls)
    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
      try {
        const buffer = await selectedFile.arrayBuffer();
        const { contacts, sheetNames } = parseExcelBuffer(buffer);

        if (contacts.length === 0) {
          setError(
            'Nenhum contacto válido foi encontrado na folha Excel. Certifique-se de que a folha contém cabeçalhos como Nome, WhatsApp, Telefone ou E-mail.'
          );
          setParsedList([]);
          setDetectedType(null);
          return;
        }

        setParsedList(contacts);
        setDetectedType('excel');
        if (sheetNames.length > 0) {
          setSheetName(sheetNames[0]);
        }
      } catch (err: any) {
        console.error('Erro ao processar ficheiro Excel:', err);
        setError(`Falha ao ler o ficheiro Excel: ${err?.message || 'Ficheiro corrompido ou formato não suportado'}`);
      }
      return;
    }

    // 2. CSV / TXT / JSON / TSV files
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;

        // Check if JSON
        if (fileNameLower.endsWith('.json')) {
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              const items = json.map((item) => ({
                name: item.name || item.nome || '',
                phone: item.phone || item.telefone || item.whatsapp || '',
                secondaryPhones: Array.isArray(item.secondaryPhones) ? item.secondaryPhones : [],
                email: item.email || item.mail || '',
                mechanicalNumber: item.mechanicalNumber || item.mecan || item.codigo || undefined,
                department: item.department || item.departamento || undefined,
                notes: item.notes || item.observacoes || undefined,
              }));
              setParsedList(items);
              setDetectedType('standard_csv');
              return;
            }
          } catch {
            // fallback to csv parser
          }
        }

        const { contacts, detectedType: detected } = parseContactsFile(text);
        if (contacts.length === 0) {
          setError('Nenhum contacto válido foi encontrado no ficheiro. Verifique o formato do ficheiro.');
          setParsedList([]);
          setDetectedType(null);
          return;
        }

        setParsedList(contacts);
        setDetectedType(detected);
      } catch (err) {
        console.error(err);
        setError('Erro ao ler o ficheiro. Por favor confirme se é um ficheiro válido.');
      }
    };

    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handlePastedTextProcess = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError('Por favor insira algum texto para importar.');
      return;
    }
    const { contacts, detectedType: detected } = parseContactsFile(pastedText);
    if (contacts.length === 0) {
      setError('Nenhum contacto válido encontrado no texto colado.');
      return;
    }
    setParsedList(contacts);
    setDetectedType(detected);
  };

  const handleProcessWhatsAppText = () => {
    setError(null);
    if (!waRawText.trim()) {
      setError('Por favor insira os números ou participantes copiados do WhatsApp Web.');
      return;
    }
    const parsed = parseWhatsAppRawText(waRawText);
    if (parsed.length === 0) {
      setError('Nenhum contacto ou número válido foi detectado no texto do WhatsApp Web.');
      return;
    }
    setParsedList(parsed);
    setDetectedType('whatsapp');
  };

  const copyExtractorScript = () => {
    const script = `const items = [];
document.querySelectorAll('span[title]').forEach(e => {
  const val = e.getAttribute('title');
  if (val && (val.includes('+') || /\\d{9}/.test(val))) items.push(val);
});
const list = [...new Set(items)].join(', ');
console.log(list);
if (list) {
  copy(list);
  alert('Contactos do WhatsApp Web copiados! Cole agora no campo de importação da aplicação.');
} else {
  alert('Abra a informação de um grupo ou conversa no WhatsApp Web primeiro.');
}`;
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleConfirmImport = () => {
    if (parsedList.length === 0) return;

    const fullContacts: CollaboratorContact[] = parsedList.map((c, idx) => ({
      ...c,
      id: `contact_import_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onImport(fullContacts, overwriteDuplicates);
    onClose();
  };

  const downloadSampleExcel = () => {
    const buffer = generateSampleExcelWorkbook();
    const blob = new Blob([buffer as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, 'Modelo_Importacao_Contactos_Multiplos.xlsx');
  };

  const downloadSampleGoogleCsv = () => {
    const sample = `Name,Given Name,Family Name,E-mail 1 - Type,E-mail 1 - Value,Phone 1 - Type,Phone 1 - Value,Phone 2 - Type,Phone 2 - Value,Organization 1 - Name,Organization 1 - Department,Notes
"Alfredo Bumba João Macedo","Alfredo","Macedo","Trabalho","alfredo.macedo@espacieservices.com","Celular","+244923101001","Trabalho","+244912345678","Espacie Services, Lda","Operações","Nº Mecanográfico: 10100"
"Benisio Manuel Lombo","Benisio","Lombo","Trabalho","benisio.lombo@espacieservices.com","Celular","+244923101002","Trabalho","+244924555123","Espacie Services, Lda","Manutenção","Nº Mecanográfico: 10101"
"Carlos Domingos Silva","Carlos","Silva","Trabalho","carlos.silva@espacieservices.com","Celular","+244923101003","","","Espacie Services, Lda","Logística","Nº Mecanográfico: 10102"`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'modelo_google_contacts_exemplo.csv');
  };

  const downloadSampleStandardCsv = () => {
    const sample = `Nome Completo;Nº Mecanográfico;WhatsApp;Telefone 2;E-mail;Departamento;Observações
"Alfredo Bumba João Macedo";"10100";"+244923101001";"+244912345678";"alfredo.macedo@espacieservices.com";"Operações";"Mecânico"
"Benisio Manuel Lombo";"10101";"+244923101002";"+244924555123";"benisio.lombo@espacieservices.com";"Manutenção";"Serralheiro"
"Carlos Domingos Silva";"10102";"+244923101003";"";"carlos.silva@espacieservices.com";"Logística";"Motorista"`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'modelo_contactos_padrao.csv');
  };

  // Count how many collaborators have multiple phone contacts
  const multiContactCount = parsedList.filter(
    (c) => c.secondaryPhones && c.secondaryPhones.length > 0
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Importar Contactos (Excel / WhatsApp / CSV)
              </h2>
              <p className="text-xs text-slate-300">
                Suporta ficheiros Excel (.xlsx, .xls), múltiplos contactos por colaborador, Google Contacts e WhatsApp Web
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-md flex-wrap">
            <button
              onClick={() => setActiveInputMode('excel')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeInputMode === 'excel'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ficheiro Excel / CSV</span>
            </button>
            <button
              onClick={() => setActiveInputMode('whatsapp')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeInputMode === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Importar do WhatsApp Web</span>
            </button>
            <button
              onClick={() => setActiveInputMode('paste')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeInputMode === 'paste'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Colar Texto</span>
            </button>
          </div>

          {/* Rule banner: Prioritize WhatsApp and first contact */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-950 leading-relaxed">
              <strong className="block text-emerald-900 font-semibold mb-0.5">
                Regra de Priorização Automática de Contactos:
              </strong>
              Um colaborador pode ter mais de um número no ficheiro (ex.: <em>WhatsApp</em>, <em>Telefone 1</em>, <em>Telefone 2</em> ou na mesma célula). O sistema prioriza os <strong>contactos com WhatsApp</strong> e os <strong>primeiros listados</strong> como o número principal de envio; os demais são preservados como contactos secundários / alternativos.
            </div>
          </div>

          {activeInputMode === 'excel' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,.tsv,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f);
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) processFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-600 bg-emerald-50/60 ring-4 ring-emerald-500/10'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80 bg-slate-50/40'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">
                  {file ? file.name : 'Clique para carregar ou arraste o ficheiro Excel (.xlsx / .xls) ou CSV'}
                </h3>
                <p className="text-slate-500 mt-1 max-w-md mx-auto text-xs">
                  Compatível com <strong>Microsoft Excel (.xlsx, .xls)</strong>, Google Contacts CSV, e ficheiros de texto separados por vírgula ou ponto e vírgula.
                </p>
                <span className="inline-block mt-3 px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg text-[11px] shadow-2xs">
                  Procurar Ficheiro (.xlsx, .xls, .csv, .txt)
                </span>
              </div>
            </div>
          ) : activeInputMode === 'whatsapp' ? (
            <div className="space-y-3 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      Importar Contactos a partir do WhatsApp Web
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Cole números copiados de conversas, grupos de colaboradores ou cartões vCard
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href="https://web.whatsapp.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <span>Abrir WhatsApp Web</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={copyExtractorScript}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Code className="w-3 h-3 text-blue-700" />
                    <span>{copiedScript ? 'Script Copiado!' : 'Copiar Script Extrator'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1 text-[11px]">
                  Cole aqui os contactos copiados do WhatsApp Web para importar:
                </label>
                <textarea
                  rows={4}
                  placeholder="Exemplo 1 (Grupo): +244 923 101 001, +244 923 101 002, Alfredo Macedo (+244 923 101 003)&#10;Exemplo 2: Alfredo Bumba: +244 923 101 001&#10;Exemplo 3 (vCard): BEGIN:VCARD..."
                  value={waRawText}
                  onChange={(e) => setWaRawText(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs bg-white border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900 shadow-2xs"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Suporta números de Angola (+244), internacionais e ficheiros de contacto.
                </span>
                <button
                  type="button"
                  onClick={handleProcessWhatsAppText}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Analisar e Importar Contactos</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Cole aqui os dados de contactos (ex.: copiado de folha Excel ou bloco de notas)
              </label>
              <textarea
                rows={5}
                placeholder="Nome; Telefone WhatsApp; Telefone 2; Email; Nº Mecanográfico&#10;Alfredo Bumba; 923101001; 912345678; alfredo@email.com; 10100&#10;Benisio Lombo; 923101002; 924555123; benisio@email.com; 10101"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
              <button
                type="button"
                onClick={handlePastedTextProcess}
                className="mt-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Analisar Texto Colado
              </button>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Preview Section */}
          {parsedList.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">
                    {parsedList.length} colaboradores detectados
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                    {detectedType === 'excel'
                      ? `Ficheiro Excel (.xlsx / .xls)${sheetName ? ` · Folha: ${sheetName}` : ''}`
                      : detectedType === 'google_csv'
                      ? 'Google Contacts CSV'
                      : detectedType === 'whatsapp'
                      ? 'WhatsApp Web'
                      : detectedType === 'standard_csv'
                      ? 'CSV Padrão'
                      : 'Detecção Automática'}
                  </span>
                  {multiContactCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded-full">
                      {multiContactCount} com múltiplos contactos
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteDuplicates}
                    onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Atualizar se o nome ou nº já existir</span>
                </label>
              </div>

              {/* Sample preview table with multi-contact badges */}
              <div className="overflow-x-auto max-h-56 border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Colaborador / Nome</th>
                      <th className="py-2 px-3 font-semibold">Contacto Principal (Prioritário)</th>
                      <th className="py-2 px-3 font-semibold">Outros Contactos</th>
                      <th className="py-2 px-3 font-semibold">E-mail</th>
                      <th className="py-2 px-3 font-semibold">Nº Mecanográfico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedList.slice(0, 10).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {c.name}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {c.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>{c.phone}</span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {c.secondaryPhones && c.secondaryPhones.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {c.secondaryPhones.map((sec, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                                >
                                  {sec}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Nenhum</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{c.email || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {c.mechanicalNumber || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedList.length > 10 && (
                <p className="text-[11px] text-slate-500 text-right">
                  + {parsedList.length - 10} outros colaboradores a importar
                </p>
              )}
            </div>
          )}

          {/* Download Sample Models: Includes Excel (.xlsx) */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Modelos de exemplo para preenchimento:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={downloadSampleExcel}
                className="text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                title="Descarregar folha de cálculo Excel (.xlsx) de exemplo com colunas para múltiplos contactos"
              >
                <Download className="w-3 h-3 text-emerald-700" />
                <span>Modelo Excel (.xlsx)</span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={downloadSampleGoogleCsv}
                className="text-slate-700 hover:text-slate-950 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>Google CSV</span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={downloadSampleStandardCsv}
                className="text-slate-700 hover:text-slate-950 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>CSV Padrão</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs">
          <span className="text-slate-500">
            {parsedList.length > 0
              ? `${parsedList.length} colaboradores prontos para integração`
              : 'Carregue um ficheiro Excel (.xlsx) ou CSV acima'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={parsedList.length === 0}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Importar {parsedList.length > 0 ? `(${parsedList.length})` : ''} Contactos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
