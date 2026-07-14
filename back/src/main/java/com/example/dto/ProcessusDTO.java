package com.example.dto;

import lombok.Data;

@Data
public class ProcessusDTO {
    private Long id;
    private String nom;
    private String description;
    private Long segmentId;
    private String segmentNom;
    private Long plantId;
    private String plantNom;
    private int machineCount;
}