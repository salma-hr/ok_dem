package com.example.dto;

import lombok.Data;

@Data
public class SiteRequest {
    private String nom;
    private String adresse;      // ← ajouté
    private String responsable;
}