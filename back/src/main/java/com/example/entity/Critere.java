package com.example.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Entité CRITÈRE — FR + AR + métadonnées + image
 */
@Entity
@Table(name = "criteres")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Critere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Textes français ──────────────────────────────────────────
    @Column(nullable = false, length = 500)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    // ── Textes arabe ─────────────────────────────────────────────
    @Column(name = "nom_ar", length = 500)
    private String nomAr;

    @Column(name = "description_ar", columnDefinition = "TEXT")
    private String descriptionAr;

    // ── Textes anglais (saisie manuelle) ─────────
    @Column(name = "nom_en", length = 500)
    private String nomEn;

    @Column(name = "description_en", columnDefinition = "TEXT")
    private String descriptionEn;

    // ── Textes allemand (saisie manuelle) ────────
    @Column(name = "nom_de", length = 500)
    private String nomDe;

    @Column(name = "description_de", columnDefinition = "TEXT")
    private String descriptionDe;

    // ── Métadonnées ──────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private TypeCritere type;

    @Column(length = 20)
    private String couleur; // Rouge, Jaune, Vert

    @Column(name = "moyen_verification", length = 50)
    private String moyenVerification; // VISUEL, SIMULATION, EN_PRODUCTION

    @Column(length = 50)
    private String categorie; // Machine, Méthode, Milieu

    /**
     * Image de référence stockée en URL locale ou externe.
     */
    @Column(name = "image", columnDefinition = "TEXT")
    private String image;

    @Column(name = "actif", nullable = false)
    private boolean actif = true;

    /**
     * Variante USS : "USS" (standard), "USS_CONTACT" (sur contact), ou NULL (applicable aux deux)
     */
    @Column(name = "uss_variant", length = 50)
    private String ussVariant;

    // ── Relation ─────────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processus_id")
    private Processus processus;

    // ── Enum type ────────────────────────────────────────────────
    public enum TypeCritere {
        QUALITE, TECHNIQUE, SECURITE
    }

    // ── Helpers ──────────────────────────────────────────────────
    public String getNom(String langue) {
        if ("ar".equalsIgnoreCase(langue) && nomAr != null) return nomAr;
        if ("en".equalsIgnoreCase(langue) && nomEn != null) return nomEn;
        if ("de".equalsIgnoreCase(langue) && nomDe != null) return nomDe;
        return nom;
    }

    public String getDescription(String langue) {
        if ("ar".equalsIgnoreCase(langue) && descriptionAr != null) return descriptionAr;
        if ("en".equalsIgnoreCase(langue) && descriptionEn != null) return descriptionEn;
        if ("de".equalsIgnoreCase(langue) && descriptionDe != null) return descriptionDe;
        return description;
    }

    public boolean hasArabicTranslation() {
        return nomAr != null && !nomAr.trim().isEmpty();
    }

    public boolean hasEnglishTranslation() {
        return nomEn != null && !nomEn.trim().isEmpty();
    }

    public boolean hasGermanTranslation() {
        return nomDe != null && !nomDe.trim().isEmpty();
    }

    public int getPriorite() {
        if (couleur == null)
            return 4;
        return switch (couleur.toLowerCase()) {
            case "rouge" -> 1;
            case "jaune" -> 2;
            case "vert" -> 3;
            default -> 4;
        };
    }
}