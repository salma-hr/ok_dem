export const STATUS_CONFIG = {
  SOUMIS: { label: "Soumis", cls: "badge-orange" },
  EN_COURS: { label: "En cours", cls: "badge-blue" },
  VALIDE_N1: { label: "Validé N1", cls: "badge-blue" },
  VALIDE_N2: { label: "Validé N2", cls: "badge-blue" },
  VALIDE_FINAL: { label: "Validé", cls: "badge-green" },
  REJETE: { label: "Rejeté", cls: "badge-red" },
  EN_ATTENTE: { label: "En attente", cls: "badge-orange" },
  OUVERT: { label: "À faire", cls: "badge-orange" },
  CLOS: { label: "Clôturé", cls: "badge-green" },
};

export function getStatusMeta(status) {
  return STATUS_CONFIG[status] || { label: status || "-", cls: "badge-gray" };
}
