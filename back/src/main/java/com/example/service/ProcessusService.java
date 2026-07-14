package com.example.service;

import com.example.dto.ProcessusDTO;
import com.example.dto.ProcessusRequest;
import com.example.entity.Critere;
import com.example.entity.Machine;
import com.example.entity.OkDemarrage;
import com.example.entity.PlanAction;
import com.example.entity.Processus;
import com.example.entity.Segment;
import com.example.repository.CritereRepository;
import com.example.repository.ChecklistRepository;
import com.example.repository.MachineRepository;
import com.example.repository.PlanActionRepository;
import com.example.repository.ProcessusRepository;
import com.example.repository.SegmentRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class ProcessusService {

    private final ProcessusRepository processusRepository;
    private final SegmentRepository segmentRepository;
    private final MachineRepository machineRepository;
    private final CritereRepository critereRepository;
    private final ChecklistRepository checklistRepository;
    private final PlanActionRepository planActionRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final ScopeService scopeService;

    private ProcessusDTO toDTO(Processus p) {
        ProcessusDTO dto = new ProcessusDTO();
        dto.setId(p.getId());
        dto.setNom(p.getNom());
        dto.setDescription(p.getDescription());
        if (p.getSegment() != null) {
            dto.setSegmentId(p.getSegment().getId());
            dto.setSegmentNom(p.getSegment().getNom());
            if (p.getSegment().getPlant() != null) {
                dto.setPlantId(p.getSegment().getPlant().getId());
                dto.setPlantNom(p.getSegment().getPlant().getNom());
            }
        }
        return dto;
    }

    public List<ProcessusDTO> findAll() {
        List<ProcessusDTO> all = processusRepository.findAllWithSegmentAndMachineCount()
                .stream()
                .map(row -> {
                    Processus p = (Processus) row[0];
                    long count = (long) row[1];
                    ProcessusDTO dto = toDTO(p); // toDTO() normal inchangé
                    dto.setMachineCount((int) count); // on injecte le count ici
                    return dto;
                })
                .toList();
        return scopeService.filterByPlant(all, ProcessusDTO::getPlantId);
    }

    public ProcessusDTO findById(Long id) {
        Processus p = processusRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        return toDTO(p);
    }

    public List<ProcessusDTO> findBySegment(Long segmentId) {
        return processusRepository.findBySegmentId(segmentId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional
    public ProcessusDTO create(ProcessusRequest req) {
        if (req.getSegmentId() == null) {
            throw new RuntimeException("Le segment est obligatoire");
        }
        Segment segment = segmentRepository.findById(req.getSegmentId())
                .orElseThrow(() -> new RuntimeException("Segment introuvable"));
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            Long segmentPlantId = segment.getPlant() != null ? segment.getPlant().getId() : null;
            if (myPlantId == null || segmentPlantId == null || !myPlantId.equals(segmentPlantId)) {
                throw new RuntimeException("Vous ne pouvez créer un processus que dans un segment de votre propre plant.");
            }
        }
        Processus p = new Processus();
        p.setNom(req.getNom());
        p.setDescription(req.getDescription());
        p.setSegment(segment);
        return toDTO(processusRepository.save(p));
    }

    @Transactional
    public ProcessusDTO update(Long id, ProcessusRequest req) {
        Processus p = processusRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            Long currentPlantId = (p.getSegment() != null && p.getSegment().getPlant() != null)
                    ? p.getSegment().getPlant().getId() : null;
            if (myPlantId == null || currentPlantId == null || !myPlantId.equals(currentPlantId)) {
                throw new RuntimeException("Accès refusé : ce processus n'appartient pas à votre plant.");
            }
        }
        p.setNom(req.getNom());
        p.setDescription(req.getDescription());
        if (req.getSegmentId() != null) {
            Segment segment = segmentRepository.findById(req.getSegmentId())
                    .orElseThrow(() -> new RuntimeException("Segment introuvable"));
            if (!scopeService.isSystemAdmin()) {
                Long myPlantId = scopeService.getPlantId();
                Long newSegmentPlantId = segment.getPlant() != null ? segment.getPlant().getId() : null;
                if (myPlantId == null || newSegmentPlantId == null || !myPlantId.equals(newSegmentPlantId)) {
                    throw new RuntimeException("Vous ne pouvez déplacer ce processus que vers un segment de votre propre plant.");
                }
            }
            p.setSegment(segment);
        }
        return toDTO(processusRepository.save(p));
    }

    @Transactional
    public String delete(Long id) {
        Processus processus = processusRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));

        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            Long processusPlantId = (processus.getSegment() != null && processus.getSegment().getPlant() != null)
                    ? processus.getSegment().getPlant().getId() : null;
            if (myPlantId == null || processusPlantId == null || !myPlantId.equals(processusPlantId)) {
                throw new RuntimeException("Accès refusé : ce processus n'appartient pas à votre plant.");
            }
        }

        List<Machine> machinesToDelete = machineRepository.findByProcessusId(id);
        List<OkDemarrage> checklistsToDelete = machinesToDelete.stream()
                .flatMap(machine -> checklistRepository.findByMachineId(machine.getId()).stream())
                .toList();
        List<PlanAction> plansToDelete = checklistsToDelete.stream()
                .flatMap(checklist -> planActionRepository.findByOkDemarrageIdOrderByCreeLe(checklist.getId()).stream())
                .toList();
        List<Critere> criteresToDelete = critereRepository.findByProcessusId(id);
        var utilisateursToDetach = utilisateurRepository.findByProcessusId(id);

        if (!utilisateursToDetach.isEmpty()) {
            utilisateursToDetach.forEach(u -> u.setProcessus(null));
            utilisateurRepository.saveAll(utilisateursToDetach);
        }

        if (!plansToDelete.isEmpty()) {
            planActionRepository.deleteAll(plansToDelete);
        }
        if (!checklistsToDelete.isEmpty()) {
            checklistRepository.deleteAll(checklistsToDelete);
        }
        if (!machinesToDelete.isEmpty()) {
            machineRepository.deleteAll(machinesToDelete);
        }
        if (!criteresToDelete.isEmpty()) {
            critereRepository.deleteAll(criteresToDelete);
        }

        try {
            processusRepository.delete(processus);
        } catch (DataIntegrityViolationException e) {
            throw new RuntimeException("Suppression impossible : des données dépendantes existent encore.");
        }

        return "Processus supprimé avec "
                + machinesToDelete.size() + " machine(s), "
                + checklistsToDelete.size() + " checklist(s), "
                + plansToDelete.size() + " plan(s) d'action et "
                + criteresToDelete.size() + " critère(s) supprimés, "
                + utilisateursToDetach.size() + " utilisateur(s) détaché(s).";
    }
}
