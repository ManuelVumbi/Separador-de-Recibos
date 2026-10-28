export type AccentColor = 'blue' | 'emerald' | 'indigo' | 'teal' | 'slate' | 'amber' | 'rose';
export type ColorMode = 'light' | 'dark' | 'system';
export type SurfaceTint = 'default' | 'warm' | 'pure';

export interface ThemeSettings {
  accent: AccentColor;
  mode: ColorMode;
  surface: SurfaceTint;
}

export interface AccentOption {
  id: AccentColor;
  name: string;
  category: string;
  hex: string;
  ringHex: string;
  description: string;
  badgeBg: string;
  badgeText: string;
}

export interface ModeOption {
  id: ColorMode;
  label: string;
  description: string;
}

export interface SurfaceOption {
  id: SurfaceTint;
  label: string;
  description: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'blue',
    name: 'Azul Corporativo',
    category: 'Clássico Empresarial',
    hex: '#1e40af',
    ringHex: '#3b82f6',
    description: 'Tom azul safira tradicional de ambiente corporativo e financeiro.',
    badgeBg: 'bg-blue-100 dark:bg-blue-950',
    badgeText: 'text-blue-800 dark:text-blue-300',
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    category: 'Executivo & Controlo',
    hex: '#059669',
    ringHex: '#10b981',
    description: 'Tom verde refinado focado em liquidações, salários e eficiência.',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
  },
  {
    id: 'indigo',
    name: 'Índigo Nobre',
    category: 'Moderno & Tecnológico',
    hex: '#4f46e5',
    ringHex: '#6366f1',
    description: 'Paleta moderna com contraste profundo e foco na leitura digital.',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950',
    badgeText: 'text-indigo-800 dark:text-indigo-300',
  },
  {
    id: 'teal',
    name: 'Petróleo & Oceano',
    category: 'Elegante & Suave',
    hex: '#0d9488',
    ringHex: '#14b8a6',
    description: 'Ciano petróleo relaxante, ideal para longas jornadas de verificação.',
    badgeBg: 'bg-teal-100 dark:bg-teal-950',
    badgeText: 'text-teal-800 dark:text-teal-300',
  },
  {
    id: 'slate',
    name: 'Grafite & Ardósia',
    category: 'Minimalista Neutro',
    hex: '#475569',
    ringHex: '#64748b',
    description: 'Estética monocromática discreta, técnica e sem distrações visuais.',
    badgeBg: 'bg-slate-200 dark:bg-slate-800',
    badgeText: 'text-slate-800 dark:text-slate-200',
  },
  {
    id: 'amber',
    name: 'Âmbar Executivo',
    category: 'Bronze & Prestígio',
    hex: '#d97706',
    ringHex: '#f59e0b',
    description: 'Tons acolhedores dourados e quentes com forte presença executiva.',
    badgeBg: 'bg-amber-100 dark:bg-amber-950',
    badgeText: 'text-amber-800 dark:text-amber-300',
  },
  {
    id: 'rose',
    name: 'Bordô & Rubro',
    category: 'Distinto & Institucional',
    hex: '#e11d48',
    ringHex: '#f43f5e',
    description: 'Tom carmesim refinado de identidade forte e de alta distinção.',
    badgeBg: 'bg-rose-100 dark:bg-rose-950',
    badgeText: 'text-rose-800 dark:text-rose-300',
  },
];

export const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'light',
    label: 'Modo Claro',
    description: 'Ambiente diurno clássico com máxima luminosidade e contraste nítido.',
  },
  {
    id: 'dark',
    label: 'Modo Escuro',
    description: 'Ambiente noturno suave que reduz a fadiga ocular em salas com pouca luz.',
  },
  {
    id: 'system',
    label: 'Automático / Sistema',
    description: 'Alterna automaticamente com base nas preferências do seu sistema operativo.',
  },
];

export const SURFACE_OPTIONS: SurfaceOption[] = [
  {
    id: 'default',
    label: 'Ardósia Equilibrada',
    description: 'Superfície com ligeiro toque moderno de neutralidade fria.',
  },
  {
    id: 'warm',
    label: 'Areia Conforto',
    description: 'Superfície com toque aconchegante suave, minimizando o cansaço.',
  },
  {
    id: 'pure',
    label: 'Puro / Alto Contraste',
    description: 'Branco alvo em modo claro e preto profundo (OLED) em modo escuro.',
  },
];

const THEME_STORAGE_KEY = 'app_environment_theme_config';

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  accent: 'blue',
  mode: 'light',
  surface: 'default',
};

export function getStoredThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      accent: ['blue', 'emerald', 'indigo', 'teal', 'slate', 'amber', 'rose'].includes(parsed.accent)
        ? parsed.accent
        : DEFAULT_THEME_SETTINGS.accent,
      mode: ['light', 'dark', 'system'].includes(parsed.mode)
        ? parsed.mode
        : DEFAULT_THEME_SETTINGS.mode,
      surface: ['default', 'warm', 'pure'].includes(parsed.surface)
        ? parsed.surface
        : DEFAULT_THEME_SETTINGS.surface,
    };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
    applyThemeToDocument(settings);
  } catch (e) {
    console.error('Falha ao gravar tema nas preferências locais:', e);
  }
}

export function isSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveIsDark(mode: ColorMode): boolean {
  if (mode === 'system') {
    return isSystemDark();
  }
  return mode === 'dark';
}

export function applyThemeToDocument(settings: ThemeSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolveIsDark(settings.mode);

  // Toggle dark class
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Set data attributes for accent and surface
  root.setAttribute('data-accent', settings.accent);
  root.setAttribute('data-surface', settings.surface);
  root.setAttribute('data-mode', settings.mode);

  // Set standard meta theme-color for browser address bar if present
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  const accentDef = ACCENT_OPTIONS.find((a) => a.id === settings.accent);
  metaTheme.content = isDark ? '#090d16' : (accentDef ? accentDef.hex : '#1e40af');
}
