package com.example.repository;

import com.example.entity.ChecklistAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChecklistAuditLogRepository extends JpaRepository<ChecklistAuditLog, Long> {

    List<ChecklistAuditLog> findByChecklistIdOrderByDateActionDesc(Long checklistId);

    @Query("SELECT l FROM ChecklistAuditLog l LEFT JOIN FETCH l.utilisateur " +
            "WHERE l.checklistId = :checklistId ORDER BY l.dateAction DESC")
    List<ChecklistAuditLog> findByChecklistIdWithUserOrderByDateActionDesc(
            @Param("checklistId") Long checklistId);

    @Modifying
    @Query("delete from ChecklistAuditLog l where l.checklistId = :checklistId")
    void deleteByChecklistId(@Param("checklistId") Long checklistId);

    @Modifying
    @Query("delete from ChecklistAuditLog l where l.utilisateur.id = :userId")
    void deleteByUtilisateurId(@Param("userId") Long userId);
}