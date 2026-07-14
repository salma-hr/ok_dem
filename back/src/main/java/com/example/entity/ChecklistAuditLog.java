package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Audit log for checklist actions.
 * One row per action (submission, validation, rejection, plan action events).
 */
@Entity
@Table(name = "checklist_audit_log", indexes = {
        @Index(name = "idx_chk_audit_checklist", columnList = "ok_demarrage_id"),
        @Index(name = "idx_chk_audit_date", columnList = "date_action"),
        @Index(name = "idx_chk_audit_action", columnList = "action")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Checklist reference
    @Column(name = "ok_demarrage_id", nullable = false)
    private Long checklistId;

    @Column(name = "machine_nom", length = 120)
    private String machineNom;

    @Column(name = "processus_nom", length = 120)
    private String processusNom;

    // Who
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    @Column(name = "matricule", length = 50)
    private String matricule;

    // When
    @Column(name = "date_action", nullable = false)
    private LocalDateTime dateAction;

    // What
    @Enumerated(EnumType.STRING)
    @Column(name = "action", length = 30, nullable = false)
    private Action action;

    public enum Action {
        SOUMISSION,
        VALIDATION_N1,
        VALIDATION_N2,
        VALIDATION_FINALE,
        REJET,
        PLAN_ACTION_CREE,
        PLAN_ACTION_EN_COURS,
        PLAN_ACTION_CLOTURE,
        PLAN_ACTION_VALIDE_AQ,
        PLAN_ACTION_SUPPRIME,
        SUPPRESSION
    }

    @Column(name = "statut_avant", length = 30)
    private String statutAvant;

    @Column(name = "statut_apres", length = 30)
    private String statutApres;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "plan_action_id")
    private Long planActionId;
}