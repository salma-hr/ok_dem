package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

/**
 * Plan d'action correctif lié à une checklist OK Démarrage.
 *
 * Cycle de vie selon la couleur du critère :
 *
 *   ROUGE : OUVERT → EN_COURS → EN_ATTENTE_VALIDATION_AQ → VALIDE_AQ (= CLOS)
 *           CL crée · Technicien traite & clôture → statut EN_ATTENTE_VALIDATION_AQ
 *           Agent Qualité valide → statut VALIDE_AQ
 *
 *   JAUNE : OUVERT → EN_COURS → CLOS
 *           CL crée · Technicien traite & clôture directement
 *           Pas de validation AQ requise
 */
@Entity
@Table(name = "plan_action", indexes = {
        @Index(name = "idx_pa_checklist", columnList = "ok_demarrage_id"),
        @Index(name = "idx_pa_statut", columnList = "statut"),
        @Index(name = "idx_pa_responsable", columnList = "responsable_matricule")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Checklist liée ───────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ok_demarrage_id", nullable = false)
    @NotFound(action = NotFoundAction.IGNORE)
    private OkDemarrage okDemarrage;

    // ── Description de l'action à mener ─────────────────────────
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    // ── Responsable de l'action ──────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responsable_id")
    private Utilisateur responsable;

    @Column(name = "responsable_matricule", length = 50)
    private String responsableMatricule;

    @Column(name = "responsable_nom", length = 100)
    private String responsableNom;

    @Column(name = "responsable_autre", length = 255)
    private String responsableAutre;

    // ── Couleur du critère source (détermine le workflow) ────────
    // ROUGE → validation AQ requise après clôture technicien
    // JAUNE → clôture technicien suffit (fin du workflow)
    @Column(name = "couleur_critere", length = 10)
    private String couleurCritere; // "ROUGE" | "JAUNE" | null (traité comme JAUNE)

    // ── Validation Agent Qualité (plans ROUGE uniquement) ────────
    @Column(name = "valide_aq_le")
    private LocalDateTime valideAqLe;

    @Column(name = "valide_aq_par_matricule", length = 50)
    private String valideAqParMatricule;

    @Column(name = "commentaire_validation_aq", columnDefinition = "TEXT")
    private String commentaireValidationAq;

    // ── Échéance ─────────────────────────────────────────────────
    @Column(name = "date_echeance")
    private LocalDate dateEcheance;

    // ── Statut ───────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Statut statut = Statut.OUVERT;

    // ── Priorite ────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "priorite", length = 20)
    @Builder.Default
    private Priorite priorite = Priorite.NORMALE;

    // ── Traçabilité ──────────────────────────────────────────────
    @Column(name = "cree_le", nullable = false, updatable = false)
    private LocalDateTime creeLe;

    @Column(name = "cree_par_matricule", length = 50)
    private String creeParMatricule;

    @Column(name = "clos_le")
    private LocalDateTime closLe;

    @Column(name = "commentaire_cloture", columnDefinition = "TEXT")
    private String commentaireCloture;

    @PrePersist
    void onCreate() {
        if (creeLe == null)
            creeLe = LocalDateTime.now();
        if (statut == null)
            statut = Statut.OUVERT;
    }

    public enum Statut {
        OUVERT,
        EN_COURS,
        /** Technicien a clôturé, en attente de validation Agent Qualité (critère ROUGE uniquement) */
        EN_ATTENTE_VALIDATION_AQ,
        /** Agent Qualité a validé le traitement (critère ROUGE) — état terminal */
        VALIDE_AQ,
        /** Clôture directe par technicien (critère JAUNE) — état terminal */
        CLOS
    }

    public enum Priorite {
        CRITIQUE,
        HAUTE,
        NORMALE
    }
}