package com.example.dto;

import com.example.entity.OkDemarrage;
import com.example.entity.ReponseCritere.Valeur;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class ChecklistRequest {

    private LocalDate date;
    private Integer dureeFillSec;
    /**
     * ✅ NOUVEAU : Session M / S / N
     */
    private OkDemarrage.Session session;

    private Long machineId;
    private Long operateurId;
    private Long siteId;
    private Long processusId;

    private List<ReponseDto> reponses;

    @Data
    public static class ReponseDto {
        private Long critereId;
        private Valeur valeur;       
        private String commentaire;
    }
}