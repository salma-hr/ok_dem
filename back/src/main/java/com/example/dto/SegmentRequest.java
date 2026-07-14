package com.example.dto;

import lombok.Data;

@Data
public class SegmentRequest {
    private String nom;
    private String description;
    private Long plantId;     
}