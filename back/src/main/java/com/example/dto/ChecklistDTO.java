package com.example.dto;

import com.example.entity.OkDemarrage;
import com.example.entity.OkDemarrage.Status;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ChecklistDTO {
    private Long id;
    private LocalDate date;
    private OkDemarrage.Session session;
    private Status status;

    // ── Validation N1 : Chef de ligne ────────────────────────────
    private LocalDateTime dateValidationN1;
    private String valideN1Par;
    private String valideN1ParMatricule;

    // ── Validation N2 : Technicien ───────────────────────────────
    private LocalDateTime dateValidationN2;
    private String valideN2Par;
    private String valideN2ParMatricule;

    // ── Validation finale : Agent Qualité ────────────────────────
    private LocalDateTime dateValidationFinale;
    private String valideParFinal;
    private String valideParFinalMatricule;

    // ── Rejet ────────────────────────────────────────────────────
    private String motifRejet;
    private String rejetePar;
    private LocalDateTime dateRejet;

    // ── Machine / Processus / Opérateur / Site ──────────────────
    private Long machineId;
    private String machineNom;
    private Long processusId;
    private String processusNom;
    private Long operateurId;
    private String operateurNom;
    private String operateurMatricule;
    private Long siteId;
    private String siteNom;
    private String siteAdresse;
    private Long plantId;
    private String plantNom;
    private Long segmentId;
    private String segmentNom;

    private List<ReponseDTO> reponses;
   

    @Data
    public static class ReponseDTO {
        private Long id;
        private String valeur;       // VERT / JAUNE / ROUGE / NA
        private String commentaire;
        private Long critereId;
        private String critereNom;
        private String critereNomAr;
        private String critereNomEn;
        private String critereNomDe;
        private String critereCouleur; // Rouge / Jaune / Vert
    }
}