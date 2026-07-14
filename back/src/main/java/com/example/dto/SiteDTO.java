package com.example.dto;

import lombok.Data;

@Data
public class SiteDTO {
    private Long id;
    private String nom;
    private String adresse;      // ← ajouté
    private String responsable;
}