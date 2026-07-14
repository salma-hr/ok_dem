package com.example.service;
 
import com.example.dto.SegmentDTO;
import com.example.dto.SegmentRequest;
import com.example.entity.Plant;
import com.example.entity.Segment;
import com.example.repository.PlantRepository;
import com.example.repository.SegmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
 
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class SegmentService {
 
    private final SegmentRepository segmentRepository;
    private final PlantRepository plantRepository;  
    private final ScopeService scopeService;
 
    private SegmentDTO toDTO(Segment s) {
        SegmentDTO dto = new SegmentDTO();
        dto.setId(s.getId());
        dto.setNom(s.getNom());
        dto.setDescription(s.getDescription());
        if (s.getPlant() != null) {
            dto.setPlantId(s.getPlant().getId());
            dto.setPlantNom(s.getPlant().getNom());
        }
        return dto;
    }
 
    public List<SegmentDTO> findAll() {
        List<SegmentDTO> all = segmentRepository.findAllWithPlant()
                .stream()
                .map(this::toDTO)
                .toList();
        return scopeService.filterByPlant(all, SegmentDTO::getPlantId);
    }
 
    public SegmentDTO findById(Long id) {
        Segment s = segmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Segment introuvable"));
        return toDTO(s);
    }
 
    public List<SegmentDTO> findByPlant(Long plantId) {
        return segmentRepository.findByPlantId(plantId)
                .stream()
                .map(this::toDTO)
                .toList();
    }
 
    public SegmentDTO create(SegmentRequest req) {
        Plant plant = plantRepository.findById(req.getPlantId())
                .orElseThrow(() -> new RuntimeException("Plant introuvable"));
        Segment s = new Segment();
        s.setNom(req.getNom());
        s.setDescription(req.getDescription());
        s.setPlant(plant);
        return toDTO(segmentRepository.save(s));
    }
 
    public SegmentDTO update(Long id, SegmentRequest req) {
        Segment s = segmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Segment introuvable"));
        s.setNom(req.getNom());
        s.setDescription(req.getDescription());
        if (req.getPlantId() != null) {
            Plant plant = plantRepository.findById(req.getPlantId())
                    .orElseThrow(() -> new RuntimeException("Plant introuvable"));
            s.setPlant(plant);
        }
        return toDTO(segmentRepository.save(s));
    }
 
    public void delete(Long id) {
        segmentRepository.deleteById(id);
    }
}