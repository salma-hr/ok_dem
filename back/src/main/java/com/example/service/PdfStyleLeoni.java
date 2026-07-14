package com.example.service;

import java.awt.Color;

/**
 * Palettes de couleurs et styles pour les PDFs — Style Professionnel LEONI
 * Philosophie: Minimaliste, professionnel, peu de couleurs, accent gris/noir
 */
public class PdfStyleLeoni {

    // ── Couleurs principales Leoni ──────────────────────────────────────
    public static final Color LEONI_DARK_GRAY = new Color(45, 50, 55);        // Gris très foncé (presque noir)
    public static final Color LEONI_MEDIUM_GRAY = new Color(100, 105, 110);   // Gris moyen
    public static final Color LEONI_LIGHT_GRAY = new Color(200, 205, 210);    // Gris clair
    public static final Color LEONI_PALE_GRAY = new Color(240, 242, 245);     // Gris très pâle (background)
    public static final Color LEONI_WHITE = new Color(255, 255, 255);         // Blanc
    public static final Color LEONI_BLACK = new Color(0, 0, 0);               // Noir

    // ── Couleurs d'accent (minimalistes) ───────────────────────────────
    public static final Color ACCENT_BLUE = new Color(51, 102, 153);         // Bleu professionnel
    public static final Color ACCENT_RED = new Color(204, 51, 51);           // Rouge (pour critères rouge)
    public static final Color ACCENT_YELLOW = new Color(153, 102, 51);       // Ocre (pour critères jaune)
    public static final Color ACCENT_GREEN = new Color(51, 102, 51);         // Vert (pour critères vert)

    // ── Couleurs pour les statuts ──────────────────────────────────────
    public static final Color STATUS_SOUMIS = new Color(100, 120, 150);       // Bleu
    public static final Color STATUS_VALIDE = new Color(70, 120, 70);         // Vert foncé
    public static final Color STATUS_REJETE = new Color(180, 60, 60);         // Rouge
    public static final Color STATUS_EN_COURS = new Color(180, 140, 40);      // Orange

    // ── Éléments de design ─────────────────────────────────────────────
    public static final class Design {
        public static final float BORDER_THICKNESS = 0.75f;
        public static final float HEADER_HEIGHT = 70f;
        public static final float FOOTER_HEIGHT = 35f;
        public static final float MARGIN = 45f;
        public static final float SECTION_SPACING = 14f;
        public static final float ROW_PADDING = 4f;
        public static final float HEADER_ROW_HEIGHT = 24f;

        // Police sizes
        public static final float FONT_TITLE = 16f;
        public static final float FONT_SUBTITLE = 12f;
        public static final float FONT_HEADER = 11f;
        public static final float FONT_HEADER_TABLE = 9.5f;
        public static final float FONT_ROW = 9f;
        public static final float FONT_SMALL = 8f;
        public static final float FONT_FOOTER = 8f;
    }

    // ── Helpers pour les couleurs ──────────────────────────────────────
    public static Color getStatusColor(String status) {
        if (status == null) return LEONI_MEDIUM_GRAY;
        return switch (status.toUpperCase()) {
            case "SOUMIS" -> STATUS_SOUMIS;
            case "VALIDE_N1", "VALIDE_N2", "VALIDE_FINAL" -> STATUS_VALIDE;
            case "REJETE" -> STATUS_REJETE;
            case "EN_COURS" -> STATUS_EN_COURS;
            default -> LEONI_MEDIUM_GRAY;
        };
    }

    public static Color getCritereColor(String couleur) {
        if (couleur == null) return LEONI_LIGHT_GRAY;
        return switch (couleur.toLowerCase()) {
            case "rouge" -> ACCENT_RED;
            case "jaune" -> ACCENT_YELLOW;
            case "vert" -> ACCENT_GREEN;
            default -> LEONI_LIGHT_GRAY;
        };
    }

    public static Color getHeaderBackgroundColor() {
        return LEONI_PALE_GRAY;
    }

    public static Color getHeaderBorderColor() {
        return LEONI_LIGHT_GRAY;
    }

    public static Color getTableHeaderBgColor() {
        return LEONI_DARK_GRAY;
    }

    public static Color getTableHeaderTextColor() {
        return LEONI_WHITE;
    }

    public static Color getTableRowAlternateColor() {
        return new Color(248, 249, 251); // Très léger gris
    }

    public static Color getTableBorderColor() {
        return LEONI_LIGHT_GRAY;
    }

    public static Color getTableTextColor() {
        return LEONI_DARK_GRAY;
    }

    public static Color getSectionTitleColor() {
        return LEONI_DARK_GRAY;
    }

    public static Color getSectionLineColor() {
        return ACCENT_BLUE;
    }

    public static Color getStatusBadgeColor(String status) {
        Color base = getStatusColor(status);
        // Retourner une version plus claire pour badge background
        return new Color(
            Math.min(255, base.getRed() + 30),
            Math.min(255, base.getGreen() + 30),
            Math.min(255, base.getBlue() + 30)
        );
    }

    public static Color getFooterBorderColor() {
        return LEONI_LIGHT_GRAY;
    }

    public static Color getFooterTextColor() {
        return LEONI_MEDIUM_GRAY;
    }
}
