package com.example.dto;

import lombok.Data;

@Data
public class MachineDTO {

    private Long id;
    private String nom;
    private String description;
    private Long processusId;
    private String processusNom;

    // Localisation (segment → plant → site)
    private Long segmentId;
    private String segmentNom;
    private Long plantId;
    private String plantNom;
    private Long siteId;
    private String siteNom;
}