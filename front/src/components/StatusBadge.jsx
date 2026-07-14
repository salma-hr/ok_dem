import React from 'react';
import { useI18n } from '../context/I18nContext';

function toSafeLabel(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return value.error || value.message || (value.status ? `Erreur ${value.status}` : 'Erreur');
  }
  return 'Inconnu';
}

const STATUS_CONFIG = {
  // Checklist statuses
  EN_COURS:     { labelKey: 'status.checklist.inProgress', className: 'badge-blue' },
  SOUMIS:       { labelKey: 'status.checklist.submitted', className: 'badge-amber' },
  VALIDE_N1:    { labelKey: 'status.checklist.validatedN1', className: 'badge-orange' },
  VALIDE_N2:    { labelKey: 'status.checklist.validatedN2', className: 'badge-blue' },
  VALIDE_FINAL: { labelKey: 'status.checklist.validatedFinal', className: 'badge-green' },
  REJETE:       { labelKey: 'status.checklist.rejected', className: 'badge-red' },
  // Plan action statuses
  OUVERT:       { labelKey: 'status.planAction.open', className: 'badge-red' },
  EN_COURS_PA:  { labelKey: 'status.planAction.inProgress', className: 'badge-amber' },
  CLOS:         { labelKey: 'status.planAction.closed', className: 'badge-green' },
};

export function StatusBadge({ status, type = 'checklist' }) {
  const { t } = useI18n();
  const key = type === 'planAction' && status === 'EN_COURS' ? 'EN_COURS_PA' : status;
  const config = STATUS_CONFIG[key] || { label: toSafeLabel(status), className: 'badge-gray' };
  const label = config.labelKey ? t(config.labelKey) : toSafeLabel(config.label);
  return (
    <span className={`badge ${config.className}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

export function ValeurBadge({ valeur }) {
  const { t } = useI18n();
  const config = {
    VERT:  { labelKey: 'status.value.conforme', className: 'badge-green' },
    JAUNE: { labelKey: 'status.value.watch', className: 'badge-amber' },
    ROUGE: { labelKey: 'status.value.nonconforme', className: 'badge-red' },
    NA:    { labelKey: 'status.value.na', className: 'badge-gray' },
  }[valeur] || { label: toSafeLabel(valeur), className: 'badge-gray' };
  const label = config.labelKey ? t(config.labelKey) : toSafeLabel(config.label);
  return (
    <span className={`badge ${config.className}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}