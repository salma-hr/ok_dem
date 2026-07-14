package com.example.service;

import com.example.dto.MachineDTO;
import com.example.dto.MachineRequest;
import com.example.entity.Machine;
import com.example.entity.Plant;
import com.example.entity.Processus;
import com.example.entity.Segment;
import com.example.entity.Site;
import com.example.repository.ChecklistRepository;
import com.example.repository.MachineRepository;
import com.example.repository.PlantRepository;
import com.example.repository.ProcessusRepository;
import com.example.repository.SegmentRepository;
import com.example.repository.SiteRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class MachineService {

    private final MachineRepository    machineRepository;
    private final ProcessusRepository  processusRepository;
    private final SegmentRepository    segmentRepository;
    private final PlantRepository      plantRepository;
    private final SiteRepository       siteRepository;
    private final ChecklistRepository  checklistRepository; // ← AJOUT pour vérifier les checklists liées
    private final ScopeService         scopeService;

    private MachineDTO toDTO(Machine m) {
        MachineDTO dto = new MachineDTO();
        dto.setId(m.getId());
        dto.setNom(m.getNom());
        dto.setDescription(m.getDescription());
        if (m.getProcessus() != null) {
            dto.setProcessusId(m.getProcessus().getId());
            dto.setProcessusNom(m.getProcessus().getNom());
        }
        if (m.getSegment() != null) {
            dto.setSegmentId(m.getSegment().getId());
            dto.setSegmentNom(m.getSegment().getNom());
        }
        if (m.getPlant() != null) {
            dto.setPlantId(m.getPlant().getId());
            dto.setPlantNom(m.getPlant().getNom());
        }
        if (m.getSite() != null) {
            dto.setSiteId(m.getSite().getId());
            dto.setSiteNom(m.getSite().getNom());
        }
        return dto;
    }

    public List<MachineDTO> findAll() {
        List<MachineDTO> all = machineRepository.findAllWithProcessus()
                .stream()
                .map(this::toDTO)
                .toList();
        return scopeService.filterByPlant(all, MachineDTO::getPlantId);
    }

    public List<MachineDTO> findByProcessus(Long processusId) {
        return machineRepository.findByProcessusId(processusId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    // ← CORRECTION : méthode findById maintenant implémentée
    public Machine findById(Long id) {
        return machineRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Machine introuvable : " + id));
    }

    @Transactional
    public MachineDTO create(MachineRequest req) {
        Processus p = processusRepository.findById(req.getProcessusId())
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        Long plantId = req.getPlantId();
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            if (myPlantId == null) {
                throw new RuntimeException("Aucun plant ne vous est assigné : impossible de créer une machine.");
            }
            if (plantId != null && !myPlantId.equals(plantId)) {
                throw new RuntimeException("Vous ne pouvez créer des machines que pour votre propre plant.");
            }
            plantId = myPlantId;
        }
        Machine m = new Machine();
        m.setNom(req.getNom());
        m.setDescription(req.getDescription());
        m.setProcessus(p);
        if (req.getSegmentId() != null) {
            Segment seg = segmentRepository.findById(req.getSegmentId()).orElse(null);
            m.setSegment(seg);
        }
        if (plantId != null) {
            Plant pl = plantRepository.findById(plantId).orElse(null);
            m.setPlant(pl);
        }
        if (req.getSiteId() != null) {
            Site si = siteRepository.findById(req.getSiteId()).orElse(null);
            m.setSite(si);
        }
        return toDTO(machineRepository.save(m));
    }

    @Transactional
    public MachineDTO update(Long id, MachineRequest req) {
        Machine m = machineRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Machine introuvable"));
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            Long currentPlantId = m.getPlant() != null ? m.getPlant().getId() : null;
            if (myPlantId == null || currentPlantId == null || !myPlantId.equals(currentPlantId)) {
                throw new RuntimeException("Accès refusé : cette machine n'appartient pas à votre plant.");
            }
            if (req.getPlantId() != null && !myPlantId.equals(req.getPlantId())) {
                throw new RuntimeException("Vous ne pouvez pas déplacer une machine en dehors de votre plant.");
            }
        }
        m.setNom(req.getNom());
        m.setDescription(req.getDescription());
        if (req.getProcessusId() != null) {
            Processus p = processusRepository.findById(req.getProcessusId())
                    .orElseThrow(() -> new RuntimeException("Processus introuvable"));
            m.setProcessus(p);
        }
        m.setSegment(req.getSegmentId() != null
                ? segmentRepository.findById(req.getSegmentId()).orElse(null) : null);
        m.setPlant(req.getPlantId() != null
                ? plantRepository.findById(req.getPlantId()).orElse(null) : null);
        m.setSite(req.getSiteId() != null
                ? siteRepository.findById(req.getSiteId()).orElse(null) : null);
        return toDTO(machineRepository.save(m));
    }

    @Transactional
    public void delete(Long id) {
        Machine machine = machineRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Machine introuvable : " + id));

        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            Long machinePlantId = machine.getPlant() != null ? machine.getPlant().getId() : null;
            if (myPlantId == null || machinePlantId == null || !myPlantId.equals(machinePlantId)) {
                throw new RuntimeException("Accès refusé : cette machine n'appartient pas à votre plant.");
            }
        }

        // ← CORRECTION : bloquer uniquement si des checklists sont liées à cette machine
        // (données métier critiques). La liaison processus seule n'empêche pas la suppression.
        List<?> checklists = checklistRepository.findByMachineId(id);
        if (!checklists.isEmpty()) {
            throw new RuntimeException(
                "Impossible de supprimer : " + checklists.size() +
                " checklist(s) sont liées à cette machine. Supprimez-les d'abord.");
        }

        // Détacher du processus avant suppression pour éviter les contraintes FK
        machine.setProcessus(null);
        machine.setSegment(null);
        machine.setPlant(null);
        machine.setSite(null);
        machineRepository.save(machine);
        machineRepository.deleteById(id);
    }
}