package com.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Service Groq — génère automatiquement la description d'un plan d'action
 * à partir du nom et du type d'un critère non-conforme.
 *
 * Modèle utilisé : llama3-8b-8192 (gratuit, rapide)
 * Doc : https://console.groq.com/docs/openai
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GroqService {

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}")
    private String apiUrl;

    @Value("${groq.model:llama-3.1-8b-instant}")
    private String model;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Génère une description d'action corrective pour un critère non-conforme.
     *
     * @param critereNom  Nom du critère (ex: "Pression huile moteur")
     * @param critereType Type du critère : SECURITE, QUALITE, TECHNIQUE
     * @param description Description existante du critère (peut être null)
     * @return Description générée (action corrective à mener)
     */
    public String genererDescriptionPlanAction(String critereNom,
                                                String critereType,
                                                String description) {
        String prompt = buildPrompt(critereNom, critereType, description);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> body = Map.of(
                "model", model,
                "max_tokens", 200,
                "temperature", 0.4,
                "messages", List.of(
                    Map.of("role", "system", "content",
                        "Tu es un expert en maintenance industrielle. " +
                        "Réponds uniquement en français. " +
                        "Génère une action corrective courte, précise et actionnable (2-3 phrases maximum). " +
                        "Ne donne pas d'explication, uniquement l'action à effectuer."),
                    Map.of("role", "user", "content", prompt)
                )
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root    = objectMapper.readTree(response.getBody());
                JsonNode content = root.path("choices").path(0).path("message").path("content");
                if (!content.isMissingNode()) {
                    return content.asText().trim();
                }
            }

            log.warn("Groq: réponse inattendue {}", response.getStatusCode());
            return fallbackDescription(critereNom, critereType);

        } catch (Exception e) {
            log.error("Groq API error: {}", e.getMessage());
            return fallbackDescription(critereNom, critereType);
        }
    }

    /**
     * Répond à une question métier en s'appuyant sur un contexte JSON fourni par le backend.
     * Le modèle doit rester concis et ne pas inventer de données en dehors du contexte.
     */
    public String answerQuestion(String question, String contextJson) {
        String safeQuestion = question != null ? question.trim() : "";
        String safeContext = contextJson != null ? contextJson : "{}";

        if (safeQuestion.isBlank()) {
            return "Posez une question sur les alertes, les opérateurs ou les checklists.";
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

                String systemPrompt =
                    "Tu es un assistant qualité industriel intégré à une application OK Démarrage. " +
                    "Réponds uniquement en français, de manière courte, claire et exacte. " +
                    "N'invente jamais de données: utilise uniquement le contexte JSON fourni. " +
                    "Si le contexte ne permet pas de répondre, dis-le explicitement et indique quelle information manque. " +
                    "Réponds STRICTEMENT par un JSON valide (aucun texte hors-JSON) avec les champs suivants :\n" +
                    "- answer: chaîne courte, synthèse de la réponse destinée à l'utilisateur.\n" +
                    "- operatorName: nom de l'opérateur concerné ou null.\n" +
                    "- operatorAlerts: nombre d'alertes (nombre) ou null.\n" +
                    "- notes: informations complémentaires courtes ou null.\n" +
                    "Ne fournis aucun commentaire hors de cet objet JSON.";

                String userPrompt =
                    "Question utilisateur:\n" + safeQuestion +
                    "\n\nContexte JSON:\n" + safeContext +
                    "\n\nRéponse attendue (objet JSON) :";

            Map<String, Object> body = Map.of(
                    "model", model,
                    "max_tokens", 220,
                    "temperature", 0.2,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode content = root.path("choices").path(0).path("message").path("content");
                if (!content.isMissingNode()) {
                    String text = content.asText().trim();
                    try {
                        JsonNode parsed = objectMapper.readTree(text);
                        return objectMapper.writeValueAsString(parsed);
                    } catch (Exception e) {
                        // fallback to raw text if model didn't return strict JSON
                        log.warn("Groq assistant: réponse non-JSON reçue, renvoyée brute");
                        return text;
                    }
                }
            }

            log.warn("Groq assistant: réponse inattendue {}", response.getStatusCode());
            return "Je n'ai pas pu générer une réponse fiable pour le moment.";
        } catch (Exception e) {
            log.error("Groq assistant API error: {}", e.getMessage());
            return "Le chatbot est momentanément indisponible. Réessayez dans quelques instants.";
        }
    }

    // ── Prompt ────────────────────────────────────────────────────────────────

    private String buildPrompt(String critereNom, String critereType, String description) {
        StringBuilder sb = new StringBuilder();
        sb.append("Critère non-conforme détecté lors d'un OK Démarrage industriel.\n");
        sb.append("Critère : ").append(critereNom).append("\n");
        sb.append("Type : ").append(critereType).append("\n");
        if (description != null && !description.isBlank()) {
            sb.append("Description : ").append(description).append("\n");
        }
        sb.append("\nQuelle action corrective le technicien doit-il effectuer ?");
        return sb.toString();
    }

    // ── Fallback si Groq est inaccessible ────────────────────────────────────

    private String fallbackDescription(String critereNom, String critereType) {
        return switch (critereType != null ? critereType.toUpperCase() : "") {
            case "SECURITE"  -> "Arrêter immédiatement la machine et sécuriser la zone. Vérifier et corriger : " + critereNom + ". Informer le responsable avant reprise.";
            case "QUALITE"   -> "Contrôler et ajuster le paramètre non-conforme : " + critereNom + ". Documenter les mesures correctives effectuées.";
            case "TECHNIQUE" -> "Effectuer un diagnostic technique sur : " + critereNom + ". Réaliser la maintenance corrective nécessaire.";
            default          -> "Analyser et corriger la non-conformité détectée : " + critereNom + ".";
        };
    }
}