import React from 'react';
import { Tag } from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { formatFileName } from '../data';

interface NamingPatternSelectorProps {
  pattern: string;
  setPattern: (p: string) => void;
  sampleReceipt?: ReceiptData;
}

const PRESET_PATTERNS = [
  {
    label: 'Padrão com Nº Mecânico e Nome',
    pattern: 'Recibo_{MECAN}_{NOME_LIMPO}.pdf',
    desc: 'Ex: Recibo_10100_Alfredo_Bumba_Joao_Macedo.pdf',
  },
  {
    label: 'Nome Completo com Acentos',
    pattern: '{NOME} - Recibo {PERIODO}.pdf',
    desc: 'Ex: Alfredo Bumba João Macedo - Recibo Setembro 2026.pdf',
  },
  {
    label: 'Nome Limpo Simples',
    pattern: '{NOME_LIMPO}.pdf',
    desc: 'Ex: Alfredo_Bumba_Joao_Macedo.pdf',
  },
  {
    label: 'Nome, Mecan e Categoria',
    pattern: '{NOME_LIMPO}_{MECAN}_{CATEGORIA}.pdf',
    desc: 'Ex: Alfredo_Bumba_Joao_Macedo_10100_MECANICO.pdf',
  },
];

export const NamingPatternSelector: React.FC<NamingPatternSelectorProps> = ({
  pattern,
  setPattern,
  sampleReceipt,
}) => {
  const preview = sampleReceipt ? formatFileName(sampleReceipt, pattern) : 'Recibo.pdf';

  const insertTag = (tag: string) => {
    setPattern(pattern.replace('.pdf', '') + tag + '.pdf');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-app-primary" />
            Configuração do Nome dos Ficheiros
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define como cada recibo individual será nomeado após a separação
          </p>
        </div>

        {/* Live Preview Pill */}
        <div className="text-xs px-3 py-1.5 app-primary-subtle-btn border rounded-lg font-mono">
          <span className="opacity-70 mr-1.5 font-sans">Exemplo:</span>
          <span className="font-semibold text-app-primary">{preview}</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {PRESET_PATTERNS.map((preset) => {
          const isSelected = pattern === preset.pattern;
          return (
            <button
              key={preset.pattern}
              onClick={() => setPattern(preset.pattern)}
              type="button"
              className={`p-3 text-left rounded-lg border transition-all text-xs cursor-pointer ${
                isSelected
                  ? 'border-app-primary bg-slate-50 dark:bg-slate-800/80 ring-1 ring-app-primary'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200">{preset.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">{preset.pattern}</div>
            </button>
          );
        })}
      </div>

      {/* Custom Pattern Input */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Personalizar modelo de nomenclatura:
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-app-primary"
            placeholder="Ex: Recibo_{NOME_LIMPO}_{MECAN}.pdf"
          />
        </div>

        <div className="sm:self-end">
          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">Variáveis disponíveis:</span>
          <div className="flex items-center gap-1 flex-wrap">
            {['{NOME}', '{NOME_LIMPO}', '{MECAN}', '{CATEGORIA}', '{PERIODO}'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => insertTag(t)}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title={`Inserir ${t}`}
              >
                +{t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
