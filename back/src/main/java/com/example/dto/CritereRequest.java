package com.example.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.example.entity.Critere;
import lombok.Data;

/**
 * Request CRITÈRE — tous les champs FR/AR + image
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CritereRequest {

    // ── Textes français (obligatoire) ────────────────────────────
    private String nom;
    private String description;

    // ── Textes arabe (optionnel) ─────────────────────────────────
    private String nomAr;
    private String descriptionAr;

    // ── Textes anglais (auto-traduit via LibreTranslate) ─────────
    private String nomEn;
    private String descriptionEn;

    // ── Textes allemand (auto-traduit via LibreTranslate) ────────
    private String nomDe;
    private String descriptionDe;

    // ── Métadonnées ──────────────────────────────────────────────
    private Critere.TypeCritere type;
    private String couleur; // Rouge, Jaune, Vert
    private String moyenVerification; // VISUEL, SIMULATION, EN_PRODUCTION
    private String categorie; // Machine, Méthode, Milieu
    private String image; // URL locale/externe (pas de base64)

    // ── Relation ─────────────────────────────────────────────────
    private Long processusId;
}