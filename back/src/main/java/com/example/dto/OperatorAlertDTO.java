package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OperatorAlertDTO {
    private Long operateurId;
    private String operateurNom;
    private Long alertes;
    private Long checklists;
    private Double tauxAlertes;
}
