import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  getDashboardStats,
  getDashboardProcessus,
  getDashboardRecentLists,
  getDashboardOperatorPerformance,
  getAllSites,
  getAllChecklists,
  getAllCriteres,
} from '../../api';
import { useI18n } from '../../context/I18nContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
Chart.register(...registerables);

/* ═══════════════════════════════════════════════
   THEME LEONI — Modern, elegant, Power BI inspired
═══════════════════════════════════════════════ */
const LEONI = {
  // Base colors
  bgPrimary: '#f5f7fc',
  bgSecondary: '#ffffff',
  bgCard: '#ffffff',
  bgDark: '#1a2a3a',
  bgSidebar: '#1a2a3a',
  
  // Text colors
  textPrimary: '#1a2a3a',
  textSecondary: '#5a6e85',
  textMuted: '#8a9bb0',
  textLight: '#cbd5e1',
  textOnDark: '#ffffff',
  
  // Accent colors
  accent: {
    primary: '#2d6a4f',
    primaryLight: '#40916c',
    primaryDark: '#1b4332',
    secondary: '#0d47a1',
    secondaryLight: '#1565c0',
    warning: '#f9a825',
    danger: '#d32f2f',
    info: '#00acc1',
    success: '#43a047',
    purple: '#7b1fa2',
    orange: '#ef6c00',
  },
  
  // Status colors
  status: {
    green: '#2e7d32',
    greenBg: '#e8f5e9',
    greenLight: '#4caf50',
    amber: '#f57c00',
    amberBg: '#fff3e0',
    red: '#c62828',
    redBg: '#ffebee',
    redLight: '#ef5350',
  },
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderFocus: '#2d6a4f',
  
  // Shadows
  shadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
  shadowHover: '0 4px 12px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  shadowCard: '0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.03)',
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  
  // Border radius
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999,
  },
  
  // Fonts
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  
  // Transitions
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const scoreBucket = (v) => v >= 85 ? 'green' : v >= 65 ? 'amber' : 'red';
const scoreColor  = (v) => v >= 85 ? LEONI.status.green : v >= 65 ? LEONI.status.amber : LEONI.status.red;
const scoreBg     = (v) => v >= 85 ? LEONI.status.greenBg : v >= 65 ? LEONI.status.amberBg : LEONI.status.redBg;
const scoreLabel  = (v) => v >= 85 ? 'Excellent' : v >= 65 ? 'En amélioration' : 'Critique';
const bucketColor = { green: LEONI.status.green, amber: LEONI.status.amber, red: LEONI.status.red };
const bucketBg    = { green: LEONI.status.greenBg, amber: LEONI.status.amberBg, red: LEONI.status.redBg };
const bucketLabel = { green: 'Excellent', amber: 'Attention', red: 'Critique' };
const bucketIcon  = { green: '✓', amber: '⚠', red: '✗' };

const pct = (ok, tot) => tot > 0 ? Math.round((ok / tot) * 100) : 100;

// Build NC stats grouped by a key extractor from checklist list
const buildNCStats = (checklists, keyFn, nameFn) => {
  const map = new Map();
  checklists.forEach((cl) => {
    const key = keyFn(cl);
    if (!key) return;
    const name = nameFn(cl);
    const cur = map.get(key) || { id: key, name, total: 0, nc: 0, rouge: 0, jaune: 0 };
    cur.total += 1;
    const reps = cl.reponses || [];
    const hasRouge = reps.some(r => r.valeur === 'ROUGE');
    const hasJaune = reps.some(r => r.valeur === 'JAUNE');
    if (hasRouge) { cur.nc += 1; cur.rouge += 1; }
    else if (hasJaune) { cur.nc += 1; cur.jaune += 1; }
    map.set(key, cur);
  });
  return Array.from(map.values())
    .map(e => ({ ...e, taux: pct(e.total - e.nc, e.total), bucket: scoreBucket(pct(e.total - e.nc, e.total)) }))
    .sort((a, b) => a.taux - b.taux);
};

const toDateKey = (d) => new Date(d).toISOString().slice(0, 10);

const readFirst = (obj, keys) => {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

const getLocalizedFieldKeys = (lang) => {
  if (lang === 'ar') return ['nomAr', 'nameAr', 'libelleAr', 'labelAr'];
  if (lang === 'en') return ['nomEn', 'nameEn', 'libelleEn', 'labelEn'];
  if (lang === 'de') return ['nomDe', 'nameDe', 'libelleDe', 'labelDe'];
  return ['nomFr', 'nameFr', 'libelleFr', 'labelFr'];
};

const getLocalizedCritereName = (crit, response, lang, id) => {
  const langKeys = getLocalizedFieldKeys(lang);
  const baseKeys = ['nom', 'name', 'libelle', 'label', 'intitule', 'titre'];
  const responseKeys = [
    ...langKeys.map(k => `critere${k.charAt(0).toUpperCase()}${k.slice(1)}`),
    'critereNom',
    'critereName',
    'nomCritere',
    'nameCritere',
  ];

  return (
    readFirst(crit, [...langKeys, ...baseKeys]) ||
    readFirst(response, responseKeys) ||
    (id ? `Critère ${id}` : 'Critère inconnu')
  );
};

const buildTopCriteresLocalized = (checklists, criteresMap, lang = 'fr') => {
  const counts = {};
  checklists.forEach((cl) => {
    (cl.reponses || []).forEach((r) => {
      if (r.valeur === 'ROUGE' || r.valeur === 'JAUNE') {
        const id = r.critereId || null;
        const crit = id && criteresMap && criteresMap[id] ? criteresMap[id] : null;
        const name = getLocalizedCritereName(crit, r, lang, id);
        const key = id ? `id:${id}` : `name:${name}`;
        const type = crit?.type || r.type || crit?.categorie || null;
        counts[key] = (counts[key] || { id, name, total: 0, rouge: 0, jaune: 0, type });
        counts[key].total += 1;
        if (r.valeur === 'ROUGE') counts[key].rouge += 1;
        else counts[key].jaune += 1;
      }
    });
  });
  return Object.values(counts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
};

const DASHBOARD_ADVANCED_I18N = {
  fr: {
    excellent: 'Excellent',
    attention: 'Attention',
    critical: 'Critique',
    loadingData: 'Chargement des donnees...',
    executiveBoard: 'Tableau de bord executif',
    period: 'Periode :',
    refresh: 'Actualiser',
    daysShort: 'j',
    sem1: 'S1 (Jan-Juin)',
    sem2: 'S2 (Juil-Dec)',
    selectToSeeDetail: 'Selectionnez un element pour voir le detail',
    filterByName: 'Filtrer par nom...',
    noFilterMatch: 'Aucun element ne correspond au filtre',
    typeAll: 'Tous',
    noNcDetected: 'Aucune non-conformite detectee',
    redCritical: 'Rouge - Critique',
    yellowAttention: 'Jaune - Attention',
    homeAllSites: 'Tous les sites',
    qualityInsights: 'QUALITY INSIGHTS',
    kpiConformityRate: 'Taux de conformite',
    kpiNonConformities: 'Non-conformites',
    kpiFinalValidations: 'Validations finales',
    kpiPending: 'En attente',
    overXChecklists: 'Sur {{count}} checklists',
    detectedInPeriod: 'Detectees sur la periode',
    approvedChecklists: 'Checklists approuvees',
    pendingStates: 'SOUMIS + N1 + N2',
    ncEvolution: 'Evolution des non-conformites',
    performanceBySite: 'Performance par site',
    noDataAvailable: 'Aucune donnee disponible',
    detailedAnalysis: 'Analyse detaillee',
    workshops: 'Ateliers',
    siteLabel: 'Site : {{name}}',
    processes: 'Processus',
    allWorkshopsForSite: 'Tous les ateliers - {{name}}',
    workshopLabel: 'Atelier : {{name}}',
    topFailingCriteria: 'Criteres les plus defaillants',
    processLabel: 'Processus : {{name}}',
    checklistsCount: '{{count}} checklists',
    checklistsWord: 'checklists',
    selectSiteTitle: 'Selectionnez un site',
    selectSiteHint: 'Cliquez sur un site dans le tableau de droite pour explorer les performances par atelier, processus et criteres',
    conformityByProcess: 'Conformite par processus',
    globalView: 'Vue globale',
    operatorPerformance: 'Performance operateurs',
    top6: 'Top 6',
    noOperatorFound: 'Aucun operateur trouve',
    clShort: 'CL',
    ncChartLabel: 'NC',
    conformityPct: 'Conformite %',
    conformityAxis: 'Conformite',
    ncLabelTooltip: 'NC',
    conformityTooltip: 'Conformite',
    nonConformitiesTooltip: 'Non-conformites',
    totalTooltip: 'Total',
    elements: 'elements',
  },
  en: {
    excellent: 'Excellent',
    attention: 'Attention',
    critical: 'Critical',
    loadingData: 'Loading data...',
    executiveBoard: 'Executive dashboard',
    period: 'Period:',
    refresh: 'Refresh',
    daysShort: 'd',
    sem1: 'H1 (Jan-Jun)',
    sem2: 'H2 (Jul-Dec)',
    selectToSeeDetail: 'Select an item to view details',
    filterByName: 'Filter by name...',
    noFilterMatch: 'No item matches the filter',
    typeAll: 'All',
    noNcDetected: 'No non-conformity detected',
    redCritical: 'Red - Critical',
    yellowAttention: 'Yellow - Attention',
    homeAllSites: 'All sites',
    qualityInsights: 'QUALITY INSIGHTS',
    kpiConformityRate: 'Conformity rate',
    kpiNonConformities: 'Non-conformities',
    kpiFinalValidations: 'Final validations',
    kpiPending: 'Pending',
    overXChecklists: 'Over {{count}} checklists',
    detectedInPeriod: 'Detected over the period',
    approvedChecklists: 'Approved checklists',
    pendingStates: 'SUBMITTED + N1 + N2',
    ncEvolution: 'Non-conformity evolution',
    performanceBySite: 'Performance by site',
    noDataAvailable: 'No data available',
    detailedAnalysis: 'Detailed analysis',
    workshops: 'Workshops',
    siteLabel: 'Site: {{name}}',
    processes: 'Processes',
    allWorkshopsForSite: 'All workshops - {{name}}',
    workshopLabel: 'Workshop: {{name}}',
    topFailingCriteria: 'Most failing criteria',
    processLabel: 'Process: {{name}}',
    checklistsCount: '{{count}} checklists',
    checklistsWord: 'checklists',
    selectSiteTitle: 'Select a site',
    selectSiteHint: 'Click a site from the right panel to explore workshop, process, and criteria performance',
    conformityByProcess: 'Conformity by process',
    globalView: 'Global view',
    operatorPerformance: 'Operator performance',
    top6: 'Top 6',
    noOperatorFound: 'No operator found',
    clShort: 'CL',
    ncChartLabel: 'NC',
    conformityPct: 'Conformity %',
    conformityAxis: 'Conformity',
    ncLabelTooltip: 'NC',
    conformityTooltip: 'Conformity',
    nonConformitiesTooltip: 'Non-conformities',
    totalTooltip: 'Total',
    elements: 'items',
  },
  de: {
    excellent: 'Exzellent',
    attention: 'Achtung',
    critical: 'Kritisch',
    loadingData: 'Daten werden geladen...',
    executiveBoard: 'Executive-Dashboard',
    period: 'Zeitraum:',
    refresh: 'Aktualisieren',
    daysShort: 'T',
    sem1: 'H1 (Jan-Jun)',
    sem2: 'H2 (Jul-Dez)',
    selectToSeeDetail: 'Wahlen Sie ein Element, um Details zu sehen',
    filterByName: 'Nach Name filtern...',
    noFilterMatch: 'Kein Element passt zum Filter',
    typeAll: 'Alle',
    noNcDetected: 'Keine Nichtkonformitat erkannt',
    redCritical: 'Rot - Kritisch',
    yellowAttention: 'Gelb - Achtung',
    homeAllSites: 'Alle Standorte',
    qualityInsights: 'QUALITY INSIGHTS',
    kpiConformityRate: 'Konformitatsrate',
    kpiNonConformities: 'Nichtkonformitaten',
    kpiFinalValidations: 'Endvalidierungen',
    kpiPending: 'Ausstehend',
    overXChecklists: 'Uber {{count}} Checklisten',
    detectedInPeriod: 'Im Zeitraum erkannt',
    approvedChecklists: 'Genehmigte Checklisten',
    pendingStates: 'EINGEREICHT + N1 + N2',
    ncEvolution: 'Entwicklung der Nichtkonformitaten',
    performanceBySite: 'Leistung nach Standort',
    noDataAvailable: 'Keine Daten verfugbar',
    detailedAnalysis: 'Detaillierte Analyse',
    workshops: 'Werkstatten',
    siteLabel: 'Standort: {{name}}',
    processes: 'Prozesse',
    allWorkshopsForSite: 'Alle Werkstatten - {{name}}',
    workshopLabel: 'Werkstatt: {{name}}',
    topFailingCriteria: 'Haufigste fehlerhafte Kriterien',
    processLabel: 'Prozess: {{name}}',
    checklistsCount: '{{count}} Checklisten',
    checklistsWord: 'Checklisten',
    selectSiteTitle: 'Standort auswahlen',
    selectSiteHint: 'Klicken Sie rechts auf einen Standort, um Werkstatt-, Prozess- und Kriterienleistung zu sehen',
    conformityByProcess: 'Konformitat nach Prozess',
    globalView: 'Gesamtansicht',
    operatorPerformance: 'Operatorleistung',
    top6: 'Top 6',
    noOperatorFound: 'Kein Operator gefunden',
    clShort: 'CL',
    ncChartLabel: 'NC',
    conformityPct: 'Konformitat %',
    conformityAxis: 'Konformitat',
    ncLabelTooltip: 'NC',
    conformityTooltip: 'Konformitat',
    nonConformitiesTooltip: 'Nichtkonformitaten',
    totalTooltip: 'Gesamt',
    elements: 'Elemente',
  },
  ar: {
    excellent: 'ممتاز',
    attention: 'انتباه',
    critical: 'حرج',
    loadingData: 'جار تحميل البيانات...',
    executiveBoard: 'لوحة قيادة تنفيذية',
    period: 'الفترة:',
    refresh: 'تحديث',
    daysShort: 'ي',
    sem1: 'S1 (جانفي-جوان)',
    sem2: 'S2 (جويلية-ديسمبر)',
    selectToSeeDetail: 'اختر عنصرا لعرض التفاصيل',
    filterByName: 'تصفية حسب الاسم...',
    noFilterMatch: 'لا يوجد عنصر يطابق الفلتر',
    typeAll: 'الكل',
    noNcDetected: 'لم يتم اكتشاف عدم مطابقة',
    redCritical: 'احمر - حرج',
    yellowAttention: 'اصفر - انتباه',
    homeAllSites: 'كل المواقع',
    qualityInsights: 'QUALITY INSIGHTS',
    kpiConformityRate: 'معدل المطابقة',
    kpiNonConformities: 'عدم المطابقة',
    kpiFinalValidations: 'التحققات النهائية',
    kpiPending: 'قيد الانتظار',
    overXChecklists: 'من اصل {{count}} قوائم تحقق',
    detectedInPeriod: 'تم اكتشافها خلال الفترة',
    approvedChecklists: 'قوائم تحقق معتمدة',
    pendingStates: 'مرسل + N1 + N2',
    ncEvolution: 'تطور عدم المطابقة',
    performanceBySite: 'الاداء حسب الموقع',
    noDataAvailable: 'لا توجد بيانات',
    detailedAnalysis: 'تحليل مفصل',
    workshops: 'الورشات',
    siteLabel: 'الموقع: {{name}}',
    processes: 'العمليات',
    allWorkshopsForSite: 'كل الورشات - {{name}}',
    workshopLabel: 'الورشة: {{name}}',
    topFailingCriteria: 'اكثر المعايير اخفاقا',
    processLabel: 'العملية: {{name}}',
    checklistsCount: '{{count}} قوائم تحقق',
    checklistsWord: 'قوائم تحقق',
    selectSiteTitle: 'اختر موقعا',
    selectSiteHint: 'اضغط على موقع من اللوحة اليمنى لاستكشاف اداء الورشات والعمليات والمعايير',
    conformityByProcess: 'المطابقة حسب العملية',
    globalView: 'نظرة عامة',
    operatorPerformance: 'اداء المشغلين',
    top6: 'افضل 6',
    noOperatorFound: 'لم يتم العثور على مشغل',
    clShort: 'CL',
    ncChartLabel: 'NC',
    conformityPct: 'المطابقة %',
    conformityAxis: 'المطابقة',
    ncLabelTooltip: 'NC',
    conformityTooltip: 'المطابقة',
    nonConformitiesTooltip: 'عدم المطابقة',
    totalTooltip: 'المجموع',
    elements: 'عنصر',
  },
};

const formatLocalText = (value, vars = {}) => {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    return `{{${key}}}`;
  });
};

/* ═══════════════════════════════════════════════
   CHART CANVAS
═══════════════════════════════════════════════ */
function ChartCanvas({ id, config, height = 200 }) {
  const ref = useRef(null);
  const chart = useRef(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    if (chart.current) chart.current.destroy();
    chart.current = new Chart(ref.current, config);
    return () => { if (chart.current) chart.current.destroy(); };
  }, [config]);
  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={ref} id={id} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   KPI CARD — Modern variant
═══════════════════════════════════════════════ */
function KpiCard({ label, value, sub, color = LEONI.accent.primary, icon, trend, trendValue }) {
  return (
    <div style={{
      background: LEONI.bgCard,
      border: `1px solid ${LEONI.border}`,
      borderRadius: LEONI.radius.lg,
      padding: '18px 20px',
      transition: LEONI.transition,
      boxShadow: LEONI.shadowCard,
      position: 'relative',
      overflow: 'hidden',
      cursor: 'pointer',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: color,
        borderRadius: `${LEONI.radius.lg}px ${LEONI.radius.lg}px 0 0`,
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: LEONI.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>{label}</span>
        {icon && (
          <span style={{
            fontSize: 20,
            opacity: 0.7,
            color: color,
          }}>{icon}</span>
        )}
      </div>
      
      <div style={{
        fontSize: 34,
        fontWeight: 700,
        color: LEONI.textPrimary,
        lineHeight: 1.1,
        marginBottom: 8,
      }}>{value}</div>
      
      {sub && (
        <div style={{
          fontSize: 11,
          color: LEONI.textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {trend && (
            <span style={{
              color: trend > 0 ? LEONI.status.green : trend < 0 ? LEONI.status.red : LEONI.textMuted,
              fontWeight: 600,
            }}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
            </span>
          )}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SECTION TITLE
═══════════════════════════════════════════════ */
function STitle({ children, accent = LEONI.accent.primary, action, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: subtitle ? 4 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 4,
            height: 20,
            background: accent,
            borderRadius: LEONI.radius.sm,
          }} />
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: LEONI.textPrimary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>{children}</span>
        </div>
        {action}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: LEONI.textMuted, marginLeft: 14 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TRAFFIC LIGHT ROW — Enhanced
═══════════════════════════════════════════════ */
function TLRow({ item, onClick, selected, showDetail }) {
  const b = item.bucket;
  const isSelected = selected?.id === item.id;
  return (
    <div
      onClick={() => onClick(item)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        cursor: 'pointer',
        borderRadius: LEONI.radius.md,
        background: isSelected ? `${LEONI.accent.primary}08` : 'transparent',
        border: `1px solid ${isSelected ? LEONI.accent.primary : 'transparent'}`,
        transition: LEONI.transition,
        marginBottom: 4,
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.background = `${LEONI.accent.primary}04`;
          e.currentTarget.style.borderColor = LEONI.border;
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      {/* Status indicator */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: LEONI.radius.md,
        background: bucketBg[b],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: bucketColor[b],
        }}>
          {bucketIcon[b]}
        </span>
      </div>
      
      {/* Name */}
      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: isSelected ? 600 : 500,
        color: LEONI.textPrimary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.name}
      </span>
      
      {/* Metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 70,
          height: 4,
          background: LEONI.border,
          borderRadius: LEONI.radius.full,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${item.taux}%`,
            background: bucketColor[b],
            borderRadius: LEONI.radius.full,
            transition: 'width 0.4s',
          }} />
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: bucketColor[b],
          minWidth: 36,
          textAlign: 'right',
        }}>
          {item.taux}%
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: LEONI.radius.full,
          background: bucketBg[b],
          color: bucketColor[b],
          minWidth: 52,
          textAlign: 'center',
        }}>
          {item.nc} NC
        </span>
        {showDetail && (
          <span style={{
            fontSize: 12,
            color: LEONI.textMuted,
            transition: LEONI.transition,
          }}>→</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DRILL PANEL — Enhanced
═══════════════════════════════════════════════ */
function DrillPanel({ title, subtitle, items, onSelect, selected, color, showDetail, tr }) {
  const [q, setQ] = React.useState('');

  const filtered = React.useMemo(() => {
    if (!q) return items;
    const s = q.trim().toLowerCase();
    return items.filter(it => String(it.name || it.nom || '').toLowerCase().includes(s));
  }, [items, q]);

  if (!items.length) {
    return (
      <div style={{
        padding: '32px 20px',
        textAlign: 'center',
        background: `${LEONI.bgSecondary}`,
        borderRadius: LEONI.radius.lg,
        border: `1px dashed ${LEONI.border}`,
      }}>
        <span style={{ fontSize: 32, opacity: 0.3 }}>📊</span>
        <div style={{ fontSize: 13, color: LEONI.textMuted, marginTop: 8 }}>
          {tr('selectToSeeDetail')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${LEONI.border}` }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: 11, color: LEONI.textMuted }}>
          {subtitle} • <span style={{ fontWeight: 600, color: LEONI.textSecondary }}>{items.length}</span> éléments
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: `${LEONI.textPrimary}04`,
          border: `1px solid ${LEONI.border}`,
          borderRadius: LEONI.radius.md,
          padding: '6px 10px',
          transition: LEONI.transition,
        }}>
          <span style={{ fontSize: 14, marginRight: 8, opacity: 0.5 }}>🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr('filterByName')}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: 12,
              outline: 'none',
              fontFamily: 'inherit',
              color: LEONI.textPrimary,
            }}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: LEONI.textMuted,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
        {filtered.map(item => (
          <TLRow key={item.id} item={item} onClick={onSelect} selected={selected} showDetail={showDetail} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: LEONI.textMuted, fontSize: 12 }}>
            {tr('noFilterMatch')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TOP CRITERES BARS — Enhanced
═══════════════════════════════════════════════ */
function TopCriteresPanel({ checklists, criteresMap, tr, lang }) {
  const [selectedType, setSelectedType] = useState('ALL');
  const allTop = useMemo(() => buildTopCriteresLocalized(checklists, criteresMap, lang), [checklists, criteresMap, lang]);
  const types = useMemo(() => {
    const s = new Set();
    Object.values(criteresMap || {}).forEach(c => { if (c?.type) s.add(c.type); });
    allTop.forEach(t => { if (t.type) s.add(t.type); });
    return ['ALL', ...Array.from(s)];
  }, [criteresMap, allTop]);
  const top = selectedType === 'ALL' ? allTop : allTop.filter(t => t.type === selectedType);
  const max = top[0]?.total || 1;
  
  if (!allTop.length) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
        background: `${LEONI.bgSecondary}`,
        borderRadius: LEONI.radius.lg,
      }}>
        <span style={{ fontSize: 40, opacity: 0.3 }}>✅</span>
        <div style={{ fontSize: 13, color: LEONI.textMuted, marginTop: 8 }}>
          {tr('noNcDetected')}
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Type filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setSelectedType(t)}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: LEONI.radius.full,
              border: `1px solid ${selectedType === t ? LEONI.accent.primary : LEONI.border}`,
              background: selectedType === t ? LEONI.accent.primary : 'transparent',
              color: selectedType === t ? '#fff' : LEONI.textSecondary,
              transition: LEONI.transition,
              fontFamily: 'inherit',
            }}
          >
            {t === 'ALL' ? tr('typeAll') : t}
          </button>
        ))}
      </div>
      
      {/* Top critères list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {top.map((c, i) => {
          const pctRouge = max > 0 ? (c.rouge / max) * 100 : 0;
          const pctJaune = max > 0 ? (c.jaune / max) * 100 : 0;
          const rankColor = i < 3 ? LEONI.status.red : i < 6 ? LEONI.accent.orange : LEONI.textMuted;
          return (
            <div key={`${c.id || c.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Rank */}
              <div style={{
                width: 22,
                height: 22,
                borderRadius: LEONI.radius.sm,
                background: `${rankColor}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: rankColor }}>{i + 1}</span>
              </div>
              
              {/* Name */}
              <span style={{
                fontSize: 12,
                color: LEONI.textPrimary,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}>
                {c.name}
                {c.type && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 9,
                    fontWeight: 500,
                    color: LEONI.textMuted,
                    background: `${LEONI.textMuted}10`,
                    padding: '1px 6px',
                    borderRadius: LEONI.radius.full,
                  }}>
                    {c.type}
                  </span>
                )}
              </span>
              
              {/* Progress bars */}
              <div style={{
                display: 'flex',
                width: 100,
                height: 6,
                borderRadius: LEONI.radius.full,
                overflow: 'hidden',
                flexShrink: 0,
                background: LEONI.border,
              }}>
                <div style={{
                  width: `${pctRouge}%`,
                  background: LEONI.status.red,
                  transition: 'width 0.4s',
                }} />
                <div style={{
                  width: `${pctJaune}%`,
                  background: LEONI.status.amber,
                  transition: 'width 0.4s',
                }} />
              </div>
              
              {/* Count */}
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: LEONI.textSecondary,
                minWidth: 28,
                textAlign: 'right',
              }}>{c.total}</span>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px solid ${LEONI.border}`,
      }}>
        <span style={{ fontSize: 10, color: LEONI.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, background: LEONI.status.red, display: 'inline-block', borderRadius: LEONI.radius.full }} />
          {tr('redCritical')}
        </span>
        <span style={{ fontSize: 10, color: LEONI.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, background: LEONI.status.amber, display: 'inline-block', borderRadius: LEONI.radius.full }} />
          {tr('yellowAttention')}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SUMMARY DONUT — Enhanced
═══════════════════════════════════════════════ */
function SummaryDonut({ items, tr }) {
  const red   = items.filter(i => i.bucket === 'red').length;
  const amber = items.filter(i => i.bucket === 'amber').length;
  const green = items.filter(i => i.bucket === 'green').length;
  const total = items.length || 1;
  const config = useMemo(() => ({
    type: 'doughnut',
    data: {
      labels: [tr('critical'), tr('attention'), tr('excellent')],
      datasets: [{
        data: [red, amber, green],
        backgroundColor: [LEONI.status.red, LEONI.status.amber, LEONI.status.green],
        borderWidth: 0,
        hoverOffset: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          bodyFont: { size: 11 },
          titleFont: { size: 11 },
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.raw} ${tr('elements')}`,
          },
        },
      },
    },
  }), [red, amber, green, tr]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 70, height: 70, flexShrink: 0, position: 'relative' }}>
        <ChartCanvas id={`donut-${total}`} config={config} height={70} />
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          color: LEONI.textPrimary,
          pointerEvents: 'none',
        }}>
          {total}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          [tr('excellent'), green, LEONI.status.green],
          [tr('attention'), amber, LEONI.status.amber],
          [tr('critical'), red, LEONI.status.red],
        ].map(([label, val, col]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, background: col, borderRadius: LEONI.radius.full, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: LEONI.textMuted }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: col, marginLeft: 2 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   BREADCRUMB — Enhanced
═══════════════════════════════════════════════ */
function Breadcrumb({ site, plant, processus, onReset, onSelectSite, onSelectPlant, tr }) {
  const parts = [
    { label: `🏠 ${tr('homeAllSites')}`, onClick: onReset },
  ];
  if (site) parts.push({ label: site.name, onClick: () => onSelectSite(site) });
  if (plant) parts.push({ label: plant.name, onClick: () => onSelectPlant(plant) });
  if (processus) parts.push({ label: processus.name, onClick: null });
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{
              fontSize: 12,
              color: LEONI.textMuted,
              fontWeight: 300,
            }}>›</span>
          )}
          <button
            onClick={p.onClick || undefined}
            disabled={!p.onClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: p.onClick ? 'pointer' : 'default',
              fontSize: 12,
              color: p.onClick ? LEONI.accent.primary : LEONI.textSecondary,
              fontWeight: i === parts.length - 1 ? 600 : 400,
              padding: '4px 8px',
              fontFamily: 'inherit',
              transition: LEONI.transition,
              borderRadius: LEONI.radius.md,
              ...(p.onClick && {
                ':hover': {
                  background: `${LEONI.accent.primary}10`,
                }
              }),
            }}
            onMouseEnter={e => {
              if (p.onClick) e.currentTarget.style.background = `${LEONI.accent.primary}08`;
            }}
            onMouseLeave={e => {
              if (p.onClick) e.currentTarget.style.background = 'transparent';
            }}
          >
            {p.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════ */
export default function DashboardAdvanced() {
  const { lang } = useI18n();
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
  const tr = useCallback((key, vars = {}) => {
    const dict = DASHBOARD_ADVANCED_I18N[lang] || DASHBOARD_ADVANCED_I18N.fr;
    const fallback = DASHBOARD_ADVANCED_I18N.fr[key] || key;
    const value = dict[key] ?? fallback;
    return formatLocalText(value, vars);
  }, [lang]);

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1200;
  const headerHeight = isMobile ? 56 : 52;

  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState(null);
  const [checklists, setCL]     = useState([]);
  const [opPerf, setOpPerf]     = useState([]);
  const [processusCounts, setPC]= useState([]);
  const [criteresMap, setCriteresMap] = useState({});
  const [rangeDays, setRange]   = useState(30);
  const [filterYear, setFilterYear] = useState(null); // null = all years
  const [filterSemester, setFilterSemester] = useState(null); // null | 1 | 2 (actif seulement si une annee est selectionnee)
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef(null);

  /* drill-down state */
  const [selSite,      setSelSite]      = useState(null);
  const [selPlant,     setSelPlant]     = useState(null);
  const [selProcessus, setSelProcessus] = useState(null);

  /* ── load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes, clRes, opRes, critRes] = await Promise.all([
        getDashboardStats(),
        getDashboardProcessus(),
        getAllChecklists(),
        getDashboardOperatorPerformance(rangeDays),
        getAllCriteres(),
      ]);
      setStats(sRes.data);
      setPC(Array.isArray(pRes.data) ? pRes.data : []);
      const all = (Array.isArray(clRes.data) ? clRes.data : [])
        .filter(c => c.status !== 'EN_COURS' && c.statut !== 'EN_COURS');
      setCL(all);
      setOpPerf(Array.isArray(opRes.data) ? opRes.data : []);
      try {
        const cm = {};
        if (Array.isArray(critRes?.data)) critRes.data.forEach(c => { if (c && c.id != null) cm[c.id] = c; });
        setCriteresMap(cm);
      } catch (e) { console.warn('Failed to build criteresMap', e); }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => { load(); }, [load]);

  /* ── Available years derived from data ── */
  const availableYears = useMemo(() => {
    const years = new Set();
    checklists.forEach(c => {
      const d = new Date(c.date || c.dateControle || c.creeLe || c.dateCreation);
      if (!isNaN(d)) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [checklists]);

  /* ── Filter CL by date range and/or year (+ semestre optionnel) ── */
  const clInRange = useMemo(() => {
    return checklists.filter(c => {
      const d = new Date(c.date || c.dateControle || c.creeLe || c.dateCreation);
      if (isNaN(d)) return false;
      if (filterYear !== null) {
        if (d.getFullYear() !== filterYear) return false;
        if (filterSemester !== null) {
          const sem = d.getMonth() < 6 ? 1 : 2; // S1 = Jan-Juin, S2 = Juil-Dec
          if (sem !== filterSemester) return false;
        }
        return true;
      }
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - rangeDays);
      return d >= cutoff;
    });
  }, [checklists, rangeDays, filterYear, filterSemester]);


  /* ── NC stats by level ── */
  const siteStats = useMemo(() =>
    buildNCStats(clInRange, c => c.siteId, c => c.siteNom || `Site ${c.siteId}`),
  [clInRange]);

  const plantStats = useMemo(() => {
    if (!selSite) return [];
    const filtered = clInRange.filter(c => String(c.siteId) === String(selSite.id));
    return buildNCStats(filtered, c => c.plantId, c => c.plantNom || `Atelier ${c.plantId}`);
  }, [clInRange, selSite]);

  const processusStats = useMemo(() => {
    let filtered = clInRange;
    if (selSite)  filtered = filtered.filter(c => String(c.siteId)  === String(selSite.id));
    if (selPlant) filtered = filtered.filter(c => String(c.plantId) === String(selPlant.id));
    return buildNCStats(filtered, c => c.processusId, c => c.processusNom || `Processus ${c.processusId}`);
  }, [clInRange, selSite, selPlant]);

  /* CL for criteres panel — drill all the way down */
  const clForCriteres = useMemo(() => {
    let filtered = clInRange;
    if (selSite)      filtered = filtered.filter(c => String(c.siteId)      === String(selSite.id));
    if (selPlant)     filtered = filtered.filter(c => String(c.plantId)     === String(selPlant.id));
    if (selProcessus) filtered = filtered.filter(c => String(c.processusId) === String(selProcessus.id));
    return filtered;
  }, [clInRange, selSite, selPlant, selProcessus]);

  /* ── NC trend chart ── */
  const ncTrendConfig = useMemo(() => {
    const days = Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (rangeDays - 1 - i)); return d;
    });
    const labels = days.map(d => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }));
    const ncPerDay = days.map(d => {
      const key = toDateKey(d);
      return clInRange.filter(c => toDateKey(new Date(c.date || c.dateControle || c.creeLe)) === key)
        .reduce((sum, c) => sum + (c.criteresNok || (c.reponses || []).filter(r => r.valeur === 'ROUGE').length), 0);
    });
    const confPerDay = days.map(d => {
      const key = toDateKey(d);
      const day = clInRange.filter(c => toDateKey(new Date(c.date || c.dateControle || c.creeLe)) === key);
      if (!day.length) return null;
      const ok  = day.reduce((a, c) => a + (c.criteresOk  || 0), 0);
      const tot = day.reduce((a, c) => a + (c.criteresTotal || 1), 0);
      return tot > 0 ? Math.round((ok / tot) * 100) : null;
    });
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { 
            label: tr('ncChartLabel'), 
            data: ncPerDay, 
            backgroundColor: `${LEONI.status.red}cc`,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
            yAxisID: 'y',
            order: 2,
          },
          { 
            label: tr('conformityPct'), 
            data: confPerDay, 
            type: 'line', 
            borderColor: LEONI.accent.primary,
            backgroundColor: 'transparent', 
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: LEONI.accent.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            tension: 0.35,
            yAxisID: 'y2',
            order: 1,
            spanGaps: true,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            bodyFont: { size: 11 },
            titleFont: { size: 11, weight: 'bold' },
            backgroundColor: LEONI.bgCard,
            titleColor: LEONI.textPrimary,
            bodyColor: LEONI.textSecondary,
            borderColor: LEONI.border,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, color: LEONI.textMuted, maxRotation: 45, minRotation: 45 },
            grid: { display: false },
          },
          y: {
            position: 'left',
            ticks: { font: { size: 9 }, color: LEONI.textMuted },
            grid: { color: `${LEONI.textPrimary}08`, drawBorder: false },
            title: { display: true, text: tr('ncChartLabel'), font: { size: 9, weight: 'normal' }, color: LEONI.textMuted },
          },
          y2: {
            position: 'right',
            min: 0,
            max: 100,
            ticks: { font: { size: 9 }, color: LEONI.accent.primary, callback: v => `${v}%` },
            grid: { display: false },
            title: { display: true, text: tr('conformityAxis'), font: { size: 9, weight: 'normal' }, color: LEONI.accent.primary },
          },
        },
      },
    };
  }, [clInRange, rangeDays, locale, tr]);

  /* ── Processus bar chart config ── */
  const procBarConfig = useMemo(() => {
    const data = processusStats.length
      ? processusStats
      : buildNCStats(clInRange, c => c.processusId, c => c.processusNom || `P${c.processusId}`);
    const top8 = data.slice(0, 8);
    return {
      type: 'bar',
      data: {
        labels: top8.map(p => p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name),
        datasets: [{
          label: tr('conformityPct'),
          data: top8.map(p => p.taux),
          backgroundColor: top8.map(p => scoreBg(p.taux)),
          borderColor: top8.map(p => scoreColor(p.taux)),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.8,
          categoryPercentage: 0.9,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = top8[ctx.dataIndex];
                return [
                  `${tr('conformityTooltip')}: ${ctx.raw}%`,
                  `${tr('nonConformitiesTooltip')}: ${item?.nc || 0}`,
                  `${tr('totalTooltip')}: ${item?.total || 0} ${tr('checklistsWord')}`,
                ];
              },
            },
            bodyFont: { size: 11 },
            titleFont: { size: 11, weight: 'bold' },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { callback: v => `${v}%`, font: { size: 9 }, color: LEONI.textMuted },
            grid: { color: `${LEONI.textPrimary}08`, drawBorder: false },
          },
          y: {
            ticks: { font: { size: 10 }, color: LEONI.textSecondary },
            grid: { display: false },
          },
        },
      },
    };
  }, [processusStats, clInRange, tr]);

  /* ── KPIs ── */
  const totalCL  = clInRange.length;
  const validees = clInRange.filter(c => (c.status || c.statut) === 'VALIDE_FINAL').length;
  const rejetes  = clInRange.filter(c => (c.status || c.statut) === 'REJETE').length;
  const enAtt    = clInRange.filter(c => ['VALIDE_N1','VALIDE_N2','SOUMIS'].includes(c.status || c.statut)).length;
  const tauxConf = stats?.tauxConformite ?? (totalCL > 0 ? Math.round((validees / totalCL) * 100) : 0);
  /* ── Export PDF ── */
const handleExportPDF = useCallback(async () => {
  setExporting(true);
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    // doc.autoTable fonctionne car jspdf-autotable est importé statiquement
    const W = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
    const filterLabel = filterYear !== null
      ? `Année ${filterYear}${filterSemester ? ` - S${filterSemester}` : ''}`
      : `${rangeDays} derniers jours`;
    let y = 0;

    // ── Couleurs
    const C = {
      dark:    [26, 42, 58],
      green:   [46, 125, 50],
      amber:   [245, 124, 0],
      red:     [198, 40, 40],
      primary: [45, 106, 79],
      gray:    [90, 110, 133],
      light:   [245, 247, 252],
      white:   [255, 255, 255],
      border:  [226, 232, 240],
    };

    const scoreC = (v) => v >= 85 ? C.green : v >= 65 ? C.amber : C.red;

    // ── HEADER
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, W, 18, 'F');
    doc.setFontSize(13);
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.text('LEONI  •  QUALITY INSIGHTS', 10, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 220);
    doc.text(`Rapport exécutif — ${filterLabel}  |  ${now}`, W - 10, 11, { align: 'right' });
    y = 24;

    // ── KPIs
    const kpis = [
      { label: tr('kpiConformityRate'),    value: `${Number(tauxConf).toFixed(1)}%`, col: scoreC(tauxConf) },
      { label: tr('kpiNonConformities'),   value: String(stats?.nonConformites ?? rejetes), col: C.red },
      { label: tr('kpiFinalValidations'),  value: String(stats?.checklistsValidees ?? validees), col: C.green },
      { label: tr('kpiPending'),           value: String(stats?.enAttente ?? enAtt), col: C.amber },
    ];

    const kpiW = (W - 20) / kpis.length;
    kpis.forEach((kpi, i) => {
      const x = 10 + i * kpiW;
      doc.setFillColor(...C.white);
      doc.roundedRect(x, y, kpiW - 4, 22, 2, 2, 'F');
      doc.setDrawColor(...C.border);
      doc.roundedRect(x, y, kpiW - 4, 22, 2, 2, 'S');
      // accent bar top
      doc.setFillColor(...kpi.col);
      doc.rect(x, y, kpiW - 4, 1.5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.gray);
      doc.text(kpi.label.toUpperCase(), x + (kpiW - 4) / 2, y + 7, { align: 'center' });
      doc.setFontSize(17);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...kpi.col);
      doc.text(kpi.value, x + (kpiW - 4) / 2, y + 17, { align: 'center' });
    });
    y += 28;

    // ── Section helper
    const sectionTitle = (title, yPos) => {
      doc.setFillColor(...C.primary);
      doc.rect(10, yPos, 3, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.dark);
      doc.text(title.toUpperCase(), 16, yPos + 6);
      return yPos + 12;
    };

    // ── PERFORMANCE PAR SITE
    y = sectionTitle(tr('performanceBySite'), y);
if (siteStats.length > 0) {
  let table1EndY = y;
  autoTable(doc, {
    startY: y,
    head: [['Site', 'Total CL', 'NC', 'Taux conformité', 'Statut']],
    body: siteStats.map(s => [s.name, s.total, s.nc, `${s.taux}%`,
      s.taux >= 85 ? 'Excellent' : s.taux >= 65 ? 'Attention' : 'Critique']),
    theme: 'plain',
    headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.dark },
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const v = data.cell.text[0];
        data.cell.styles.textColor = v === 'Excellent' ? C.green : v === 'Attention' ? C.amber : C.red;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 3 && data.section === 'body') {
        data.cell.styles.textColor = scoreC(parseInt(data.cell.text[0]));
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        table1EndY = Math.max(table1EndY, data.cell.y + data.cell.height);
      }
    },
    margin: { left: 10, right: 10 },
    alternateRowStyles: { fillColor: C.light },
  });
  y = table1EndY + 8;
}


    // ── PERFORMANCE PAR PROCESSUS
    const procData = processusStats.length > 0
      ? processusStats
      : buildNCStats(clInRange, c => c.processusId, c => c.processusNom || `P${c.processusId}`);

    if (procData.length > 0) {
      // Nouvelle page si besoin
      if (y > 160) { doc.addPage(); y = 16; }
      y = sectionTitle(tr('conformityByProcess'), y);
      let table2EndY = y;
      autoTable(doc, {
        startY: y,
        head: [['Processus', 'Total CL', 'NC Rouge', 'NC Jaune', 'Taux conformité', 'Statut']],
        body: procData.map(p => [
          p.name,
          p.total,
          p.rouge,
          p.jaune,
          `${p.taux}%`,
          p.taux >= 85 ? 'Excellent' : p.taux >= 65 ? 'Attention' : 'Critique',
        ]),
        theme: 'plain',
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.dark },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 30, halign: 'center' },
          5: { cellWidth: 26, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const v = data.cell.text[0];
            data.cell.styles.textColor =
              v === 'Excellent' ? C.green :
              v === 'Attention' ? C.amber : C.red;
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4 && data.section === 'body') {
            data.cell.styles.textColor = scoreC(parseInt(data.cell.text[0]));
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 2 && data.section === 'body') {
            if (parseInt(data.cell.text[0]) > 0)
              data.cell.styles.textColor = C.red;
          }
          if (data.column.index === 3 && data.section === 'body') {
            if (parseInt(data.cell.text[0]) > 0)
              data.cell.styles.textColor = C.amber;
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            table2EndY = Math.max(table2EndY, data.cell.y + data.cell.height);
          }
        },
        margin: { left: 10, right: 10 },
        alternateRowStyles: { fillColor: C.light },
      });
      y = table2EndY + 8;
    }

    // ── TOP CRITÈRES DÉFAILLANTS
    const topCrit = buildTopCriteresLocalized(clInRange, criteresMap, lang);
    if (topCrit.length > 0) {
      if (y > 140) { doc.addPage(); y = 16; }
      y = sectionTitle(tr('topFailingCriteria'), y);
      let table3EndY = y;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Critère', 'Type', 'NC Rouge', 'NC Jaune', 'Total NC']],
        body: topCrit.map((c, i) => [
          i + 1,
          c.name,
          c.type || '—',
          c.rouge,
          c.jaune,
          c.total,
        ]),
        theme: 'plain',
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.dark },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 100 },
          2: { cellWidth: 30 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.section === 'body' && parseInt(data.cell.text[0]) > 0)
            data.cell.styles.textColor = C.red;
          if (data.column.index === 4 && data.section === 'body' && parseInt(data.cell.text[0]) > 0)
            data.cell.styles.textColor = C.amber;
          if (data.column.index === 5 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = C.dark;
          }
          // Top 3 en rouge
          if (data.section === 'body' && data.row.index < 3)
            data.cell.styles.fillColor = [255, 235, 235];
        },
        didDrawCell: (data) => {
          if (data.section === 'body') {
            table3EndY = Math.max(table3EndY, data.cell.y + data.cell.height);
          }
        },
        margin: { left: 10, right: 10 },
        alternateRowStyles: { fillColor: C.light },
      });
      y = table3EndY + 8;
    }

    // ── PERFORMANCE OPÉRATEURS
    const opMap = new Map();
    opPerf.forEach(p => {
      if (!p.operateurId) return;
      const c = opMap.get(p.operateurId) || { id: p.operateurId, nom: p.operateurNom, total: 0, nc: 0, w: 0 };
      c.total += p.totalChecklists || 0;
      c.nc    += p.nonConformites  || 0;
      c.w     += (p.tauxConformite || 0) * (p.totalChecklists || 0);
      opMap.set(p.operateurId, c);
    });
    const top6 = Array.from(opMap.values())
      .map(o => ({ ...o, taux: o.total > 0 ? Math.round(o.w / o.total) : 0 }))
      .sort((a, b) => b.taux - a.taux)
      .slice(0, 6);

    if (top6.length > 0) {
      if (y > 170) { doc.addPage(); y = 16; }
      y = sectionTitle(tr('operatorPerformance'), y);
      autoTable(doc, {
        startY: y,
        head: [['#', 'Opérateur', 'Checklists', 'NC', 'Taux conformité', 'Statut']],
        body: top6.map((o, i) => [
          i + 1,
          o.nom || '—',
          o.total,
          o.nc,
          `${o.taux}%`,
          o.taux >= 85 ? 'Excellent' : o.taux >= 65 ? 'Attention' : 'Critique',
        ]),
        theme: 'plain',
        headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: C.dark },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 70 },
          2: { cellWidth: 28, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 32, halign: 'center' },
          5: { cellWidth: 32, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const v = data.cell.text[0];
            data.cell.styles.textColor =
              v === 'Excellent' ? C.green :
              v === 'Attention' ? C.amber : C.red;
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4 && data.section === 'body') {
            data.cell.styles.textColor = scoreC(parseInt(data.cell.text[0]));
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: 10, right: 10 },
        alternateRowStyles: { fillColor: C.light },
      });
    }

    // ── FOOTER sur chaque page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...C.light);
      doc.rect(0, doc.internal.pageSize.getHeight() - 8, W, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...C.gray);
      doc.text(
        `LEONI Quality Insights — ${filterLabel} — Généré le ${now}`,
        10,
        doc.internal.pageSize.getHeight() - 2.5
      );
      doc.text(
        `Page ${i} / ${totalPages}`,
        W - 10,
        doc.internal.pageSize.getHeight() - 2.5,
        { align: 'right' }
      );
    }

    // Sauvegarde
    const fileName = `LEONI_rapport_${filterYear ? `${filterYear}${filterSemester ? `_S${filterSemester}` : ''}` : `${rangeDays}j`}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

  } catch (err) {
    console.error('Export PDF error:', err);
    alert('Erreur lors de la génération du PDF : ' + err.message);
  } finally {
    setExporting(false);
  }
}, [filterYear, filterSemester, rangeDays, locale, tr, tauxConf, stats, rejetes, validees, enAtt, totalCL,
    siteStats, processusStats, clInRange, criteresMap, lang, opPerf, buildTopCriteresLocalized]);

  /* ── handlers ── */
  const handleSiteSelect = (site) => {
    if (selSite?.id === site.id) { setSelSite(null); setSelPlant(null); setSelProcessus(null); }
    else { setSelSite(site); setSelPlant(null); setSelProcessus(null); }
  };
  const handlePlantSelect = (plant) => {
    if (selPlant?.id === plant.id) { setSelPlant(null); setSelProcessus(null); }
    else { setSelPlant(plant); setSelProcessus(null); }
  };
  const handleProcessusSelect = (proc) => {
    setSelProcessus(selProcessus?.id === proc.id ? null : proc);
  };
  const handleReset = () => { setSelSite(null); setSelPlant(null); setSelProcessus(null); };

  /* ── loading ── */
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 16,
        background: LEONI.bgPrimary,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: `3px solid ${LEONI.border}`,
          borderTopColor: LEONI.accent.primary,
          borderRadius: '50%',
          animation: 'spin .8s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 13, color: LEONI.textMuted, fontWeight: 500 }}>
          {tr('loadingData')}
        </span>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div ref={dashboardRef} style={{
      background: LEONI.bgPrimary,
      minHeight: '100vh',
      fontFamily: LEONI.fontFamily,
      color: LEONI.textPrimary,
      width: '100%',
      overflowX: 'hidden',
    }}>
      {/* Global styles */}
      <style>{`
        * {
          box-sizing: border-box;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: ${LEONI.borderLight};
          border-radius: ${LEONI.radius.full}px;
        }
        ::-webkit-scrollbar-thumb {
          background: ${LEONI.border};
          border-radius: ${LEONI.radius.full}px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${LEONI.textMuted};
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: LEONI.bgDark,
        padding: isMobile ? '0 12px' : `0 ${LEONI.spacing.xxl}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: headerHeight,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0 }}>
          {/* Logo area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 28,
              height: 28,
              background: LEONI.accent.primary,
              borderRadius: LEONI.radius.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>L</span>
            </div>
            <span style={{
              fontSize: isMobile ? 11 : 13,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.8px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{`LEONI • ${tr('qualityInsights')}`}</span>
          </div>
          {!isMobile && <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />}
          {!isMobile && <span style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            fontWeight: 500,
          }}>{tr('executiveBoard')}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{
            fontSize: isMobile ? 10 : 11,
            color: 'rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.08)',
            padding: isMobile ? '3px 8px' : '4px 10px',
            borderRadius: LEONI.radius.full,
            whiteSpace: 'nowrap',
          }}>
            {new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        background: LEONI.bgSecondary,
        borderBottom: `1px solid ${LEONI.border}`,
        padding: isMobile ? '10px 12px' : `12px ${LEONI.spacing.xxl}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        position: 'sticky',
        top: headerHeight,
        zIndex: 99,
      }}>
        <Breadcrumb
          site={selSite}
          plant={selPlant}
          processus={selProcessus}
          onReset={handleReset}
          onSelectSite={(s) => { setSelSite(s); setSelPlant(null); setSelProcessus(null); }}
          onSelectPlant={(p) => { setSelPlant(p); setSelProcessus(null); }}
          tr={tr}
        />
        
        <div style={{
          marginLeft: isMobile ? 0 : 'auto',
          width: isMobile ? '100%' : 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: LEONI.textSecondary }}>{tr('period')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[7, 14, 30, 90].map(n => (
            <button
              key={n}
              onClick={() => { setRange(n); setFilterYear(null); setFilterSemester(null); }}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${rangeDays === n && filterYear === null ? LEONI.accent.primary : LEONI.border}`,
                background: rangeDays === n && filterYear === null ? LEONI.accent.primary : 'transparent',
                color: rangeDays === n && filterYear === null ? '#fff' : LEONI.textSecondary,
                borderRadius: LEONI.radius.md,
                fontFamily: 'inherit',
                transition: LEONI.transition,
              }}
            >
              {`${n}${tr('daysShort')}`}
            </button>
            ))}
          </div>
          {/* Year filter */}
          {availableYears.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: LEONI.textMuted, fontWeight: 500 }}>|</span>
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => { setFilterYear(filterYear === year ? null : year); setFilterSemester(null); }}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${filterYear === year ? LEONI.accent.secondary : LEONI.border}`,
                    background: filterYear === year ? LEONI.accent.secondary : 'transparent',
                    color: filterYear === year ? '#fff' : LEONI.textSecondary,
                    borderRadius: LEONI.radius.md,
                    fontFamily: 'inherit',
                    transition: LEONI.transition,
                  }}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
          {/* Semester filter (visible uniquement si une annee est selectionnee) */}
          {filterYear !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: LEONI.textMuted, fontWeight: 500 }}>|</span>
              {[1, 2].map(sem => (
                <button
                  key={sem}
                  onClick={() => setFilterSemester(filterSemester === sem ? null : sem)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${filterSemester === sem ? LEONI.accent.secondary : LEONI.border}`,
                    background: filterSemester === sem ? LEONI.accent.secondary : 'transparent',
                    color: filterSemester === sem ? '#fff' : LEONI.textSecondary,
                    borderRadius: LEONI.radius.md,
                    fontFamily: 'inherit',
                    transition: LEONI.transition,
                  }}
                >
                  {tr(sem === 1 ? 'sem1' : 'sem2')}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={load}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${LEONI.border}`,
              background: 'transparent',
              color: LEONI.textSecondary,
              borderRadius: LEONI.radius.md,
              fontFamily: 'inherit',
              transition: LEONI.transition,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${LEONI.accent.primary}04`;
              e.currentTarget.style.borderColor = LEONI.accent.primary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = LEONI.border;
            }}
          >
            {`↻ ${tr('refresh')}`}
          </button>
          {/* Export PDF */}
          <button
            className="no-print"
            onClick={handleExportPDF}
            disabled={exporting}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 600,
              cursor: exporting ? 'wait' : 'pointer',
              border: `1px solid ${LEONI.accent.danger}`,
              background: exporting ? `${LEONI.accent.danger}20` : LEONI.accent.danger,
              color: '#fff',
              borderRadius: LEONI.radius.md,
              fontFamily: 'inherit',
              transition: LEONI.transition,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? '⏳ Export…' : '⬇ PDF'}
          </button>
        </div>
      </div>

      <div style={{
        padding: isMobile ? '12px' : `${LEONI.spacing.xl}px ${LEONI.spacing.xxl}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 14 : 20,
      }}>

        {/* ── KPI row ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : isTablet
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: isMobile ? 10 : 16,
        }}>
          <KpiCard
            label={tr('kpiConformityRate')}
            value={`${Number(tauxConf).toFixed(1)}%`}
            color={scoreColor(tauxConf)}
            sub={tr('overXChecklists', { count: totalCL })}
            icon="✓"
            trend={stats?.evolutionConf ? stats.evolutionConf : null}
            trendValue={stats?.evolutionConf}
          />
          <KpiCard
            label={tr('kpiNonConformities')}
            value={stats?.nonConformites ?? rejetes}
            color={LEONI.status.red}
            sub={tr('detectedInPeriod')}
            icon="⚠"
          />
          <KpiCard
            label={tr('kpiFinalValidations')}
            value={stats?.checklistsValidees ?? validees}
            color={LEONI.status.green}
            sub={tr('approvedChecklists')}
            icon="✔"
          />
          <KpiCard
            label={tr('kpiPending')}
            value={stats?.enAttente ?? enAtt}
            color={LEONI.status.amber}
            sub={tr('pendingStates')}
            icon="⏳"
          />
        </div>

        {/* ── Main layout ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: isMobile ? 14 : 20,
        }}>
          {/* LEFT — NC Trend */}
          <div style={{
            background: LEONI.bgCard,
            borderRadius: LEONI.radius.lg,
            padding: `18px 20px`,
            boxShadow: LEONI.shadowCard,
            border: `1px solid ${LEONI.border}`,
          }}>
            <STitle accent={LEONI.status.red}>
              {tr('ncEvolution')}
              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 8, color: LEONI.textMuted }}>
                {`• ${rangeDays} ${tr('daysShort')}`}
              </span>
            </STitle>
            <ChartCanvas id="nc-trend" config={ncTrendConfig} height={isMobile ? 180 : 200} />
          </div>

          {/* RIGHT — Répartition Sites */}
          <div style={{
            background: LEONI.bgCard,
            borderRadius: LEONI.radius.lg,
            padding: `18px 20px`,
            boxShadow: LEONI.shadowCard,
            border: `1px solid ${LEONI.border}`,
          }}>
            <STitle
              accent={LEONI.accent.primary}
              action={siteStats.length > 0 && <SummaryDonut items={siteStats} tr={tr} />}
            >
              {tr('performanceBySite')}
            </STitle>
            {siteStats.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                background: `${LEONI.bgPrimary}`,
                borderRadius: LEONI.radius.lg,
              }}>
                <span style={{ fontSize: 32, opacity: 0.3 }}>🏭</span>
                <div style={{ fontSize: 13, color: LEONI.textMuted, marginTop: 8 }}>
                  {tr('noDataAvailable')}
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: isMobile ? 260 : 210, overflowY: 'auto', marginTop: 4 }}>
                {siteStats.map(site => (
                  <TLRow
                    key={site.id}
                    item={site}
                    onClick={handleSiteSelect}
                    selected={selSite}
                    showDetail
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Drill-down panel ── */}
        <div style={{
          background: LEONI.bgCard,
          borderRadius: LEONI.radius.lg,
          padding: `20px 24px`,
          boxShadow: LEONI.shadowCard,
          border: `1px solid ${LEONI.border}`,
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 4,
                height: 20,
                background: LEONI.accent.secondary,
                borderRadius: LEONI.radius.sm,
              }} />
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                color: LEONI.textPrimary,
                textTransform: 'uppercase',
                letterSpacing: '0.7px',
              }}>
                {tr('detailedAnalysis')}
              </span>
              {selSite && (
                <span style={{
                  fontSize: 11,
                  color: LEONI.textMuted,
                  fontWeight: 400,
                }}>
                  — {selSite.name}
                  {selPlant && ` › ${selPlant.name}`}
                </span>
              )}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: selSite ? 'repeat(3, minmax(260px, 1fr))' : '1fr',
            gap: isMobile ? 16 : 24,
            overflowX: selSite ? 'auto' : 'visible',
          }}>
            {/* COLUMN 1 — Plants */}
            {selSite && (
              <div style={{
                ...(selPlant && !isMobile && !isTablet && { borderRight: `1px solid ${LEONI.border}`, paddingRight: 20 }),
              }}>
                <DrillPanel
                  title={`📋 ${tr('workshops')}`}
                  subtitle={tr('siteLabel', { name: selSite.name })}
                  items={plantStats}
                  onSelect={handlePlantSelect}
                  selected={selPlant}
                  color={LEONI.accent.secondary}
                  showDetail
                  tr={tr}
                />
                {plantStats.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${LEONI.border}` }}>
                    <SummaryDonut items={plantStats} tr={tr} />
                  </div>
                )}
              </div>
            )}

            {/* COLUMN 2 — Processus */}
            {selSite && (
              <div style={{
                ...(selProcessus && !isMobile && !isTablet && { borderRight: `1px solid ${LEONI.border}`, paddingRight: 20 }),
              }}>
                <DrillPanel
                  title={`⚙️ ${tr('processes')}`}
                  subtitle={selPlant ? tr('workshopLabel', { name: selPlant.name }) : tr('allWorkshopsForSite', { name: selSite.name })}
                  items={processusStats}
                  onSelect={handleProcessusSelect}
                  selected={selProcessus}
                  color={LEONI.accent.info}
                  showDetail
                  tr={tr}
                />
                {processusStats.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${LEONI.border}` }}>
                    <SummaryDonut items={processusStats} tr={tr} />
                  </div>
                )}
              </div>
            )}

            {/* COLUMN 3 — Top Critères */}
            {selSite && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: LEONI.status.red,
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: 4,
                  }}>
                    {`🔝 ${tr('topFailingCriteria')}`}
                  </div>
                  <div style={{ fontSize: 11, color: LEONI.textMuted }}>
                    {selProcessus
                      ? tr('processLabel', { name: selProcessus.name })
                      : selPlant
                        ? tr('workshopLabel', { name: selPlant.name })
                        : tr('siteLabel', { name: selSite.name })
                    }
                    {' • '}
                    <span style={{ fontWeight: 600, color: LEONI.textSecondary }}>
                      {tr('checklistsCount', { count: clForCriteres.length })}
                    </span>
                  </div>
                </div>
                <TopCriteresPanel checklists={clForCriteres} criteresMap={criteresMap} tr={tr} lang={lang} />
              </div>
            )}

            {/* No site selected placeholder */}
            {!selSite && (
              <div style={{
                padding: 48,
                textAlign: 'center',
                background: `${LEONI.bgPrimary}`,
                borderRadius: LEONI.radius.lg,
                border: `1px dashed ${LEONI.border}`,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>📍</div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: LEONI.textPrimary,
                  marginBottom: 6,
                }}>
                  {tr('selectSiteTitle')}
                </div>
                <div style={{ fontSize: 12, color: LEONI.textMuted, maxWidth: 280, margin: '0 auto' }}>
                  {tr('selectSiteHint')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row: Processus NC chart + Opérateurs ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: isMobile ? 14 : 20,
        }}>
          {/* Processus bar chart */}
          <div style={{
            background: LEONI.bgCard,
            borderRadius: LEONI.radius.lg,
            padding: `18px 20px`,
            boxShadow: LEONI.shadowCard,
            border: `1px solid ${LEONI.border}`,
          }}>
            <STitle accent={LEONI.accent.info}>
              {tr('conformityByProcess')}
              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 8, color: LEONI.textMuted }}>
                {`• ${tr('globalView')}`}
              </span>
            </STitle>
            <ChartCanvas id="proc-bar" config={procBarConfig} height={isMobile ? 180 : 200} />
          </div>

          {/* Opérateurs */}
          <div style={{
            background: LEONI.bgCard,
            borderRadius: LEONI.radius.lg,
            padding: `18px 20px`,
            boxShadow: LEONI.shadowCard,
            border: `1px solid ${LEONI.border}`,
          }}>
            <STitle accent={LEONI.status.amber}>
              {tr('operatorPerformance')}
              <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 8, color: LEONI.textMuted }}>
                {`• ${tr('top6')}`}
              </span>
            </STitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const map = new Map();
                opPerf.forEach(p => {
                  if (!p.operateurId) return;
                  const c = map.get(p.operateurId) || { id: p.operateurId, nom: p.operateurNom, total: 0, nc: 0, w: 0 };
                  c.total += p.totalChecklists || 0;
                  c.nc += p.nonConformites || 0;
                  c.w += (p.tauxConformite || 0) * (p.totalChecklists || 0);
                  map.set(p.operateurId, c);
                });
                const top6 = Array.from(map.values())
                  .map(o => ({ ...o, taux: o.total > 0 ? Math.round(o.w / o.total) : 0 }))
                  .sort((a, b) => b.taux - a.taux)
                  .slice(0, 6);
                
                if (top6.length === 0) {
                  return (
                    <div style={{ padding: 40, textAlign: 'center', background: `${LEONI.bgPrimary}`, borderRadius: LEONI.radius.lg }}>
                      <span style={{ fontSize: 32, opacity: 0.3 }}>👥</span>
                      <div style={{ fontSize: 13, color: LEONI.textMuted, marginTop: 8 }}>
                        {tr('noOperatorFound')}
                      </div>
                    </div>
                  );
                }
                
                return top6.map((op, i) => {
                  const col = scoreColor(op.taux);
                  const initials = op.nom
                    ? op.nom.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    : '??';
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div
                      key={op.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: i < 3 ? `${LEONI.status.amber}08` : 'transparent',
                        borderRadius: LEONI.radius.md,
                        transition: LEONI.transition,
                      }}
                    >
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: LEONI.radius.full,
                        background: `${col}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        color: col,
                        flexShrink: 0,
                      }}>
                        {medal || initials}
                      </div>
                      <span style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: 500,
                        color: LEONI.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {op.nom || '-'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: LEONI.textMuted,
                        background: `${LEONI.textMuted}10`,
                        padding: '2px 6px',
                        borderRadius: LEONI.radius.full,
                      }}>
                        {`${op.total} ${tr('clShort')}`}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, minWidth: 65 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>
                          {op.taux}%
                        </span>
                        <div style={{
                          width: 55,
                          height: 3,
                          background: LEONI.border,
                          borderRadius: LEONI.radius.full,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${op.taux}%`,
                            background: col,
                            borderRadius: LEONI.radius.full,
                            transition: 'width 0.4s',
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}