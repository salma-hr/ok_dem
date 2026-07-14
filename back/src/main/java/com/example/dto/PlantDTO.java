package com.example.dto;

import lombok.Data;

@Data
public class PlantDTO {
    private Long id;
    private String nom;
    private String description;
    private Long siteId;
    private String siteNom;
}