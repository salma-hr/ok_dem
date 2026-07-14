package com.example.dto;

import com.example.entity.PlanAction;
import lombok.Data;
import java.time.LocalDate;

@Data
public class PlanActionRequest {
    private Long checklistId;        // obligatoire
    private String description;      // obligatoire
    private String responsableMatricule; // obligatoire sauf si AUTRES
    private String responsableAutre; // optionnel si responsableMatricule = AUTRES
    private LocalDate dateEcheance;  // obligatoire
    private PlanAction.Priorite priorite; // optionnel (NORMALE par défaut)
    private String couleurCritere;   // "ROUGE" | "JAUNE" — détermine le workflow de validation
}