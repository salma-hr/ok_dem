package com.example.service;
 
import com.example.dto.PlantDTO;
import com.example.dto.PlantRequest;
import com.example.entity.Plant;
import com.example.entity.Site;
import com.example.repository.PlantRepository;
import com.example.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
 
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class PlantService {
 
    private final PlantRepository plantRepository;
    private final SiteRepository siteRepository;  
    private final ScopeService scopeService;
 
   private PlantDTO toDTO(Plant p) {
        PlantDTO dto = new PlantDTO();
        dto.setId(p.getId());
        dto.setNom(p.getNom());
        dto.setDescription(p.getDescription());
        if (p.getSite() != null) {
            dto.setSiteId(p.getSite().getId());   // ✅ champ correct
            dto.setSiteNom(p.getSite().getNom()); // ✅ champ correct
        }
        return dto;
    }
    
    public List<PlantDTO> findAll() {
        List<PlantDTO> all = plantRepository.findAllWithSite()
                .stream()
                .map(this::toDTO)
                .toList();
        return scopeService.filterByPlant(all, PlantDTO::getId);
    }
 
    public List<PlantDTO> findBySite(Long siteId) {
        return plantRepository.findBySiteId(siteId)
                .stream()
                .map(this::toDTO)
                .toList();
    }
 
    public PlantDTO create(PlantRequest req) {
       Site site = siteRepository.findById(req.getSiteId())
        .orElseThrow(() -> new RuntimeException("Site introuvable"));
        Plant p = new Plant();
        p.setNom(req.getNom());
        p.setDescription(req.getDescription());
        p.setSite(site);
        return toDTO(plantRepository.save(p));
    }
 
    public PlantDTO update(Long id, PlantRequest req) {
        Plant p = plantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plant introuvable"));
        p.setNom(req.getNom());
        p.setDescription(req.getDescription());
        if (req.getSegmentId() != null) {
            Site site = siteRepository.findById(req.getSegmentId())
                    .orElseThrow(() -> new RuntimeException("Site introuvable"));
            p.setSite(site);
        }
        return toDTO(plantRepository.save(p));
    }
 
    public void delete(Long id) {
        plantRepository.deleteById(id);
    }
}
 