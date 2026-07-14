package com.example.service;

import com.example.dto.CritereRequest;
import com.example.entity.Critere;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Parser PDF pour checklists LEONI — validé sur USS (15 critères) et Coupe (21
 * critères).
 *
 * ═══════════════════════════════════════════════════════════════
 * STRATÉGIE : ZIP SÉQUENTIEL EN 3 PHASES
 * ═══════════════════════════════════════════════════════════════
 * PDFBox extrait le texte dans un ordre non-linéaire :
 * 1. Textes FR des critères dans l'ordre des sections
 * 2. Texte arabe fragmenté (réassemblé puis aligné par section)
 * 3. Couleurs séquentielles : Jaune/أصفر, Jaune/أصفر, Rouge/أحمر...
 * 4. États M/A séquentiels (non utilisés — pas dans le modèle Critere)
 * 5. Moyens de vérification séquentiels : Visuel, Simulation, En production
 *
 * Règle clé pour les moyens :
 * "Visuel" (sans espace trailing dans la source) → VISUEL seul
 * "Visuel " (avec espace trailing) → regarde suivant : si Simulation →
 * SIMULATION
 * "Visuel /" ou "Visuel / " → regarde suivant : si Simulation → SIMULATION
 * "Simulation" seule (non consommée) → SIMULATION
 * "En" + "production" → EN_PRODUCTION
 *
 * Couleurs : FR et AR alternés dans le PDF extrait (Jaune/أصفر/Jaune/أصفر...)
 * → garder un sur deux (indices pairs = FR)
 * ═══════════════════════════════════════════════════════════════
 */
@Slf4j
@Component
public class PdfCritereParser {

    private static final Pattern FR_ACCENT_PATTERN = Pattern.compile("(?iu)[àâäéèêëïîôöùûüçœ]");
    private static final Pattern FR_WORD_BREAK_PATTERN = Pattern.compile("(?iu)\\b\\p{L}\\s+\\p{L}{3,}\\b");
    private static final String[] AR_VERBS = {
            "توفير", "التحقق", "التأكد", "فحص", "مراقبة", "ضمان", "تطهير", "إبلاغ", "تنبيه", "مراجعة",
            "التثبت", "تحقق"
    };
    private static final Pattern AR_CATEGORY_PREFIX_PATTERN = Pattern.compile(
            "^\\s*(?:\\d+\\s*)?(?:[-–—•])?\\s*(الطريقة|الطريقه|الآلة|اآللة|الالة|الاله|الماكينة|الماكينه|المادة|الماده|البيئة|البيئه|العامل)\\s*[:\\-–—]*");
    private static final Pattern AR_CATEGORY_INLINE_PATTERN = Pattern.compile(
            "(?:^|[\\s،؛.])((?:\\d+\\s*)?(?:[-–—•])?\\s*(الطريقة|الطريقه|الآلة|اآللة|الالة|الاله|الماكينة|الماكينه|المادة|الماده|البيئة|البيئه|العامل)\\s*[:\\-–—])");
    private static final Pattern AR_VERB_SPLIT_PATTERN = Pattern.compile(
            "(?:^|[\\s،؛.])((?:\\d+\\s*)?(?:[-–—•])?\\s*(توفير|التحقق|التأكد|فحص|مراقبة|ضمان|تطهير|إبلاغ|تنبيه|مراجعة|التثبت|تحقق|إذا\\s+كانت|إذا))");

    public List<CritereRequest> parse(MultipartFile file, Long processusId) throws IOException {
        // Double lecture PDF :
        // - triée par position pour une meilleure fidélité du texte des critères
        // - ordre naturel pour conserver la séquence des métadonnées (couleurs/moyens)
        String rawTextLecture = extraireTexte(file, true);
        String rawTextMeta = extraireTexte(file, false);

        String[] lignesLecture = rawTextLecture.split("\\r?\\n", -1);
        String[] lignesMeta = rawTextMeta.split("\\r?\\n", -1);

        // Phase 1 : critères FR avec leur section (QUALITE / TECHNIQUE / SECURITE)
        // IMPORTANT: on compare les 2 modes d'extraction et on garde le meilleur
        // pour éviter les régressions de comptage (ex: 3 au lieu de 15).
        List<CritereRequest> criteresLecture = extraireCriteresFR(lignesLecture, processusId);
        List<CritereRequest> criteresMeta = extraireCriteresFR(lignesMeta, processusId);

        int scoreLecture = scoreQualiteTexteFr(criteresLecture);
        int scoreMeta = scoreQualiteTexteFr(criteresMeta);

        boolean useLecture;
        if (criteresLecture.size() != criteresMeta.size()) {
            useLecture = criteresLecture.size() > criteresMeta.size();
        } else {
            // A taille égale, privilégier le texte FR le plus lisible (accents, mots non
            // cassés).
            useLecture = scoreLecture > scoreMeta;
        }

        List<CritereRequest> criteres = useLecture ? criteresLecture : criteresMeta;
        String[] lignesSourceCriteres = useLecture ? lignesLecture : lignesMeta;

        log.info("Extraction FR -> lecture(position): {} (score={}), meta(naturelle): {} (score={}), choisi: {}",
                criteresLecture.size(), scoreLecture, criteresMeta.size(), scoreMeta, useLecture ? "lecture" : "meta");

        if (criteres.isEmpty()) {
            log.warn("Aucun critère FR détecté dans le PDF");
            return criteres;
        }

        // Phase 1b : traductions AR (si présentes) et alignement par section
        Map<Critere.TypeCritere, List<String>> arabesParSection = extraireCriteresARParSection(lignesSourceCriteres);
        long totalAr = arabesParSection.values().stream().mapToLong(List::size).sum();
        if (totalAr == 0) {
            arabesParSection = extraireCriteresARParSection(useLecture ? lignesMeta : lignesLecture);
        }
        injecterTraductionsArabes(criteres, arabesParSection);

        // Phase 2 : métadonnées séquentielles
        List<String> couleurs = extraireCouleurs(lignesMeta);
        List<String> moyens = extraireMoyens(lignesMeta);

        log.info("Critères: {}, Couleurs: {}, Moyens: {}",
                criteres.size(), couleurs.size(), moyens.size());

        // Phase 3 : zip index par index
        for (int i = 0; i < criteres.size(); i++) {
            if (i < couleurs.size())
                criteres.get(i).setCouleur(couleurs.get(i));
            if (i < moyens.size())
                criteres.get(i).setMoyenVerification(moyens.get(i));
        }

        long withArabic = criteres.stream()
                .filter(c -> c.getNomAr() != null && !c.getNomAr().isBlank())
                .count();

        log.info("Traductions AR: {} / {}", withArabic, criteres.size());

        log.info("Parser terminé : {} critères prêts", criteres.size());
        return criteres;
    }

    private int scoreQualiteTexteFr(List<CritereRequest> criteres) {
        int accents = 0;
        int motsCasses = 0;
        int longueur = 0;

        for (CritereRequest c : criteres) {
            String fr = ((c.getNom() == null ? "" : c.getNom()) + " "
                    + (c.getDescription() == null ? "" : c.getDescription())).trim();
            if (fr.isEmpty()) {
                continue;
            }

            longueur += fr.length();
            accents += compterOccurrencesRegex(fr, FR_ACCENT_PATTERN);
            motsCasses += compterOccurrencesRegex(fr, FR_WORD_BREAK_PATTERN);
        }

        // Plus d'accents et de texte utile = mieux ; mots cassés = pénalité.
        return (accents * 5) + (longueur / 200) - (motsCasses * 8);
    }

    private int compterOccurrencesRegex(String texte, Pattern pattern) {
        int count = 0;
        java.util.regex.Matcher m = pattern.matcher(texte);
        while (m.find()) {
            count++;
        }
        return count;
    }

    // ── Phase 1 : Extraction des critères FR ─────────────────────────────────

    private List<CritereRequest> extraireCriteresFR(String[] lignes, Long processusId) {
        List<CritereRequest> result = new ArrayList<>();
        Critere.TypeCritere section = Critere.TypeCritere.QUALITE;
        CritereRequest courant = null;
        StringBuilder bufFr = new StringBuilder();
        Integer pendingId = null;

        for (String ligne : lignes) {
            for (String segment : decouperSegmentsCritere(ligne)) {
                String t = segment.trim();
                if (t.isEmpty())
                    continue;

                // Numéro isolé : ex. "3" puis ligne suivante "M Machine : ..."
                if (t.matches("^\\d{1,2}$")) {
                    pendingId = Integer.parseInt(t);
                    continue;
                }

                // ── Changement de section FR/AR ─────────────────────────────
                Critere.TypeCritere detectedSection = detecterSection(t);
                if (detectedSection != null) {
                    courant = flush(courant, bufFr, result);
                    section = detectedSection;
                    pendingId = null;
                    continue;
                }

                // ── Bruit → ignorer ──────────────────────────────────────────
                if (estBruit(t))
                    continue;

                // ── Nouveau critère ──────────────────────────────────────────
                // Formes : "M Méthode : ..." / "M Machine : ..." / "9 M Machine : ..."
                // Cas spécial : "M Machine :\n Vérifier..." sur 2 lignes (critères 6 et 7 USS)
                // + ligne fusionnée : "... : M Machine : ..."
                if (estDebutCritereLigne(t, pendingId)) {
                    Integer currentId = extraireIdCritere(t, pendingId);

                    courant = flush(courant, bufFr, result);

                    courant = new CritereRequest();
                    courant.setProcessusId(processusId);
                    courant.setType(section);
                    courant.setCouleur("Jaune"); // défaut, écrasé phase 3
                    courant.setMoyenVerification("VISUEL"); // défaut, écrasé phase 3

                    // Supprimer le numéro si présent en ligne ("9 M Machine:" → "M Machine:")
                    String corps = t.replaceFirst("^\\d{1,2}\\s+", "").trim();
                    courant.setCategorie(detecterCategorie(corps));

                    // Supprimer le préfixe "M Machine :" etc.
                    String desc = corps.replaceFirst(
                            "(?i)^M(?:\\s+|\\s*[\\.:/\\-]\\s*)[^:\\r\\n]{2,60}\\s*[:\\.]\\s*",
                            "");
                    bufFr = new StringBuilder(nettoyerLigneFr(retirerTexteArabe(desc)));
                    pendingId = null;
                    continue;
                }

                // ── Continuation FR : conserver la partie française des lignes mixtes FR/AR
                // ────────
                if (courant != null && !estMetadonneeIsolee(t)) {
                    String frSansAr = nettoyerLigneFr(retirerTexteArabe(t));
                    if (frSansAr.isBlank()
                            || !contientTexteFrancaisSignificatif(frSansAr)
                            || estMetadonneeIsolee(frSansAr)
                            || estBruit(frSansAr)) {
                        continue;
                    }
                    if (bufFr.length() > 0)
                        bufFr.append(" ");
                    bufFr.append(frSansAr.trim());
                    pendingId = null;
                }
            }
        }

        flush(courant, bufFr, result);
        return result;
    }

    private List<String> decouperSegmentsCritere(String ligne) {
        String t = ligne == null ? "" : ligne.trim();
        if (t.isEmpty()) {
            return Collections.emptyList();
        }

        String catChunk = "[^:\\r\\n]{2,60}";
        // Split in-line uniquement sur des en-têtes numérotés (ex: "10 M Machine :")
        // pour éviter les faux positifs type signatures "M.Ben ...".
        String markerPattern = "(?i)(?<!\\p{L})\\d{1,2}\\s+M(?:\\s+|\\s*[\\.:/\\-]\\s*)" + catChunk + "\\s*[:\\.]";

        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(markerPattern);
        java.util.regex.Matcher matcher = pattern.matcher(t);

        List<String> out = new ArrayList<>();
        int last = 0;
        boolean found = false;

        while (matcher.find()) {
            int start = matcher.start();
            if (start > last) {
                String before = t.substring(last, start).trim();
                if (!before.isEmpty()) {
                    out.add(before);
                }
            }
            last = start;
            found = true;
        }

        if (found) {
            String tail = t.substring(last).trim();
            if (!tail.isEmpty()) {
                out.add(tail);
            }
            return out;
        }

        out.add(t);
        return out;
    }

    private Critere.TypeCritere detecterSection(String t) {
        String tl = t.toLowerCase(Locale.ROOT);

        if (tl.matches("(?i)crit[eé]res?\\s+technique.*")) {
            return Critere.TypeCritere.TECHNIQUE;
        }
        if (tl.matches("(?i)crit[eé]res?\\s+s[eé]curit[eé].*") || t.equals("Critéres Sécurité / 5S")) {
            return Critere.TypeCritere.SECURITE;
        }
        if (tl.matches("(?i)crit[eé]res?\\s+qualit[eé].*")) {
            return Critere.TypeCritere.QUALITE;
        }

        if (t.contains("معايير الجودة")) {
            return Critere.TypeCritere.QUALITE;
        }
        if (t.contains("معايير") && (t.contains("تقنية") || t.contains("التقنية"))) {
            return Critere.TypeCritere.TECHNIQUE;
        }
        if (t.contains("معايير")
                && (t.contains("السلامة") || t.contains("السالمة") || t.contains("5S") || t.contains("S5"))) {
            return Critere.TypeCritere.SECURITE;
        }

        return null;
    }

    private boolean estDebutCritereLigne(String t, Integer pendingId) {
        String catChunk = "[^:\\r\\n]{2,60}";
        String mPrefix = "M(?:\\s+|\\s*[\\.:/\\-]\\s*)";
        boolean withId = t.matches("(?i)^\\d{1,2}\\s+" + mPrefix + catChunk + "\\s*[:\\.].*");
        boolean withoutId = t.matches("(?i)^" + mPrefix + catChunk + "\\s*[:\\.].*");
        return withId || (pendingId != null && withoutId);
    }

    private Integer extraireIdCritere(String t, Integer pendingId) {
        try {
            if (t.matches("^\\d{1,2}\\s+.*")) {
                String id = t.replaceFirst("^(\\d{1,2}).*$", "$1");
                return Integer.parseInt(id);
            }
        } catch (Exception ignored) {
        }
        return pendingId;
    }

    private String nettoyerLigneFr(String t) {
        if (t == null)
            return "";

        String s = t
                .replace('\u00A0', ' ')
                .replace('\t', ' ')
                .replaceAll("^\\d{1,2}\\s*[:.)\\-]+\\s*", "")
                .replaceAll("[\"`´]+", "'")
                .replaceAll("\\s{2,}", " ")
                .trim();

        s = recollerAccentsFrancais(s);

        // Retire les suffixes de métadonnées qui polluent les critères.
        for (int i = 0; i < 3; i++) {
            String before = s;
            s = s
                    .replaceAll("(?i)\\b(Rouge|Jaune|Vert)\\b\\s*$", "")
                    .replaceAll(
                            "(?i)\\b([AMSN])\\s+(Visuel(?:\\s*/\\s*Simulation)?|Simulation|En\\s+production)\\b\\s*$",
                            "")
                    .replaceAll("(?i)\\b(Visuel\\s*/\\s*Simulation|Visuel|Simulation|En\\s+production)\\b\\s*$", "")
                    .replaceAll("(?i)\\b([AMSN])\\b\\s*$", "")
                    .replaceAll("\\s{2,}", " ")
                    .trim();
            if (s.equals(before))
                break;
        }

        s = recollerAccentsFrancais(s);

        if (!contientTexteFrancaisSignificatif(s)) {
            return "";
        }

        return s;
    }

    private String recollerAccentsFrancais(String input) {
        if (input == null || input.isBlank()) {
            return "";
        }

        String s = input;
        for (int i = 0; i < 3; i++) {
            String before = s;
            s = s
                    // Ex: "V é rifier" -> "Vérifier"
                    .replaceAll("(?iu)(\\p{L})\\s+([àâäéèêëîïôöùûüçœ])\\s+(\\p{L}{2,})", "$1$2$3")
                    // Ex: "pr é sence" -> "présence"
                    .replaceAll("(?iu)(\\p{L}{2,})\\s+([àâäéèêëîïôöùûüçœ])\\s+(\\p{L}{2,})", "$1$2$3")
                    .replaceAll("\\s{2,}", " ")
                    .trim();
            if (s.equals(before)) {
                break;
            }
        }
        return s;
    }

    private Map<Critere.TypeCritere, List<String>> extraireCriteresARParSection(String[] lignes) {
        Map<Critere.TypeCritere, List<String>> out = new EnumMap<>(Critere.TypeCritere.class);
        for (Critere.TypeCritere t : Critere.TypeCritere.values()) {
            out.put(t, new ArrayList<>());
        }

        Critere.TypeCritere section = Critere.TypeCritere.QUALITE;
        boolean inArabicSections = false;
        StringBuilder courant = new StringBuilder();

        for (String ligne : lignes) {
            for (String segment : decouperSegmentsArabe(ligne)) {
                String t = segment.trim();
                if (t.isEmpty())
                    continue;

                Critere.TypeCritere detected = detecterSection(t);
                if (detected != null) {
                    flushArabe(courant, out.get(section));
                    section = detected;
                    inArabicSections = true;
                    continue;
                }

                if (!inArabicSections)
                    continue;
                if (!contientArabe(t))
                    continue;
                if (estMetadonneeIsolee(t) || estBruitArabe(t))
                    continue;

                boolean startsNew = estDebutCritereArabe(t);
                if (startsNew && courant.length() > 0) {
                    flushArabe(courant, out.get(section));
                }

                String ar = nettoyerTexteArabe(t);
                if (ar.isEmpty() || !contientTexteArabeSignificatif(ar))
                    continue;

                if (courant.length() > 0)
                    courant.append(" ");
                courant.append(ar);

                if (ar.endsWith("؟") || ar.endsWith(".") || ar.endsWith("؛")) {
                    flushArabe(courant, out.get(section));
                }
            }
        }

        flushArabe(courant, out.get(section));
        return out;
    }

    private void injecterTraductionsArabes(List<CritereRequest> criteres,
            Map<Critere.TypeCritere, List<String>> arabesParSection) {
        Map<Critere.TypeCritere, Integer> counts = new EnumMap<>(Critere.TypeCritere.class);
        for (CritereRequest c : criteres) {
            Critere.TypeCritere type = c.getType() != null ? c.getType() : Critere.TypeCritere.QUALITE;
            counts.put(type, counts.getOrDefault(type, 0) + 1);
        }

        Map<Critere.TypeCritere, List<String>> pools = new EnumMap<>(Critere.TypeCritere.class);
        for (Critere.TypeCritere t : Critere.TypeCritere.values()) {
            List<String> base = arabesParSection.getOrDefault(t, Collections.emptyList());
            int expected = counts.getOrDefault(t, 0);
            List<String> normalized = base;

            if (expected > 1 && base.size() <= 1) {
                String blob = base.isEmpty() ? "" : base.get(0);
                normalized = splitBlocArabe(blob, expected);
            }

            if (expected > 1 && normalized.size() < expected && !normalized.isEmpty()) {
                List<String> expanded = new ArrayList<>();
                for (String entry : normalized) {
                    if (entry != null && entry.length() > 480) {
                        expanded.addAll(splitBlocArabe(entry, expected));
                    } else if (entry != null && !entry.isBlank()) {
                        expanded.add(entry);
                    }
                }
                if (!expanded.isEmpty()) {
                    normalized = expanded;
                }
            }

            pools.put(t, normalized);
        }

        Map<Critere.TypeCritere, Integer> idx = new EnumMap<>(Critere.TypeCritere.class);
        for (Critere.TypeCritere t : Critere.TypeCritere.values()) {
            idx.put(t, 0);
        }

        for (CritereRequest c : criteres) {
            if (c.getNomAr() != null && !c.getNomAr().isBlank())
                continue;

            Critere.TypeCritere type = c.getType() != null ? c.getType() : Critere.TypeCritere.QUALITE;
            List<String> pool = pools.getOrDefault(type, Collections.emptyList());
            int i = idx.getOrDefault(type, 0);

            while (i < pool.size()) {
                String cand = pool.get(i++).trim();
                if (cand.length() < 4 || !contientArabe(cand))
                    continue;

                if (cand.length() <= 490) {
                    c.setNomAr(cand);
                } else {
                    int cut = cand.lastIndexOf(' ', 480);
                    int safe = cut > 30 ? cut : 480;
                    c.setNomAr(cand.substring(0, safe).trim());
                    c.setDescriptionAr(cand.substring(safe).trim());
                }
                break;
            }

            idx.put(type, i);
        }
    }

    private void flushArabe(StringBuilder buf, List<String> out) {
        String ar = nettoyerTexteArabe(buf.toString());
        buf.setLength(0);

        if (ar.length() < 4 || !contientArabe(ar))
            return;
        if (out.isEmpty() || !out.get(out.size() - 1).equals(ar)) {
            out.add(ar);
        }
    }

    private boolean contientCategorieArabe(String t) {
        if (t == null || t.isBlank()) {
            return false;
        }
        return AR_CATEGORY_PREFIX_PATTERN.matcher(t).find();
    }

    private boolean estDebutCritereArabe(String t) {
        if (t == null || t.isBlank()) {
            return false;
        }
        String s = t.trim();
        if (AR_CATEGORY_PREFIX_PATTERN.matcher(s).find()) {
            return true;
        }
        if (s.matches("^\\d+\\s+.*")) {
            return true;
        }
        if (s.startsWith("إذا")) {
            return true;
        }
        for (String verb : AR_VERBS) {
            if (s.startsWith(verb)) {
                return true;
            }
        }
        return false;
    }

    private boolean estBruitArabe(String t) {
        String ar = nettoyerTexteArabe(t);
        String lettresAr = ar.replaceAll("[^\\u0600-\\u06FF]", "");

        if (lettresAr.length() < 3)
            return true;

        if (ar.equals("أحمر") || ar.equals("أصفر") || ar.equals("أخضر"))
            return true;
        if (ar.contains("غير قابل للتطبيق") || ar.contains("على ما يرام") || ar.contains("ليس على ما يرام"))
            return true;
        if (ar.contains("تنبيه المشرف") || ar.contains("لون العلم")
                || (ar.contains("بطاقة") && ar.contains("LTPM")))
            return true;
        if (ar.contains("الصباح") || ar.contains("المساء") || ar.contains("الليل"))
            return true;
        if (ar.contains("الأحد") || ar.contains("الإثنين") || ar.contains("الثلاثاء")
                || ar.contains("الأربعاء") || ar.contains("الخميس") || ar.contains("الجمعة")
                || ar.contains("السبت"))
            return true;

        return ar.equals("الجودة") || ar.equals("التقنية") || ar.equals("السلامة")
                || ar.equals("الطريقة") || ar.equals("الطريقه")
                || ar.equals("الآلة") || ar.equals("اآللة") || ar.equals("الالة") || ar.equals("الاله")
                || ar.equals("الماكينة") || ar.equals("الماكينه")
                || ar.equals("المادة") || ar.equals("الماده")
                || ar.equals("البيئة") || ar.equals("البيئه")
                || ar.equals("العامل")
                || ar.equals("م") || ar.equals("ا");
    }

    /**
     * Détecte si un texte contient des caractères Arabic Presentation Forms (FE70–FEFF),
     * signe que PDFBox a extrait le texte en ordre visuel (inversé).
     */
    private boolean estOrdreVisuelArabe(String s) {
        if (s == null) return false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '\uFE70' && c <= '\uFEFF') return true;
            if (c >= '\uFB50' && c <= '\uFDFF') return true;
        }
        return false;
    }

    /**
     * Corrige le texte arabe extrait en ordre visuel par PDFBox :
     * 1. Normalise les Presentation Forms (FE70–FEFF, FB50–FDFF) → Unicode canonique (0600–06FF)
     * 2. Inverse l'ordre des mots (texte RTL affiché LTR par PDFBox)
     * 3. Inverse les caractères dans chaque mot (caractères écrits en ordre inverse)
     */
    private String fixVisualOrderArabic(String s) {
        if (s == null || s.isBlank()) return s;
        if (!estOrdreVisuelArabe(s)) return s;

        // Étape 1 : NFKC normalise les Presentation Forms → formes canoniques Arabic
        String normalized = Normalizer.normalize(s, Normalizer.Form.NFKC);

        // Étape 2 : découper en tokens (mots arabes et espaces/ponctuation)
        // inverser l'ordre des tokens ET les caractères de chaque token arabe
        String[] tokens = normalized.split("(?<=\\s)(?=\\S)|(?<=\\S)(?=\\s)");
        StringBuilder result = new StringBuilder();

        // Inverser l'ordre des tokens
        for (int i = tokens.length - 1; i >= 0; i--) {
            String token = tokens[i];
            // Si le token est un mot arabe (contient des caractères arabes), inverser ses caractères
            boolean hasArabic = false;
            for (int j = 0; j < token.length(); j++) {
                char c = token.charAt(j);
                if (c >= '\u0600' && c <= '\u06FF') { hasArabic = true; break; }
            }
            if (hasArabic) {
                result.append(new StringBuilder(token).reverse());
            } else {
                result.append(token);
            }
        }

        return result.toString().replaceAll("\\s{2,}", " ").trim();
    }

    private String nettoyerTexteArabe(String t) {
        // Correction de l'ordre visuel AVANT tout autre traitement
        String tFixed = fixVisualOrderArabic(t);
        String s = tFixed
                .replaceAll("\\p{IsLatin}", " ")
                .replaceAll("[\\u200E\\u200F\\u202A-\\u202E]", " ")
                .replaceAll("(?i)\\b(Rouge|Jaune|Vert|Visuel|Simulation|En\\s+production)\\b", " ")
                .replaceAll("[\"'`´]+", " ")
                .replaceAll("[()\\[\\]{}]+", " ")
                .replaceAll("\\s*[:;/]+\\s*", " ")
                .replaceAll("\\s{2,}", " ")
                .trim();

        s = s.replaceAll(
                "^\\s*(الطريقة|الطريقه|الآلة|اآللة|الالة|الاله|الماكينة|الماكينه|المادة|الماده|البيئة|البيئه|العامل)\\s*[:\\-–—]*\\s*",
                "");
        s = s.replaceAll(
                "\\s*[:\\-–—]*\\s*(الطريقة|الطريقه|الآلة|اآللة|الالة|الاله|الماكينة|الماكينه|المادة|الماده|البيئة|البيئه|العامل)\\s*$",
                "");
        s = s.replaceAll("^[\\s،؛,.]+", "").replaceAll("[\\s،؛,.]+$", "");
        s = s.replaceAll("\\u2026+", " ");
        s = s.replace("القيس", "القياس");
        s = s.replace("فالش", "فلاش");
        s = normaliserOrdreArabe(s);
        s = s.replaceAll("\\s{2,}", " ").trim();

        return s;
    }

    private String normaliserOrdreArabe(String s) {
        if (s == null || s.isBlank()) {
            return s;
        }

        int idx = s.indexOf("مثل");
        if (idx < 0) {
            return s;
        }

        String before = s.substring(0, idx).trim();
        String after = s.substring(idx + "مثل".length()).trim();
        if (after.isEmpty()) {
            return s;
        }

        if (before.isEmpty()) {
            int verbIdx = indexOfFirstVerb(after);
            if (verbIdx > 0) {
                String list = after.substring(0, verbIdx).trim();
                String rest = after.substring(verbIdx).trim();
                if (!list.isEmpty() && !rest.isEmpty() && sembleListeArabe(list)) {
                    return rest + " مثل " + list;
                }
            }
            return s;
        }

        if (!contientVerbeArabe(before) && contientVerbeArabe(after) && sembleListeArabe(before)) {
            return after + " مثل " + before;
        }

        return s;
    }

    private int indexOfFirstVerb(String text) {
        int best = -1;
        for (String verb : AR_VERBS) {
            int i = text.indexOf(verb);
            if (i >= 0 && (best < 0 || i < best)) {
                best = i;
            }
        }
        return best;
    }

    private boolean contientVerbeArabe(String text) {
        for (String verb : AR_VERBS) {
            if (text.contains(verb)) {
                return true;
            }
        }
        return false;
    }

    private boolean sembleListeArabe(String text) {
        if (text.contains("،") || text.contains(",")) {
            return true;
        }
        int words = text.split("\\s+").length;
        return words <= 6;
    }

    private List<String> decouperSegmentsArabe(String ligne) {
        String t = ligne == null ? "" : ligne.trim();
        if (t.isEmpty()) {
            return Collections.emptyList();
        }
        if (!contientArabe(t)) {
            return Collections.singletonList(t);
        }

        SortedSet<Integer> cuts = new TreeSet<>();
        cuts.add(0);

        java.util.regex.Matcher cat = AR_CATEGORY_INLINE_PATTERN.matcher(t);
        while (cat.find()) {
            int idx = cat.start(1);
            if (idx > 0) {
                cuts.add(idx);
            }
        }

        if (cuts.size() == 1 && t.length() > 140) {
            java.util.regex.Matcher verb = AR_VERB_SPLIT_PATTERN.matcher(t);
            while (verb.find()) {
                int idx = verb.start(1);
                if (idx > 0) {
                    cuts.add(idx);
                }
            }
        }

        if (cuts.size() == 1) {
            return Collections.singletonList(t);
        }

        List<Integer> positions = new ArrayList<>(cuts);
        List<String> out = new ArrayList<>();
        for (int i = 0; i < positions.size(); i++) {
            int start = positions.get(i);
            int end = (i + 1 < positions.size()) ? positions.get(i + 1) : t.length();
            String part = t.substring(start, end).trim();
            if (!part.isEmpty()) {
                out.add(part);
            }
        }

        return out;
    }

    private List<String> splitBlocArabe(String text, int expectedCount) {
        if (text == null) {
            return Collections.emptyList();
        }
        String cleaned = text.replaceAll("\\s{2,}", " ").trim();
        if (cleaned.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> segments = splitByPattern(cleaned, AR_VERB_SPLIT_PATTERN);
        segments = filtrerSegmentsArabe(segments);
        segments = mergeSmallSegments(segments);

        if (expectedCount > 1 && segments.size() < expectedCount) {
            segments = refineByToken(segments, "وحدة القطع");
            segments = filtrerSegmentsArabe(segments);
            segments = mergeSmallSegments(segments);
        }
        if (expectedCount > 1 && segments.size() < expectedCount) {
            segments = refineByToken(segments, "نظام");
            segments = filtrerSegmentsArabe(segments);
            segments = mergeSmallSegments(segments);
        }

        if (segments.isEmpty()) {
            return Collections.singletonList(cleaned);
        }

        return segments;
    }

    private List<String> splitByPattern(String text, Pattern pattern) {
        SortedSet<Integer> cuts = new TreeSet<>();
        cuts.add(0);

        java.util.regex.Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            int idx = matcher.start(1);
            if (idx > 0) {
                cuts.add(idx);
            }
        }

        if (cuts.size() == 1) {
            return Collections.singletonList(text);
        }

        List<Integer> positions = new ArrayList<>(cuts);
        List<String> out = new ArrayList<>();
        for (int i = 0; i < positions.size(); i++) {
            int start = positions.get(i);
            int end = (i + 1 < positions.size()) ? positions.get(i + 1) : text.length();
            String part = text.substring(start, end).trim();
            if (!part.isEmpty()) {
                out.add(part);
            }
        }

        return out;
    }

    private List<String> refineByToken(List<String> segments, String token) {
        if (segments.isEmpty()) {
            return segments;
        }
        List<String> out = new ArrayList<>();
        for (String seg : segments) {
            if (seg == null) {
                continue;
            }
            String s = seg.trim();
            if (s.isEmpty()) {
                continue;
            }
            if (s.length() < 120 || !s.contains(token)) {
                out.add(s);
                continue;
            }
            List<Integer> cuts = new ArrayList<>();
            int idx = s.indexOf(token);
            while (idx > 0) {
                cuts.add(idx);
                idx = s.indexOf(token, idx + token.length());
            }
            if (cuts.isEmpty()) {
                out.add(s);
                continue;
            }
            int last = 0;
            for (int cut : cuts) {
                String part = s.substring(last, cut).trim();
                if (!part.isEmpty()) {
                    out.add(part);
                }
                last = cut;
            }
            String tail = s.substring(last).trim();
            if (!tail.isEmpty()) {
                out.add(tail);
            }
        }
        return out;
    }

    private List<String> mergeSmallSegments(List<String> segments) {
        List<String> out = new ArrayList<>();
        for (String seg : segments) {
            if (seg == null) {
                continue;
            }
            String s = seg.trim();
            if (s.isEmpty()) {
                continue;
            }
            boolean tooSmall = s.length() < 24 || s.split("\\s+").length <= 2;
            if (tooSmall && !out.isEmpty()) {
                out.set(out.size() - 1, (out.get(out.size() - 1) + " " + s).trim());
            } else {
                out.add(s);
            }
        }
        return out;
    }

    private List<String> filtrerSegmentsArabe(List<String> segments) {
        List<String> out = new ArrayList<>();
        for (String seg : segments) {
            if (seg == null) {
                continue;
            }
            String s = seg.trim();
            if (s.isEmpty()) {
                continue;
            }
            if (!contientArabe(s)) {
                continue;
            }
            if (!contientTexteArabeSignificatif(s)) {
                continue;
            }
            if (estBruitArabe(s)) {
                continue;
            }
            out.add(s);
        }
        return out;
    }

    private boolean contientTexteFrancaisSignificatif(String t) {
        if (t == null)
            return false;
        String latin = t.replaceAll("[^\\p{IsLatin}]", "");
        return latin.length() >= 4;
    }

    private boolean contientTexteArabeSignificatif(String t) {
        if (t == null)
            return false;
        String arabe = t.replaceAll("[^\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]", "");
        return arabe.length() >= 4;
    }

    private String retirerTexteArabe(String t) {
        return t
                .replaceAll("[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]+", " ")
                .replaceAll("\\s{2,}", " ")
                .trim();
    }

    private CritereRequest flush(CritereRequest c, StringBuilder buf,
            List<CritereRequest> liste) {
        if (c != null) {
            String fr = nettoyerLigneFr(buf.toString().replaceAll("\\s{2,}", " ").trim());
            if (fr.length() >= 3) {
                if (fr.length() <= 490) {
                    c.setNom(fr);
                } else {
                    int cut = fr.lastIndexOf(' ', 480);
                    c.setNom(fr.substring(0, cut > 30 ? cut : 480).trim());
                    c.setDescription(fr.substring(cut > 30 ? cut : 480).trim());
                }
                liste.add(c);
            }
        }
        return null;
    }

    // ── Phase 2a : Couleurs ───────────────────────────────────────────────────
    //
    // Les couleurs apparaissent en doublon FR+AR dans le PDF extrait :
    // "Jaune" / "أصفر" / "Jaune" / "أصفر" / "Rouge" / "أحمر" ...
    // On garde un sur deux (indices pairs = FR).

    private List<String> extraireCouleurs(String[] lignes) {
        List<String> toutes = new ArrayList<>();
        for (String ligne : lignes) {
            String t = ligne.trim();
            if (t.equalsIgnoreCase("Rouge") || t.equals("\u0623\u062d\u0645\u0631"))
                toutes.add("Rouge");
            else if (t.equalsIgnoreCase("Jaune") || t.equals("\u0623\u0635\u0641\u0631"))
                toutes.add("Jaune");
            else if (t.equalsIgnoreCase("Vert"))
                toutes.add("Vert");
        }
        // Dédoublonner : garder indices pairs (version FR)
        List<String> result = new ArrayList<>();
        for (int i = 0; i < toutes.size(); i += 2)
            result.add(toutes.get(i));
        return result;
    }

    // ── Phase 2b : Moyens de vérification ────────────────────────────────────
    //
    // RÈGLE CLÉ (validée sur USS et Coupe) :
    // "Visuel" sans espace trailing dans la ligne source → VISUEL seul
    // "Visuel " avec espace trailing, ou "Visuel /" → look-ahead Simulation →
    // SIMULATION
    // "Simulation" non consommée → SIMULATION
    // "En" + "production" → EN_PRODUCTION

    private List<String> extraireMoyens(String[] lignes) {
        List<String> result = new ArrayList<>();
        int i = 0;
        while (i < lignes.length) {
            String raw = lignes[i]; // ligne AVEC espace trailing
            String strip = raw.strip().toLowerCase();

            // "En" → "production" = EN_PRODUCTION
            if (strip.equals("en") || strip.equals("en ")) {
                boolean found = false;
                for (int k = 1; k <= 3 && i + k < lignes.length; k++) {
                    if (lignes[i + k].strip().toLowerCase().startsWith("production")) {
                        result.add("EN_PRODUCTION");
                        i = i + k + 1;
                        found = true;
                        break;
                    }
                }
                if (!found)
                    i++;
                continue;
            }

            // Visuel (seul ou avec / ou avec espace trailing)
            if (strip.startsWith("visuel") && strip.length() <= 12) {
                boolean pairedAvecSimulation = raw.endsWith(" ") // espace trailing
                        || raw.contains("/"); // "Visuel /"

                if (pairedAvecSimulation) {
                    // Look-ahead : trouver la prochaine ligne non-vide
                    int j = i + 1;
                    while (j < lignes.length && lignes[j].strip().isEmpty())
                        j++;
                    String nxt = j < lignes.length ? lignes[j].strip().toLowerCase() : "";
                    if (nxt.startsWith("simulation") && nxt.length() <= 12) {
                        result.add("SIMULATION");
                        i = j + 1; // consomme "Visuel" ET "Simulation"
                        continue;
                    }
                }
                // Visuel seul (pas d'espace, ou espace mais Simulation absente)
                result.add("VISUEL");
                i++;
                continue;
            }

            // Simulation seule (non consommée par le cas Visuel+Simulation)
            if (strip.startsWith("simulation") && strip.length() <= 12) {
                result.add("SIMULATION");
                i++;
                continue;
            }

            i++;
        }
        return result;
    }

    // ── Utilitaires ──────────────────────────────────────────────────────────

    private boolean estBruit(String t) {
        if (t.length() <= 1)
            return true;
        if (t.matches("^\\d{1,2}$"))
            return true;
        if (t.matches("^[\\(\\)/:,;.\\-\"'\u2026\u2022]+$"))
            return true;
        if (contientArabe(t) && t.replaceAll("[^\\u0600-\\u06FF]", "").length() < 3)
            return true;
        String[] bruits = {
                "IT TN 3 406", "annexe", "Page 1 sur 1", "Mois :", "Id", "Description",
                "Segment :", "Semaine :", "Drapeu LTPM", "Moyens/", "outils",
                "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
                "Matricule op\u00e9rateur", "CM / Chef de ligne", "Maintenance", "Qualit\u00e9",
                "Crit\u00e9res qualit\u00e9", "Crit\u00e9res Technique", "Crit\u00e9res S\u00e9curit\u00e9",
                "Mise \u00e0 jour par", "Validation chef", "Validation PPO", "Validation S\u00e9curit\u00e9",
                "Etat :", "- Mettre", "M: Matin", "S: Soir", "N: Nuit",
                "Machine en", "Marche (M)", "arr\u00eat (A)", "Plan d'action",
                "Garder l'", "syst\u00e8me de scannage avec", "brins."
        };
        for (String b : bruits)
            if (t.startsWith(b) || t.equals(b))
                return true;
        return false;
    }

    private boolean estMetadonneeIsolee(String t) {
        String tl = t.toLowerCase().strip();
        if (t.length() > 30)
            return false;
        return tl.equals("rouge") || tl.equals("jaune") || tl.equals("vert")
                || tl.equals("visuel") || tl.equals("visuel /") || tl.equals("visuel/")
                || tl.equals("simulation") || tl.equals("en production")
                || t.equals("M") || t.equals("A")
                || t.equals("\u0623\u062d\u0645\u0631") // أحمر
                || t.equals("\u0623\u0635\u0641\u0631"); // أصفر
    }

    private boolean contientArabe(String t) {
        return t.matches(".*[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF].*");
    }

    private String detecterCategorie(String t) {
        String l = t.toLowerCase();
        if (l.contains("m\u00e9thode") || l.contains("methode"))
            return "M\u00e9thode";
        if (l.contains("milieu"))
            return "Milieu";
        if (l.contains("mati\u00e8re") || l.contains("matiere"))
            return "Mati\u00e8re";
        if (l.contains("\u0153uvre") || l.contains("oeuvre") ||
                l.contains("\u0152uvre"))
            return "Main-d\u2019\u0153uvre";
        return "Machine";
    }

    private String extraireTexte(MultipartFile file, boolean sortByPosition) throws IOException {
        try (PDDocument doc = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(sortByPosition);
            stripper.setStartPage(1);
            stripper.setEndPage(doc.getNumberOfPages());
            return stripper.getText(doc);
        }
    }
}