package com.example.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "ok_demarrage")
@Getter
@Setter
@ToString(exclude = "reponses")
public class OkDemarrage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Session session = Session.M;

    /**
     * Flux de validation en 3 niveaux :
     *
     * SOUMIS ──► VALIDE_N1 ──► VALIDE_N2 ──► VALIDE_FINAL
     * (opérateur) (chef ligne) (N1 + N2 faits) (agent qualité)
     *
     * N1 (chef de ligne) et N2 (technicien) peuvent etre valides en parallele.
     * Le statut represente l'etape atteinte dans le flux.
     *
     * REJETE possible a tout moment par chef ligne, technicien ou agent qualite.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.EN_COURS;

    // ── Niveau 1 : Chef de ligne ─────────────────────────────────
    @Column(name = "date_validation_n1")
    private LocalDateTime dateValidationN1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_n1_par_id")
    private Utilisateur valideN1Par;

    // ── Niveau 2 : Technicien ────────────────────────────────────
    @Column(name = "date_validation_n2")
    private LocalDateTime dateValidationN2;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_n2_par_id")
    private Utilisateur valideN2Par;

    // ── Niveau 3 : Agent Qualité (finale) ────────────────────────
    @Column(name = "date_validation_finale")
    private LocalDateTime dateValidationFinale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "valide_final_par_id")
    private Utilisateur valideParFinal;

    // ── Rejet ────────────────────────────────────────────────────
    @Column(name = "motif_rejet", columnDefinition = "TEXT")
    private String motifRejet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rejete_par_id")
    private Utilisateur rejetePar;

    @Column(name = "date_rejet")
    private LocalDateTime dateRejet;

    // ── Relations métier ─────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "machine_id", nullable = true)
    private Machine machine;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operateur_id", nullable = false)
    private Utilisateur operateur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id")
    private Site site;

    @OneToMany(mappedBy = "okDemarrage", cascade = CascadeType.ALL)
    @BatchSize(size = 30)
    private List<ReponseCritere> reponses;

   
    // ── Helpers ──────────────────────────────────────────────────
    public boolean isN1Valide() {
        return dateValidationN1 != null;
    }

    public boolean isN2Valide() {
        return dateValidationN2 != null;
    }

    // ── Enums ────────────────────────────────────────────────────
    public enum Status {
        EN_COURS,
        SOUMIS,
        VALIDE_N1, // Chef de ligne a valide (N2 en attente)
        VALIDE_N2, // N1 + N2 valides (pret pour la validation finale)
        VALIDE_FINAL, // Agent Qualite a valide
        REJETE
    }

    public enum Session {
        M, S, N
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (!(o instanceof OkDemarrage))
            return false;
        return id != null && id.equals(((OkDemarrage) o).id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}