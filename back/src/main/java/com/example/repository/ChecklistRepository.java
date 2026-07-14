package com.example.repository;

import com.example.entity.OkDemarrage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ChecklistRepository extends JpaRepository<OkDemarrage, Long> {

        // ── Comptages par statut + période ───────────────────────────────

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.status = :status AND o.date BETWEEN :startDate AND :endDate")
        Long countByStatusAndDateBetween(
                        @Param("status") OkDemarrage.Status status,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.status = :status")
        Long countByStatus(@Param("status") OkDemarrage.Status status);

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.date BETWEEN :startDate AND :endDate")
        Long countByDateBetween(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // ── En attente de validation ─────────────────────────────────────
        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.status IN " +
                        "('SOUMIS', 'VALIDE_N1', 'VALIDE_N2')")
        Long countEnAttenteDeValidation();

        // ── Non-conformités (critères ROUGE ou JAUNE) ─────────────────────
        @Query("SELECT COUNT(DISTINCT o) FROM OkDemarrage o JOIN o.reponses r " +
                        "WHERE r.valeur IN (com.example.entity.ReponseCritere.Valeur.ROUGE, com.example.entity.ReponseCritere.Valeur.JAUNE) " +
                        "AND o.date BETWEEN :startDate AND :endDate")
        Long countWithNonConformiteAndDateBetween(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // ── Répartition par processus ─────────────────────────────────────
        @Query("""
                        SELECT c.machine.processus.id, c.machine.processus.nom, COUNT(c)
                        FROM OkDemarrage c
                        WHERE c.machine.processus IS NOT NULL
                        GROUP BY c.machine.processus.id, c.machine.processus.nom
                        ORDER BY COUNT(c) DESC
                        """)
        List<Object[]> countChecklistsByProcessus();

        // ── NOUVEAU : Chargement eager pour le dashboard (évite
        // LazyInitializationException) ──
        // JOIN FETCH force Hibernate à charger machine ET operateur en une seule
        // requête SQL
        // sans avoir besoin d'une session Hibernate ouverte plus tard.
        @Query("""
                        SELECT DISTINCT o FROM OkDemarrage o
                        LEFT JOIN FETCH o.machine m
                        LEFT JOIN FETCH o.operateur op
                        ORDER BY o.date DESC
                        """)
        List<OkDemarrage> findRecentWithDetails(Pageable pageable);

        // ── Recherches directes ───────────────────────────────────────────
        @Override
        Page<OkDemarrage> findAll(Pageable pageable);

        List<OkDemarrage> findByMachineId(Long machineId);

        List<OkDemarrage> findByOperateurId(Long operateurId);

        List<OkDemarrage> findByDate(LocalDate date);

        List<OkDemarrage> findByStatus(OkDemarrage.Status status);

        // ── Checklists en attente pour un rôle donné ──────────────────────
        @Query("SELECT o FROM OkDemarrage o WHERE o.status = 'SOUMIS'")
        List<OkDemarrage> findEnAttenteN1();

        @Query("SELECT o FROM OkDemarrage o WHERE o.status = 'VALIDE_N1'")
        List<OkDemarrage> findEnAttenteN2();

        @Query("SELECT o FROM OkDemarrage o WHERE o.status = 'VALIDE_N2'")
        List<OkDemarrage> findEnAttenteValidationFinale();

        // ── Performance opérateur (historique par date) ─────────────────
        @Query("""
                        SELECT o.operateur.id, o.operateur.nom, o.date,
                                                 COUNT(DISTINCT o.id),
                                                 COUNT(DISTINCT CASE
                                                                 WHEN r.valeur = com.example.entity.ReponseCritere.Valeur.ROUGE
                                                                 THEN o.id
                                                                 ELSE null
                                                 END)
                        FROM OkDemarrage o
                        LEFT JOIN o.reponses r
                        WHERE o.operateur IS NOT NULL
                                AND o.date BETWEEN :startDate AND :endDate
                        GROUP BY o.operateur.id, o.operateur.nom, o.date
                        ORDER BY o.date ASC, o.operateur.nom ASC
                        """)
        List<Object[]> getOperatorPerformance(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        @Query("""
                        SELECT 
                            COALESCE(s.id, 0), COALESCE(s.nom, 'N/A'),
                            COALESCE(p.id, 0), COALESCE(p.nom, 'N/A'),
                            COUNT(DISTINCT o.id),
                            COUNT(DISTINCT CASE WHEN r.valeur IN (com.example.entity.ReponseCritere.Valeur.ROUGE, com.example.entity.ReponseCritere.Valeur.JAUNE) THEN o.id ELSE null END)
                        FROM OkDemarrage o
                        LEFT JOIN o.machine m
                        LEFT JOIN m.plant p
                        LEFT JOIN p.site s
                        LEFT JOIN o.reponses r
                        GROUP BY s.id, s.nom, p.id, p.nom
                        ORDER BY s.nom ASC NULLS LAST, p.nom ASC NULLS LAST
                        """)
        List<Object[]> countBySiteAndPlant();

        // ════════════════════════════════════════════════════════════════
        // VARIANTES SCOPÉES PAR PLANT (utilisées par le dashboard pour les
        // utilisateurs non "admin système" : plantId = null → aucun filtre)
        // ════════════════════════════════════════════════════════════════

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.status = :status AND o.date BETWEEN :startDate AND :endDate "
                        + "AND (:plantId IS NULL OR o.machine.plant.id = :plantId)")
        Long countByStatusAndDateBetweenScoped(
                        @Param("status") OkDemarrage.Status status,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("plantId") Long plantId);

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.status = :status "
                        + "AND (:plantId IS NULL OR o.machine.plant.id = :plantId)")
        Long countByStatusScoped(@Param("status") OkDemarrage.Status status, @Param("plantId") Long plantId);

        @Query("SELECT COUNT(o) FROM OkDemarrage o WHERE o.date BETWEEN :startDate AND :endDate "
                        + "AND (:plantId IS NULL OR o.machine.plant.id = :plantId)")
        Long countByDateBetweenScoped(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("plantId") Long plantId);

        @Query("SELECT COUNT(DISTINCT o) FROM OkDemarrage o JOIN o.reponses r "
                        + "WHERE r.valeur IN (com.example.entity.ReponseCritere.Valeur.ROUGE, com.example.entity.ReponseCritere.Valeur.JAUNE) "
                        + "AND o.date BETWEEN :startDate AND :endDate "
                        + "AND (:plantId IS NULL OR o.machine.plant.id = :plantId)")
        Long countWithNonConformiteAndDateBetweenScoped(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("plantId") Long plantId);

        @Query("""
                        SELECT c.machine.processus.id, c.machine.processus.nom, COUNT(c)
                        FROM OkDemarrage c
                        WHERE c.machine.processus IS NOT NULL
                        AND (:plantId IS NULL OR c.machine.plant.id = :plantId)
                        GROUP BY c.machine.processus.id, c.machine.processus.nom
                        ORDER BY COUNT(c) DESC
                        """)
        List<Object[]> countChecklistsByProcessusScoped(@Param("plantId") Long plantId);

        @Query("""
                        SELECT DISTINCT o FROM OkDemarrage o
                        LEFT JOIN FETCH o.machine m
                        LEFT JOIN FETCH o.operateur op
                        WHERE (:plantId IS NULL OR m.plant.id = :plantId)
                        ORDER BY o.date DESC
                        """)
        List<OkDemarrage> findRecentWithDetailsScoped(@Param("plantId") Long plantId, Pageable pageable);

        @Query("""
                        SELECT o.operateur.id, o.operateur.nom, o.date,
                                                 COUNT(DISTINCT o.id),
                                                 COUNT(DISTINCT CASE
                                                                 WHEN r.valeur = com.example.entity.ReponseCritere.Valeur.ROUGE
                                                                 THEN o.id
                                                                 ELSE null
                                                 END)
                        FROM OkDemarrage o
                        LEFT JOIN o.reponses r
                        WHERE o.operateur IS NOT NULL
                                AND o.date BETWEEN :startDate AND :endDate
                                AND (:plantId IS NULL OR o.machine.plant.id = :plantId)
                        GROUP BY o.operateur.id, o.operateur.nom, o.date
                        ORDER BY o.date ASC, o.operateur.nom ASC
                        """)
        List<Object[]> getOperatorPerformanceScoped(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("plantId") Long plantId);
}