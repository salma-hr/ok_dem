package com.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service de traduction automatique via LibreTranslate (Docker local).
 * <p>
 * LibreTranslate tourne sur : http://localhost:5000 (ou valeur de
 * libretranslate.url)
 * <p>
 * Langues gérées : fr → en via LibreTranslate, fr → de via LibreTranslate (si
 * dispo)
 * ou fallback local si l'allemand n'est pas supporté
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LibreTranslateService {

    private static final LinkedHashMap<String, String> GERMAN_FALLBACK_RULES = new LinkedHashMap<>();

    static {
        GERMAN_FALLBACK_RULES.put("qualité", "Qualität");
        GERMAN_FALLBACK_RULES.put("quality", "Qualität");
        GERMAN_FALLBACK_RULES.put("sécurité", "Sicherheit");
        GERMAN_FALLBACK_RULES.put("security", "Sicherheit");
        GERMAN_FALLBACK_RULES.put("technique", "Technik");
        GERMAN_FALLBACK_RULES.put("technical", "Technik");
        GERMAN_FALLBACK_RULES.put("vérifier", "überprüfen");
        GERMAN_FALLBACK_RULES.put("verifier", "überprüfen");
        GERMAN_FALLBACK_RULES.put("verify", "überprüfen");
        GERMAN_FALLBACK_RULES.put("check", "prüfen");
        GERMAN_FALLBACK_RULES.put("contrôler", "prüfen");
        GERMAN_FALLBACK_RULES.put("control", "prüfen");
        GERMAN_FALLBACK_RULES.put("présence", "Vorhandensein");
        GERMAN_FALLBACK_RULES.put("presence", "Vorhandensein");
        GERMAN_FALLBACK_RULES.put("absence", "Abwesenheit");
        GERMAN_FALLBACK_RULES.put("bon état", "guter Zustand");
        GERMAN_FALLBACK_RULES.put("bon etat", "guter Zustand");
        GERMAN_FALLBACK_RULES.put("good condition", "guter Zustand");
        GERMAN_FALLBACK_RULES.put("état", "Zustand");
        GERMAN_FALLBACK_RULES.put("etat", "Zustand");
        GERMAN_FALLBACK_RULES.put("condition", "Zustand");
        GERMAN_FALLBACK_RULES.put("machine", "Maschine");
        GERMAN_FALLBACK_RULES.put("operator", "Bediener");
        GERMAN_FALLBACK_RULES.put("opérateur", "Bediener");
        GERMAN_FALLBACK_RULES.put("poste", "Arbeitsplatz");
        GERMAN_FALLBACK_RULES.put("workstation", "Arbeitsplatz");
        GERMAN_FALLBACK_RULES.put("moyen", "Methode");
        GERMAN_FALLBACK_RULES.put("visuel", "visuell");
        GERMAN_FALLBACK_RULES.put("visual", "visuell");
        GERMAN_FALLBACK_RULES.put("simulation", "Simulation");
        GERMAN_FALLBACK_RULES.put("en production", "in Produktion");
        GERMAN_FALLBACK_RULES.put("in production", "in Produktion");
        GERMAN_FALLBACK_RULES.put("propreté", "Sauberkeit");
        GERMAN_FALLBACK_RULES.put("proprete", "Sauberkeit");
        GERMAN_FALLBACK_RULES.put("cleanliness", "Sauberkeit");
        GERMAN_FALLBACK_RULES.put("éclairage", "Beleuchtung");
        GERMAN_FALLBACK_RULES.put("eclairage", "Beleuchtung");
        GERMAN_FALLBACK_RULES.put("lighting", "Beleuchtung");
        GERMAN_FALLBACK_RULES.put("poussière", "Staub");
        GERMAN_FALLBACK_RULES.put("poussiere", "Staub");
        GERMAN_FALLBACK_RULES.put("dust", "Staub");
        GERMAN_FALLBACK_RULES.put("fuite", "Leck");
        GERMAN_FALLBACK_RULES.put("leak", "Leck");
        GERMAN_FALLBACK_RULES.put("graissage", "Schmierung");
        GERMAN_FALLBACK_RULES.put("lubrification", "Schmierung");
        GERMAN_FALLBACK_RULES.put("lubrication", "Schmierung");
        GERMAN_FALLBACK_RULES.put("serrage", "Anziehen");
        GERMAN_FALLBACK_RULES.put("tightening", "Anziehen");
        GERMAN_FALLBACK_RULES.put("réglage", "Einstellung");
        GERMAN_FALLBACK_RULES.put("reglage", "Einstellung");
        GERMAN_FALLBACK_RULES.put("setting", "Einstellung");
        GERMAN_FALLBACK_RULES.put("alignement", "Ausrichtung");
        GERMAN_FALLBACK_RULES.put("alignment", "Ausrichtung");
        GERMAN_FALLBACK_RULES.put("défaut", "Fehler");
        GERMAN_FALLBACK_RULES.put("defaut", "Fehler");
        GERMAN_FALLBACK_RULES.put("fault", "Fehler");
        GERMAN_FALLBACK_RULES.put("conforme", "konform");
        GERMAN_FALLBACK_RULES.put("non conforme", "nicht konform");
        GERMAN_FALLBACK_RULES.put("non-compliant", "nicht konform");
        GERMAN_FALLBACK_RULES.put("rouge", "Rot");
        GERMAN_FALLBACK_RULES.put("jaune", "Gelb");
        GERMAN_FALLBACK_RULES.put("vert", "Grün");
        GERMAN_FALLBACK_RULES.put("nettoyer", "reinigen");
        GERMAN_FALLBACK_RULES.put("clean", "reinigen");
        GERMAN_FALLBACK_RULES.put("ranger", "aufräumen");
        GERMAN_FALLBACK_RULES.put("tester", "testen");
        GERMAN_FALLBACK_RULES.put("test", "testen");
        GERMAN_FALLBACK_RULES.put("valider", "validieren");
        GERMAN_FALLBACK_RULES.put("validate", "validieren");
        GERMAN_FALLBACK_RULES.put("respecter", "einhalten");
        GERMAN_FALLBACK_RULES.put("assurer", "sicherstellen");
        GERMAN_FALLBACK_RULES.put("améliorer", "verbessern");
        GERMAN_FALLBACK_RULES.put("ameliorer", "verbessern");
    }

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${libretranslate.url:http://localhost:5000}")
    private String baseUrl;

    @Value("${libretranslate.api-key:}")
    private String apiKey; // vide si pas de clé (mode local sans auth)

    @Value("${translation.de.provider:auto}")
    private String germanProvider;

    @Value("${deepl.url:https://api-free.deepl.com/v2/translate}")
    private String deeplUrl;

    @Value("${deepl.api-key:}")
    private String deeplApiKey;

    private static final long LANG_SUPPORT_CACHE_MS = 5 * 60 * 1000;
    private volatile Boolean germanSupported;
    private volatile long germanSupportCheckedAtMs;

    /**
     * Traduit un texte depuis une langue source vers une langue cible.
     *
     * @param text       Texte à traduire (non null, non vide)
     * @param sourceLang Code langue source, ex. "fr"
     * @param targetLang Code langue cible, ex. "en" ou "de"
     * @return Texte traduit, ou texte original en cas d'échec
     */
    public String translate(String text, String sourceLang, String targetLang) {
        if (text == null || text.isBlank())
            return text;

        try {
            String url = baseUrl + "/translate";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Corps de la requête LibreTranslate
            Map<String, String> body = apiKey != null && !apiKey.isBlank()
                    ? Map.of("q", text, "source", sourceLang, "target", targetLang, "api_key", apiKey)
                    : Map.of("q", text, "source", sourceLang, "target", targetLang);

            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode json = objectMapper.readTree(response.getBody());
                String translated = json.path("translatedText").asText(null);
                if (translated != null && !translated.isBlank()) {
                    log.debug("Traduction [{} → {}] : «{}» → «{}»", sourceLang, targetLang, text, translated);
                    return translated;
                }
            }
        } catch (Exception e) {
            log.warn("LibreTranslate indisponible [{} → {}] : {} — texte original conservé",
                    sourceLang, targetLang, e.getMessage());
        }

        // En cas d'échec : retourner le texte original plutôt que null
        return text;
    }

    /**
     * Traduit vers l'anglais (fr → en).
     */
    public String toEnglish(String text) {
        return translate(text, "fr", "en");
    }

    /**
     * Traduit vers l'allemand (fr → de).
     */
    public String toGerman(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }

        String trimmed = text.trim();
        String provider = germanProvider == null ? "auto" : germanProvider.trim().toLowerCase(Locale.ROOT);

        if ("fallback".equals(provider)) {
            return applyGermanFallback(trimmed);
        }

        if ("deepl".equals(provider) || "auto".equals(provider)) {
            String deepl = translateWithDeepL(trimmed, "FR");
            if (isUsableTranslation(deepl, trimmed)) {
                return deepl;
            }
        }

        boolean tryLibre = "libretranslate".equals(provider) || "auto".equals(provider);
        if (tryLibre && isLibreTranslateGermanSupported()) {
            String direct = translate(trimmed, "auto", "de");
            if (isUsableTranslation(direct, trimmed)) {
                return direct;
            }
            if ("libretranslate".equals(provider)) {
                return trimmed;
            }
        }

        if ("deepl".equals(provider)) {
            return trimmed;
        }

        String english = translate(trimmed, "auto", "en");
        String candidate = isUsableTranslation(english, trimmed) ? english : trimmed;

        String fallback = applyGermanFallback(candidate);
        if (isUsableTranslation(fallback, trimmed)) {
            return fallback;
        }

        return candidate;
    }

    private String translateWithDeepL(String text, String sourceLang) {
        if (text == null || text.isBlank() || deeplApiKey == null || deeplApiKey.isBlank()) {
            return null;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.set("Authorization", "DeepL-Auth-Key " + deeplApiKey.trim());

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("text", text);
            body.add("target_lang", "DE");
            if (sourceLang != null && !sourceLang.isBlank()) {
                body.add("source_lang", sourceLang.trim().toUpperCase(Locale.ROOT));
            }

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(deeplUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode json = objectMapper.readTree(response.getBody());
                JsonNode translations = json.path("translations");
                if (translations.isArray() && translations.size() > 0) {
                    String translated = translations.get(0).path("text").asText(null);
                    if (translated != null && !translated.isBlank()) {
                        return translated;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("DeepL indisponible [fr → de] : {} — fallback appliqué", e.getMessage());
        }

        return null;
    }

    private boolean isLibreTranslateGermanSupported() {
        long now = System.currentTimeMillis();
        if (germanSupported != null && (now - germanSupportCheckedAtMs) < LANG_SUPPORT_CACHE_MS) {
            return germanSupported;
        }

        boolean supported = false;
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(baseUrl + "/languages", String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode languages = objectMapper.readTree(response.getBody());
                if (languages.isArray()) {
                    for (JsonNode node : languages) {
                        if ("de".equalsIgnoreCase(node.path("code").asText())) {
                            supported = true;
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Impossible de vérifier les langues LibreTranslate : {}", e.getMessage());
        }

        germanSupported = supported;
        germanSupportCheckedAtMs = now;
        return supported;
    }

    private boolean isUsableTranslation(String translated, String original) {
        if (translated == null || translated.isBlank()) {
            return false;
        }
        if (original == null || original.isBlank()) {
            return true;
        }
        return !translated.trim().equalsIgnoreCase(original.trim());
    }

    private String applyGermanFallback(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }

        String result = text;
        for (Map.Entry<String, String> entry : GERMAN_FALLBACK_RULES.entrySet()) {
            result = replaceIgnoreCase(result, entry.getKey(), entry.getValue());
        }

        return result
                .replaceAll("\\s{2,}", " ")
                .replaceAll("\\s+([,.;:!?])", "$1")
                .trim();
    }

    private String replaceIgnoreCase(String text, String source, String replacement) {
        if (text == null || text.isBlank() || source == null || source.isBlank()) {
            return text;
        }

        Pattern pattern = Pattern.compile(Pattern.quote(source), Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
        return pattern.matcher(text).replaceAll(Matcher.quoteReplacement(replacement));
    }

    /**
     * Vérifie que LibreTranslate est accessible.
     *
     * @return true si le service répond
     */
    public boolean isAvailable() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(baseUrl + "/languages", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("LibreTranslate inaccessible à {} : {}", baseUrl, e.getMessage());
            return false;
        }
    }
}
