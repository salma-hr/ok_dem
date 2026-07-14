package com.example.dto;

import com.example.entity.Critere;
import lombok.Data;

/**
 * DTO complet — tous les champs FR/AR + métadonnées
 */
@Data
public class CritereDTO {
    private Long id;

    // ── Textes français ──────────────────────────────────────────
    private String nom;
    private String description;

    // ── Textes arabe ─────────────────────────────────────────────
    private String nomAr;
    private String descriptionAr;

    // ── Textes anglais ───────────────────────────────────────────
    private String nomEn;
    private String descriptionEn;

    // ── Textes allemand ──────────────────────────────────────────
    private String nomDe;
    private String descriptionDe;

    // ── Métadonnées ──────────────────────────────────────────────
    private Critere.TypeCritere type;
    private String couleur; // Rouge, Jaune, Vert
    private String moyenVerification; // VISUEL, SIMULATION, EN_PRODUCTION
    private String categorie; // Machine, Méthode, Milieu
    private String image; // URL locale/externe
    private String ussVariant; // USS, USS_CONTACT, ou null

    // ── Relation ─────────────────────────────────────────────────
    private Long processusId;
    private String processusNom;

}