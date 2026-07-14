package com.example.dto;

import com.example.entity.ChecklistAuditLog;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChecklistAuditLogDTO {

    private Long id;
    private Long checklistId;
    private String machineNom;
    private String processusNom;

    private Long utilisateurId;
    private String utilisateurNom;
    private String matricule;

    private ChecklistAuditLog.Action action;
    private LocalDateTime dateAction;

    private String statutAvant;
    private String statutApres;
    private String details;
    private Long planActionId;
}
