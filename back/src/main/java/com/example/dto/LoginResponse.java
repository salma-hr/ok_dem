package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long id;
    private String matricule;
    private String nom;
    private String role;
    private String email;
    private Long siteId;
    private String siteNom;
    private Long plantId;
    private String plantNom;
    private Long segmentId;
    private String segmentNom;
    private Long processusId;
    private String processusNom;

}