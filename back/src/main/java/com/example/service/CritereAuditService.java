package com.example.service;

import com.example.dto.CritereAuditLogDTO;
import com.example.entity.Critere;
import com.example.entity.CritereAuditLog;
import com.example.entity.Utilisateur;
import com.example.repository.CritereAuditLogRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CritereAuditService {

    private final CritereAuditLogRepository auditRepo;
    private final UtilisateurRepository utilisateurRepo;

    // ── Enregistrement ───────────────────────────────────────────

    /**
     * Log d'une CREATION.
     *
     * @param critere   entité après création (déjà persistée, id disponible)
     * @param matricule matricule de l'auteur (depuis le JWT)
     */
    public void logCreation(Critere critere, String matricule) {
        Utilisateur auteur = utilisateurRepo.findByMatricule(matricule).orElse(null);

        CritereAuditLog log = CritereAuditLog.builder()
                .critereId(critere.getId())
                .critereNom(critere.getNom())
                .utilisateur(auteur)
                .matricule(matricule)
                .dateAction(LocalDateTime.now())
                .action(CritereAuditLog.Action.CREATION)
                .changements("")
                .snapshotAvant("")
                .snapshotApres(toSnapshot(critere))
                .build();

        auditRepo.save(log);
    }

    /**
     * Log d'une MODIFICATION.
     * Compare avant / après et génère un diff lisible.
     *
     * @param avant     état du critère AVANT apply (snapshot pris dans le service
     *                  avant modification)
     * @param apres     entité APRÈS modification et sauvegarde
     * @param matricule matricule de l'auteur
     */
    public void logModification(Critere avant, Critere apres, String matricule) {
        Utilisateur auteur = utilisateurRepo.findByMatricule(matricule).orElse(null);

        String diff = buildDiff(avant, apres);

        // Si rien n'a changé (call identique), on ne log pas pour éviter le bruit
        if (diff.isBlank())
            return;

        CritereAuditLog log = CritereAuditLog.builder()
                .critereId(apres.getId())
                .critereNom(apres.getNom())
                .utilisateur(auteur)
                .matricule(matricule)
                .dateAction(LocalDateTime.now())
                .action(CritereAuditLog.Action.MODIFICATION)
                .changements(diff)
                .snapshotAvant(toSnapshot(avant))
                .snapshotApres(toSnapshot(apres))
                .build();

        auditRepo.save(log);
    }

    /**
     * Log d'une SUPPRESSION.
     * On conserve le snapshot avant suppression pour traçabilité.
     */
    public void logSuppression(Critere critere, String matricule) {
        Utilisateur auteur = utilisateurRepo.findByMatricule(matricule).orElse(null);

        CritereAuditLog log = CritereAuditLog.builder()
                .critereId(critere.getId())
                .critereNom(critere.getNom())
                .utilisateur(auteur)
                .matricule(matricule)
                .dateAction(LocalDateTime.now())
                .action(CritereAuditLog.Action.SUPPRESSION)
                .changements("")
                .snapshotAvant(toSnapshot(critere))
                .snapshotApres("")
                .build();

        auditRepo.save(log);
    }

    // ── Lecture ──────────────────────────────────────────────────

    /** Historique complet d'un critère */
    public List<CritereAuditLogDTO> getHistoriqueCritere(Long critereId) {
        return auditRepo.findByCritereIdWithUserOrderByDateActionDesc(critereId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Dernières 10 actions globales (widget dashboard) */
    public List<CritereAuditLogDTO> getDernieresActions() {
        return auditRepo.findTop10ByOrderByDateActionDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Historique paginé global (page admin) */
    public Page<CritereAuditLogDTO> getHistoriqueGlobal(int page, int size) {
        return auditRepo.findAllWithUser(PageRequest.of(page, size)).map(this::toDTO);
    }

    // ── Helpers privés ───────────────────────────────────────────

    /**
     * Génère un diff texte "champ: avant → après" pour chaque champ modifié.
     * On exclut l'image (base64 trop verbose).
     */
    private String buildDiff(Critere avant, Critere apres) {
        List<String> lines = new ArrayList<>();

        diff(lines, "nom", avant.getNom(), apres.getNom());
        diff(lines, "description", avant.getDescription(), apres.getDescription());
        diff(lines, "nomAr", avant.getNomAr(), apres.getNomAr());
        diff(lines, "descriptionAr", avant.getDescriptionAr(), apres.getDescriptionAr());
        diff(lines, "type",
                avant.getType() != null ? avant.getType().name() : null,
                apres.getType() != null ? apres.getType().name() : null);
        diff(lines, "couleur", avant.getCouleur(), apres.getCouleur());
        diff(lines, "moyenVerification", avant.getMoyenVerification(), apres.getMoyenVerification());
        diff(lines, "categorie", avant.getCategorie(), apres.getCategorie());

        // Changement de processus
        Long pidAvant = avant.getProcessus() != null ? avant.getProcessus().getId() : null;
        Long pidApres = apres.getProcessus() != null ? apres.getProcessus().getId() : null;
        if (!eq(pidAvant, pidApres)) {
            String nomAvant = avant.getProcessus() != null ? avant.getProcessus().getNom() : "—";
            String nomApres = apres.getProcessus() != null ? apres.getProcessus().getNom() : "—";
            lines.add("processus: " + nomAvant + " → " + nomApres);
        }

        return String.join("\n", lines);
    }

    private void diff(List<String> lines, String champ, String avant, String apres) {
        if (!eq(avant, apres)) {
            lines.add(champ + ": " + nvl(avant) + " → " + nvl(apres));
        }
    }

    private boolean eq(Object a, Object b) {
        if (a == null && b == null)
            return true;
        if (a == null || b == null)
            return false;
        return a.toString().equals(b.toString());
    }

    private String nvl(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    /**
     * Snapshot JSON minimal sans image pour éviter de stocker des Mo en base.
     */
    private String toSnapshot(Critere c) {
        return String.format(
                "{\"id\":%d,\"nom\":\"%s\",\"type\":\"%s\",\"couleur\":\"%s\"," +
                        "\"moyenVerification\":\"%s\",\"categorie\":\"%s\"," +
                        "\"nomAr\":\"%s\",\"processusId\":%s}",
                c.getId() != null ? c.getId() : 0,
                safe(c.getNom()),
                c.getType() != null ? c.getType().name() : "",
                safe(c.getCouleur()),
                safe(c.getMoyenVerification()),
                safe(c.getCategorie()),
                safe(c.getNomAr()),
                c.getProcessus() != null ? c.getProcessus().getId() : "null");
    }

    private String safe(String s) {
        return s == null ? "" : s.replace("\"", "\\\"");
    }

    private CritereAuditLogDTO toDTO(CritereAuditLog log) {
        CritereAuditLogDTO dto = new CritereAuditLogDTO();
        dto.setId(log.getId());
        dto.setCritereId(log.getCritereId());
        dto.setCritereNom(log.getCritereNom());
        dto.setAction(log.getAction());
        dto.setDateAction(log.getDateAction());
        dto.setChangements(log.getChangements());
        dto.setSnapshotAvant(log.getSnapshotAvant());
        dto.setSnapshotApres(log.getSnapshotApres());
        dto.setMatricule(log.getMatricule());
        if (log.getUtilisateur() != null) {
            dto.setUtilisateurId(log.getUtilisateur().getId());
            dto.setUtilisateurNom(log.getUtilisateur().getNom());
        }
        return dto;
    }
}