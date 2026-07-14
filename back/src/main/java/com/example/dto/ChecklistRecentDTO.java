package com.example.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.*;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistRecentDTO {
    private Long id;
    private String machineNom;
    private String machineCode;
    private String operateurNom;
    private LocalDate dateControle;
    private LocalDateTime dateCreation;
    private String statut;
    private Integer criteresOk;
    private Integer criteresTotal;
    private Boolean hasNonConformite;
}