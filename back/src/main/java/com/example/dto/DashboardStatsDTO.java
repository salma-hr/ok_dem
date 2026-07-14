package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsDTO {

    // ── Validation finale ─────────────────────────────────────────
    private Long   checklistsValidees;   // VALIDE_FINAL ce mois
    private String evolutionValidees;    // ex: "+12%"

    // ── Non-conformités ───────────────────────────────────────────
    private Long   nonConformites;       // checklists avec au moins 1 ROUGE
    private String evolutionNC;          // ex: "-8%"

    // ── En attente (total SOUMIS + VALIDE_N1 + VALIDE_N2) ────────
    private Long   enAttente;
    private String evolutionAttente;

    // ── Détail par niveau (pour affichage dashboard) ──────────────
    private Long   enAttenteN1;          // SOUMIS  → attente Chef de ligne
    private Long   enAttenteN2;          // VALIDE_N1 → attente Technicien
    private Long   enAttenteValidation;  // VALIDE_N2 → attente Agent Qualité

    // ── Taux de conformité ────────────────────────────────────────
    private Double tauxConformite;       // ex: 94.3
    private String evolutionTaux;        // ex: "+2.1%"

    // ── Total ─────────────────────────────────────────────────────
    private Long   totalChecklists;
}