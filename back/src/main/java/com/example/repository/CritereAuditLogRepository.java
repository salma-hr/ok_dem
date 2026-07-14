package com.example.repository;

import com.example.entity.CritereAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CritereAuditLogRepository extends JpaRepository<CritereAuditLog, Long> {

    /** Historique complet d'un critère précis, du plus récent au plus ancien */
    List<CritereAuditLog> findByCritereIdOrderByDateActionDesc(Long critereId);

    /** Historique complet d'un critère avec utilisateur préchargé */
    @Query("SELECT l FROM CritereAuditLog l LEFT JOIN FETCH l.utilisateur " +
            "WHERE l.critereId = :critereId ORDER BY l.dateAction DESC")
    List<CritereAuditLog> findByCritereIdWithUserOrderByDateActionDesc(
            @Param("critereId") Long critereId);

    /** Historique paginé de tous les critères (pour page d'admin) */
    @Query("SELECT l FROM CritereAuditLog l LEFT JOIN FETCH l.utilisateur ORDER BY l.dateAction DESC")
    Page<CritereAuditLog> findAllWithUser(Pageable pageable);

    /** Historique des actions d'un utilisateur donné */
    List<CritereAuditLog> findByUtilisateurIdOrderByDateActionDesc(Long utilisateurId);

    /** Recherche par plage de dates */
    @Query("SELECT l FROM CritereAuditLog l WHERE l.dateAction BETWEEN :debut AND :fin ORDER BY l.dateAction DESC")
    List<CritereAuditLog> findByPeriode(
            @Param("debut") LocalDateTime debut,
            @Param("fin") LocalDateTime fin);

    /** Dernières N modifications (pour widget dashboard) */
    List<CritereAuditLog> findTop10ByOrderByDateActionDesc();

    /** Nombre total d'actions par type */
    long countByAction(CritereAuditLog.Action action);

        @Modifying
        @Query("delete from CritereAuditLog l where l.utilisateur.id = :userId")
        void deleteByUtilisateurId(@Param("userId") Long userId);
}