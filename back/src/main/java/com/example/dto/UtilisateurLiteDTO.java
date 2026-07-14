package com.example.dto;

import lombok.Data;

@Data
public class UtilisateurLiteDTO {
    private Long id;
    private String nom;
    private String matricule;
    private String role;
    private String email;
    private Long plantId;
}