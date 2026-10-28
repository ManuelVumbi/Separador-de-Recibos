import React from 'react';
import {
  X,
  Palette,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Coins,
  Send,
  Users,
} from 'lucide-react';
import {
  ThemeSettings,
  ACCENT_OPTIONS,
  MODE_OPTIONS,
  SURFACE_OPTIONS,
  AccentColor,
  ColorMode,
  SurfaceTint,
  DEFAULT_THEME_SETTINGS,
} from '../utils/theme';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThemeSettings;
  onUpdateSettings: (newSettings: ThemeSettings) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const handleModeChange = (mode: ColorMode) => {
    onUpdateSettings({ ...settings, mode });
  };

  const handleAccentChange = (accent: AccentColor) => {
    onUpdateSettings({ ...settings, accent });
  };

  const handleSurfaceChange = (surface: SurfaceTint) => {
    onUpdateSettings({ ...settings, surface });
  };

  const handleReset = () => {
    onUpdateSettings(DEFAULT_THEME_SETTINGS);
  };

  const currentAccent = ACCENT_OPTIONS.find((a) => a.id === settings.accent) || ACCENT_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-app-primary text-white flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Cores e Ambiente de Trabalho
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personalize o tom, o contraste e as cores do sistema ao seu gosto.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200 text-xs">
          {/* Section 1: Modo de Iluminação */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Modo de Iluminação</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Claro, Escuro ou Sincronizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {MODE_OPTIONS.map((opt) => {
                const isActive = settings.mode === opt.id;
                const IconComponent =
                  opt.id === 'light' ? Sun : opt.id === 'dark' ? Moon : Laptop;

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleModeChange(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isActive
                        ? 'border-app-primary bg-slate-50 dark:bg-slate-800/90 ring-1 ring-app-primary shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <IconComponent className={`w-4 h-4 ${isActive ? 'text-app-primary' : 'text-slate-500'}`} />
                        <span>{opt.label}</span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-app-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Paleta de Cores de Destaque */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-app-primary" />
                <span>Cor de Destaque do Ambiente</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Define botões, seletores e indicadores
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const isActive = settings.accent === opt.id;

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleAccentChange(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'border-app-primary bg-slate-50 dark:bg-slate-800/90 ring-1 ring-app-primary shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-5 h-5 rounded-full shrink-0 shadow-2xs border border-white/20"
                        style={{ backgroundColor: opt.hex }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>{opt.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {opt.category}
                        </div>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-app-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Tonalidade da Superfície */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>Tonalidade da Superfície de Fundo</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Ajuste fino de conforto visual
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SURFACE_OPTIONS.map((opt) => {
                const isActive = settings.surface === opt.id;

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSurfaceChange(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      isActive
                        ? 'border-app-primary bg-slate-50 dark:bg-slate-800/90 ring-1 ring-app-primary shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">{opt.label}</span>
                      {isActive && <Check className="w-3.5 h-3.5 text-app-primary shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview Strip */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <span>Pré-visualização em Tempo Real</span>
              <span className="font-mono text-slate-400">{currentAccent.name}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-app-primary text-white shadow-2xs flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Botão Principal</span>
              </button>

              <button className="px-3 py-1.5 text-xs font-medium rounded-lg app-primary-subtle-btn border flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Ação Secundária</span>
              </button>

              <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>1.450.000 AKZ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Repor opções iniciais de cor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-app-primary text-white hover:opacity-95 transition-opacity shadow-xs cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
