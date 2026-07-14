package com.example.service;

import com.example.dto.ChecklistAuditLogDTO;
import com.example.entity.ChecklistAuditLog;
import com.example.entity.OkDemarrage;
import com.example.entity.Utilisateur;
import com.example.repository.ChecklistAuditLogRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChecklistAuditService {

    private final ChecklistAuditLogRepository auditRepo;
    private final UtilisateurRepository utilisateurRepository;

    public void logAction(OkDemarrage okd,
            String matricule,
            ChecklistAuditLog.Action action,
            String statutAvant,
            String statutApres,
            String details,
            Long planActionId) {
        if (okd == null || okd.getId() == null) {
            return;
        }

        Utilisateur auteur = matricule != null
                ? utilisateurRepository.findByMatricule(matricule).orElse(null)
                : null;

        String machineNom = okd.getMachine() != null ? okd.getMachine().getNom() : null;
        String processusNom = okd.getMachine() != null && okd.getMachine().getProcessus() != null
                ? okd.getMachine().getProcessus().getNom()
                : null;

        ChecklistAuditLog log = ChecklistAuditLog.builder()
                .checklistId(okd.getId())
                .machineNom(machineNom)
                .processusNom(processusNom)
                .utilisateur(auteur)
                .matricule(matricule)
                .dateAction(LocalDateTime.now())
                .action(action)
                .statutAvant(statutAvant)
                .statutApres(statutApres)
                .details(details)
                .planActionId(planActionId)
                .build();

        auditRepo.save(log);
    }

    public List<ChecklistAuditLogDTO> getHistoriqueChecklist(Long checklistId) {
        return auditRepo.findByChecklistIdWithUserOrderByDateActionDesc(checklistId)
                .stream().map(this::toDTO).toList();
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteAllByChecklistId(Long checklistId) {
        auditRepo.deleteByChecklistId(checklistId);
    }

    private ChecklistAuditLogDTO toDTO(ChecklistAuditLog log) {
        ChecklistAuditLogDTO dto = new ChecklistAuditLogDTO();
        dto.setId(log.getId());
        dto.setChecklistId(log.getChecklistId());
        dto.setMachineNom(log.getMachineNom());
        dto.setProcessusNom(log.getProcessusNom());
        dto.setAction(log.getAction());
        dto.setDateAction(log.getDateAction());
        dto.setStatutAvant(log.getStatutAvant());
        dto.setStatutApres(log.getStatutApres());
        dto.setDetails(log.getDetails());
        dto.setPlanActionId(log.getPlanActionId());
        dto.setMatricule(log.getMatricule());
        
        if (log.getUtilisateur() != null) {
            dto.setUtilisateurId(log.getUtilisateur().getId());
            dto.setUtilisateurNom(log.getUtilisateur().getNom());
        }
        return dto;
    }
}