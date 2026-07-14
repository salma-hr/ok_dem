package com.example.repository;

import com.example.entity.PlanAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlanActionRepository extends JpaRepository<PlanAction, Long> {

    /** Tous les plans d'action d'une checklist */
    List<PlanAction> findByOkDemarrageIdOrderByCreeLe(Long checklistId);

    /** Plans d'action assignés à un responsable */
    @Query("SELECT p FROM PlanAction p " +
           "LEFT JOIN FETCH p.responsable " +
           "WHERE p.responsableMatricule = :matricule ORDER BY p.creeLe DESC")
    List<PlanAction> findByResponsableMatricule(@Param("matricule") String matricule);

    /** Plans d'action par statut */
    List<PlanAction> findByStatutOrderByDateEcheanceAsc(PlanAction.Statut statut);

    /** Tous les plans d'action, triés par date de création décroissante */
    @Query("SELECT p FROM PlanAction p " +
           "LEFT JOIN FETCH p.responsable " +
           "WHERE p.okDemarrage IS NOT NULL ORDER BY p.creeLe DESC")
    List<PlanAction> findAllWithDetails();

    long countByStatut(PlanAction.Statut statut);

    @Modifying
    @Query("update PlanAction p set p.responsable = null where p.responsable.id = :userId")
    int clearResponsableReferences(@Param("userId") Long userId);

    @Modifying
    @Query("delete from PlanAction p where p.okDemarrage.operateur.id = :userId")
    int deleteByOkDemarrageOperateurId(@Param("userId") Long userId);

    @Modifying
    @Query("delete from PlanAction p where p.okDemarrage.id = :checklistId")
    int deleteByOkDemarrageId(@Param("checklistId") Long checklistId);

    @Modifying
    @Query(value = "DELETE FROM plan_action WHERE ok_demarrage_id IS NULL OR ok_demarrage_id NOT IN (SELECT id FROM ok_demarrage)", nativeQuery = true)
    int deleteOrphanedPlans();
}