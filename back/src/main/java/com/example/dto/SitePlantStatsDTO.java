package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SitePlantStatsDTO {
    private Long siteId;
    private String siteName;
    private Long plantId;
    private String plantName;
    private Long checklists;
    private Long alertes;
    private Double tauxAlertes;
}
