/**
 * Retourne le nom du critère dans la langue active.
 * Fallback toujours vers le français si la traduction manque.
 */
export function getCritereNom(critere, lang) {
  if (!critere) return "";
  if (lang === "ar") return critere.nomAr || critere.nom;
  if (lang === "en") return critere.nomEn || critere.nom;
  if (lang === "de") return critere.nomDe || critere.nom;
  return critere.nom;
}

export function getCritereDescription(critere, lang) {
  if (!critere) return "";
  if (lang === "ar") return critere.descriptionAr || critere.description;
  if (lang === "en") return critere.descriptionEn || critere.description;
  if (lang === "de") return critere.descriptionDe || critere.description;
  return critere.description;
}