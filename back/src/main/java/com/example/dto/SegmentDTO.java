package com.example.dto;

import lombok.Data;

@Data
public class SegmentDTO {
    private Long id;
    private String nom;
    private String description;
    private Long plantId;     
    private String plantNom; 
}