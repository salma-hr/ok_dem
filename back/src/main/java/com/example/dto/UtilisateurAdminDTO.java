package com.example.dto;

import lombok.Data;

@Data
public class UtilisateurAdminDTO {
    private Long id;
    private String nom;
    private String matricule;
    private String email;
    private Boolean actif;
    private RefDTO role;
    private RefDTO processus;
    private RefDTO site;
    private RefDTO plant;
    private RefDTO segment;

    @Data
    public static class RefDTO {
        private Long id;
        private String nom;
    }
}
