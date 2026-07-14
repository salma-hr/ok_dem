package com.example.dto;

import lombok.Data;

@Data
public class ProcessusRequest {
    private String nom;
    private String description;
    private Long segmentId;   // ← ajouté
}