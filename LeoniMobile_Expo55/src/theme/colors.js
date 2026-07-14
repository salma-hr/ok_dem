// ============================================================
// LEONI OK DÉMARRAGE — Thème Mobile
// Miroir exact du thème web (theme.css)
// ============================================================

export const Colors = {
  // Blues (brand)
  l9: '#003f7e',
  l8: '#004a8d',
  l7: '#0057a8',
  l6: '#0057a8',
  l5: '#1a6fc4',
  l4: '#3d8fd8',
  l3: '#6fb0ea',
  l2: '#e8f0fb',
  l1: '#f0f5ff',
  l0: '#f5f8fc',

  // Amber
  a6: '#a06200',
  a5: '#e88900',
  a4: '#f2a52b',
  a3: '#f7c46b',
  a2: '#fde2a8',
  a1: '#fff1cf',
  a0: '#fffbeb',

  // Green
  g7: '#0a8050',
  g6: '#10a060',
  g5: '#19b26b',
  g1: '#e6f6ef',
  g0: '#f0fdf4',

  // Red
  r7: '#b0201a',
  r6: '#d93025',
  r5: '#e2554b',
  r1: '#fce9e8',
  r0: '#fdf2f2',

  // Gray
  gr9: '#111827',
  gr8: '#1f2937',
  gr7: '#374151',
  gr6: '#4b5563',
  gr5: '#6b7280',
  gr4: '#9ca3af',
  gr3: '#d1d5db',
  gr2: '#e5e7eb',
  gr1: '#f3f4f6',
  gr0: '#f9fafb',

  // Surfaces
  bgApp: '#f0f4f9',
  bgPage: '#ffffff',
  bg1: '#ffffff',
  bg2: '#f5f8fc',
  bg3: '#e8eef6',

  // Text
  tx1: '#1a2332',
  tx2: '#3a4a5c',
  tx3: '#6b7e94',
  tx4: '#9aacbe',

  // Borders
  bd1: '#d6e0ed',
  bd2: '#c2d0e4',

  // Status
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

// Dark mode palette
export const DarkColors = {
  ...Colors,
  bgApp: '#0a0f1c',
  bgPage: '#000000',
  bg1: '#ffffff',
  bg2: '#f8fafc',
  bg3: '#f1f5f9',
  tx1: '#0f172a',
  tx2: '#334155',
  tx3: '#64748b',
  tx4: '#94a3b8',
  bd1: '#e2e8f0',
  bd2: '#cbd5e1',
  l7: '#3b82f6',
};

// Gradient helpers (use LinearGradient)
export const Gradients = {
  main:   ['#003f7e', '#1a6fc4'],
  header: ['#003f7e', '#004a8d', '#0057a8'],
  amber:  ['#e88900', '#f7c46b'],
  green:  ['#10a060', '#19b26b'],
  page:   ['#003f7e', '#0057a8', '#1a6fc4'],
  sidebar:['#003f7e', '#004a8d', '#0057a8'],
};

// Shadows
export const Shadows = {
  xs: {
    shadowColor: '#0057a8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0057a8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Border radius
export const Radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 20,
  full: 9999,
};

// Typography
export const Font = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};
