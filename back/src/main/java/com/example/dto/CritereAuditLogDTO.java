package com.example.dto;

import com.example.entity.CritereAuditLog;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CritereAuditLogDTO {

    private Long          id;
    private Long          critereId;
    private String        critereNom;

    // Auteur
    private Long          utilisateurId;
    private String        utilisateurNom;
    private String        matricule;

    // Action
    private CritereAuditLog.Action action;
    private LocalDateTime          dateAction;

    // Détail
    private String changements;   // diff lisible ligne par ligne
    private String snapshotAvant; // JSON léger état avant
    private String snapshotApres; // JSON léger état après
}