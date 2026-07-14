package com.example.dto;

import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OperatorPerformanceDTO {
    private Long operateurId;
    private String operateurNom;
    private LocalDate date;
    private Long totalChecklists;
    private Long nonConformites;
    private Double tauxConformite;
}
