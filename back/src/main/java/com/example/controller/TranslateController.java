package com.example.controller;

import com.example.service.LibreTranslateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Proxy REST → LibreTranslate.
 * Le frontend appelle /api/translate au lieu d'appeler
 * LibreTranslate directement (pas accessible depuis le browser).
 *
 * POST /api/translate
 * Body : { "text": "...", "source": "fr", "target": "en" }
 * Réponse : { "translatedText": "..." }
 */
@RestController
@RequestMapping("/api/translate")
@RequiredArgsConstructor
@Tag(name = "Traduction", description = "Proxy LibreTranslate local (Docker)")
public class TranslateController {

    private final LibreTranslateService libreTranslateService;

    @Operation(summary = "Traduire un texte via LibreTranslate")
    @PostMapping
    public ResponseEntity<Map<String, String>> translate(
            @RequestBody Map<String, String> body) {

        String text = body.getOrDefault("text", "");
        String source = body.getOrDefault("source", "fr");
        String target = body.getOrDefault("target", "en");

        if (text.isBlank()) {
            return ResponseEntity.ok(Map.of("translatedText", ""));
        }

        String result;
        if ("de".equalsIgnoreCase(target)) {
            result = libreTranslateService.toGerman(text);
        } else if ("en".equalsIgnoreCase(target)) {
            result = libreTranslateService.toEnglish(text);
        } else if ("fr".equalsIgnoreCase(target) || target.equalsIgnoreCase(source)) {
            result = text;
        } else {
            result = libreTranslateService.translate(text, source, target);
        }
        return ResponseEntity.ok(Map.of("translatedText", result));
    }

    @Operation(summary = "Vérifier si LibreTranslate est disponible")
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        boolean available = libreTranslateService.isAvailable();
        return ResponseEntity.ok(Map.of(
                "available", available,
                "message", available
                        ? "LibreTranslate opérationnel"
                        : "LibreTranslate inaccessible — vérifiez Docker"));
    }
}