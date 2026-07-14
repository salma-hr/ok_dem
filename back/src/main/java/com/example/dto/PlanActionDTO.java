package com.example.dto;

import com.example.entity.PlanAction;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PlanActionDTO {
    private Long id;

    // Checklist
    private Long checklistId;
    private String machineNom;
    private String processusNom;
    private String operateurNom;
    private Long plantId;

    // Description
    private String description;

    // Responsable
    private Long responsableId;
    private String responsableMatricule;
    private String responsableNom;
    private String responsableAutre;

    // Planification
    private LocalDate dateEcheance;
    private PlanAction.Statut statut;
    private PlanAction.Priorite priorite;

    // Traçabilité
    private LocalDateTime creeLe;
    private String creeParMatricule;
    private LocalDateTime closLe;
    private String commentaireCloture;

    // Couleur du critère source (détermine le workflow AQ)
    private String couleurCritere; // "ROUGE" | "JAUNE"

    // Validation Agent Qualité (rempli uniquement pour les plans ROUGE)
    private LocalDateTime valideAqLe;
    private String valideAqParMatricule;
    private String commentaireValidationAq;

    /** true si ce plan nécessite une validation AQ (couleurCritere == ROUGE et pas encore validé) */
    private boolean enAttenteValidationAq;
}