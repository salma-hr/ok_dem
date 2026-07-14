package com.example.dto;

import lombok.Data;

@Data
public class CreateUtilisateurRequest {
    private String nom;
    private String matricule;
    private String email;
    private String password;
    private Long roleId;
    private Long processusId;
    private Long siteId;
    private Long plantId;
    private Long segmentId;
}
