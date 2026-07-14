package com.example.repository;

import com.example.entity.OkDemarrage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;

public interface OkDemarrageRepository extends JpaRepository<OkDemarrage, Long> {

    // ── findByIdWithDetails ───────────────────────────────────────
    @Query("""
            SELECT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH okd.operateur op
            LEFT JOIN FETCH op.processus oproc
            LEFT JOIN FETCH oproc.segment oseg
            LEFT JOIN FETCH oseg.plant opl
            LEFT JOIN FETCH okd.site
            LEFT JOIN FETCH okd.reponses r
            LEFT JOIN FETCH r.critere
            LEFT JOIN FETCH okd.valideN1Par
            LEFT JOIN FETCH okd.valideN2Par
            LEFT JOIN FETCH okd.valideParFinal
            LEFT JOIN FETCH okd.rejetePar
            WHERE okd.id = :id
            """)
    Optional<OkDemarrage> findByIdWithDetails(@Param("id") Long id);

    // ── findAllWithDetails ────────────────────────────────────────
    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH okd.operateur op
            LEFT JOIN FETCH op.processus oproc
            LEFT JOIN FETCH oproc.segment oseg
            LEFT JOIN FETCH oseg.plant opl
            LEFT JOIN FETCH okd.site
            LEFT JOIN FETCH okd.reponses r
            LEFT JOIN FETCH r.critere
            LEFT JOIN FETCH okd.valideN1Par
            LEFT JOIN FETCH okd.valideN2Par
            LEFT JOIN FETCH okd.valideParFinal
            LEFT JOIN FETCH okd.rejetePar
            ORDER BY okd.date DESC
            """)
    List<OkDemarrage> findAllWithDetails();

        // ════════════════════════════════════════════════════════════════
        // BROUILLON : trouver une checklist par opérateur/machine/date
        // ════════════════════════════════════════════════════════════════

    /**
     * Cherche une checklist (brouillon ou soumise) pour la combinaison unique :
     * opérateur + machine + session + date.
     * Retourne une List pour éviter NonUniqueResultException si des doublons
     * existent en base. Le service prend toujours le premier résultat.
     */
    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH m.processus proc
            LEFT JOIN FETCH okd.operateur
            LEFT JOIN FETCH okd.site
            WHERE okd.operateur.id = :operateurId
              AND okd.machine.id   = :machineId
              AND okd.session      = :session
              AND okd.date         = :date
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findAllByOperateurIdAndMachineIdAndSessionAndDate(
            @Param("operateurId") Long operateurId,
            @Param("machineId") Long machineId,
            @Param("session") OkDemarrage.Session session,
            @Param("date") LocalDate date);

    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH m.processus proc
            LEFT JOIN FETCH okd.operateur
            LEFT JOIN FETCH okd.site
            WHERE okd.operateur.id = :operateurId
              AND okd.machine.id   = :machineId
              AND okd.date         = :date
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findAllByOperateurIdAndMachineIdAndDate(
            @Param("operateurId") Long operateurId,
            @Param("machineId") Long machineId,
            @Param("date") LocalDate date);

    /** Fallback sans machine : checklist liée à l'opérateur uniquement (machine IS NULL). */
    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.operateur
            LEFT JOIN FETCH okd.site
            WHERE okd.operateur.id = :operateurId
              AND okd.machine IS NULL
              AND okd.date         = :date
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findAllByOperateurIdAndMachineIdNullAndDate(
            @Param("operateurId") Long operateurId,
            @Param("date") LocalDate date);

    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH okd.operateur
            WHERE okd.machine.id = :machineId
              AND okd.session = :session
              AND okd.date = :date
              AND okd.operateur.id <> :operateurId
              AND okd.status <> :statusExclu
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findConflictingByMachineIdAndSessionAndDateAndOperateurIdNotAndStatusNot(
            @Param("machineId") Long machineId,
            @Param("session") OkDemarrage.Session session,
            @Param("date") LocalDate date,
            @Param("operateurId") Long operateurId,
            @Param("statusExclu") OkDemarrage.Status statusExclu);

    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH okd.operateur
            WHERE okd.machine.id = :machineId
              AND okd.date = :date
              AND okd.operateur.id <> :operateurId
              AND okd.status <> :statusExclu
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findConflictingByMachineIdAndDateAndOperateurIdNotAndStatusNot(
            @Param("machineId") Long machineId,
            @Param("date") LocalDate date,
            @Param("operateurId") Long operateurId,
            @Param("statusExclu") OkDemarrage.Status statusExclu);

    /**
     * Récupérer tous les brouillons (EN_COURS) d'un opérateur.
     * Affiché dans la liste "Mes brouillons" côté frontend.
     */
    @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine m
            LEFT JOIN FETCH m.processus proc
            LEFT JOIN FETCH okd.operateur
            LEFT JOIN FETCH okd.site
            LEFT JOIN FETCH okd.reponses r
            LEFT JOIN FETCH r.critere
            WHERE okd.operateur.id = :operateurId
              AND okd.status       = :status
            ORDER BY okd.date DESC
            """)
    List<OkDemarrage> findByOperateurIdAndStatus(
            @Param("operateurId") Long operateurId,
            @Param("status") OkDemarrage.Status status);

    @Query("""
            SELECT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.reponses r
            WHERE okd.machine.id = :machineId
              AND okd.status     <> :statusExclu
            ORDER BY okd.date DESC, okd.id DESC
            """)
    List<OkDemarrage> findTopNByMachineIdAndStatusNotOrderByDateDesc(
            @Param("machineId") Long machineId,
            @Param("statusExclu") OkDemarrage.Status statusExclu,
            Pageable pageable);

    default List<OkDemarrage> findTopNByMachineIdAndStatusNotOrderByDateDesc(
            Long machineId, OkDemarrage.Status statusExclu, int limit) {
        return findTopNByMachineIdAndStatusNotOrderByDateDesc(
                machineId, statusExclu,
                org.springframework.data.domain.PageRequest.of(0, limit));
    }
 @Query("""
            SELECT DISTINCT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.reponses r
            LEFT JOIN FETCH r.critere c
            WHERE c.processus.id = :processusId
              AND okd.status     <> :statusExclu
            ORDER BY okd.date DESC, okd.id DESC
            """)
    List<OkDemarrage> findTopNByProcessusIdAndStatusNotOrderByDateDesc(
            @Param("processusId") Long processusId,
            @Param("statusExclu") OkDemarrage.Status statusExclu,
            Pageable pageable);
 
    default List<OkDemarrage> findTopNByProcessusIdAndStatusNotOrderByDateDesc(
            Long processusId, OkDemarrage.Status statusExclu, int limit) {
        return findTopNByProcessusIdAndStatusNotOrderByDateDesc(
                processusId, statusExclu,
                org.springframework.data.domain.PageRequest.of(0, limit));
    }
 
   

    /**
     * Vérifie si un opérateur a déjà soumis au moins une checklist (statut != EN_COURS)
     * pour une date donnée, quelle que soit la machine ou la session.
     * Utilisé pour appliquer la règle : une seule soumission par opérateur par journée.
     */
    @Query("""
            SELECT COUNT(okd) FROM OkDemarrage okd
            WHERE okd.operateur.id = :operateurId
              AND okd.date         = :date
              AND okd.status       <> :statusExclu
            """)
    long countSoumisParJournee(
            @Param("operateurId") Long operateurId,
            @Param("date") LocalDate date,
            @Param("statusExclu") OkDemarrage.Status statusExclu);

    /**
     * Récupère la checklist déjà soumise par l'opérateur pour une date donnée
     * (statut != EN_COURS), pour pouvoir renvoyer son ID au frontend.
     */
    @Query("""
            SELECT okd FROM OkDemarrage okd
            LEFT JOIN FETCH okd.machine
            LEFT JOIN FETCH okd.operateur
            WHERE okd.operateur.id = :operateurId
              AND okd.date         = :date
              AND okd.status       <> :statusExclu
            ORDER BY okd.id ASC
            """)
    List<OkDemarrage> findSoumisParJournee(
            @Param("operateurId") Long operateurId,
            @Param("date") LocalDate date,
            @Param("statusExclu") OkDemarrage.Status statusExclu);

        @Modifying
        @Query("update OkDemarrage o set o.valideN1Par = null where o.valideN1Par.id = :userId")
        void clearValideN1ParReferences(@Param("userId") Long userId);

        @Modifying
        @Query("update OkDemarrage o set o.valideN2Par = null where o.valideN2Par.id = :userId")
        void clearValideN2ParReferences(@Param("userId") Long userId);

        @Modifying
        @Query("update OkDemarrage o set o.valideParFinal = null where o.valideParFinal.id = :userId")
        void clearValideParFinalReferences(@Param("userId") Long userId);

        @Modifying
        @Query("update OkDemarrage o set o.rejetePar = null where o.rejetePar.id = :userId")
        void clearRejeteParReferences(@Param("userId") Long userId);

        @Modifying
        @Query("delete from OkDemarrage o where o.operateur.id = :userId")
        void deleteByOperateurId(@Param("userId") Long userId);

    
 
}