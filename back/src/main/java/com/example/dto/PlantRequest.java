package com.example.dto;

import lombok.Data;

@Data
public class PlantRequest {
    private String nom;
    private String description;
    private Long segmentId;
    private Long siteId;
}
