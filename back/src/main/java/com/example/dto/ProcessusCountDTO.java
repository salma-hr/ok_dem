package com.example.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessusCountDTO {
    private Long processusId;
    private String processusNom;
    private Long count;
}