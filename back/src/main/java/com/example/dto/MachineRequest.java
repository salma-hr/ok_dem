package com.example.dto;
import lombok.Data;

@Data
public class MachineRequest {
    private String nom;
    private String description;
    private Long processusId;
    
    private Long segmentId;  
    private Long plantId;     
    private Long siteId;  
}
