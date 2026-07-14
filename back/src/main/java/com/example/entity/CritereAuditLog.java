package com.example.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Audit log — enregistre chaque création / modification / suppression d'un critère.
 * Une ligne par action. L'image (base64) est exclue pour éviter de gonfler la table.
 */
@Entity
@Table(name = "critere_audit_log", indexes = {
    @Index(name = "idx_audit_critere", columnList = "critere_id"),
    @Index(name = "idx_audit_user",    columnList = "utilisateur_id"),
    @Index(name = "idx_audit_date",    columnList = "date_action")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CritereAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Quel critère ? ───────────────────────────────────────────
    @Column(name = "critere_id", nullable = false)
    private Long critereId;

    /** Snapshot du nom FR au moment de l'action (utile si critère supprimé ensuite) */
    @Column(name = "critere_nom", length = 500)
    private String critereNom;

    // ── Qui ? ────────────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id")
    private Utilisateur utilisateur;

    /** Matricule conservé en dur pour rester lisible même si l'utilisateur est supprimé */
    @Column(name = "matricule", length = 50)
    private String matricule;

    // ── Quand ? ──────────────────────────────────────────────────
    @Column(name = "date_action", nullable = false)
    private LocalDateTime dateAction;

    // ── Quelle action ? ──────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "action", length = 20, nullable = false)
    private Action action;

    public enum Action {
        CREATION,
        MODIFICATION,
        SUPPRESSION
    }

    // ── Détail des changements (format "champ: avant → après") ──
    /**
     * Stocke un diff lisible des champs modifiés.
     * Exemple :
     *   "nom: Vérif. soudure → Vérif. soudure connecteur\n
     *    type: QUALITE → SECURITE"
     *
     * Vide pour CREATION et SUPPRESSION.
     */
    @Column(name = "changements", columnDefinition = "TEXT")
    private String changements;

    // ── Snapshot JSON léger de l'état AVANT (sans image) ─────────
    @Column(name = "snapshot_avant", columnDefinition = "TEXT")
    private String snapshotAvant;

    // ── Snapshot JSON léger de l'état APRÈS (sans image) ─────────
    @Column(name = "snapshot_apres", columnDefinition = "TEXT")
    private String snapshotApres;
}