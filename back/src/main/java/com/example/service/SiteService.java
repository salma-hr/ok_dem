package com.example.service;

import com.example.dto.SiteDTO;
import com.example.dto.SiteRequest;
import com.example.entity.Site;
import com.example.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class SiteService {

    private final SiteRepository siteRepository;
    private final ScopeService scopeService;

    private SiteDTO toDTO(Site s) {
        SiteDTO dto = new SiteDTO();
        dto.setId(s.getId());
        dto.setNom(s.getNom());
        dto.setAdresse(s.getAdresse());     
        dto.setResponsable(s.getResponsable());
        return dto;
    }

    public List<SiteDTO> findAll() {
        List<SiteDTO> all = siteRepository.findAll()
                .stream()
                .map(this::toDTO)
                .toList();
        return scopeService.filterBySite(all, SiteDTO::getId);
    }

    public SiteDTO findById(Long id) {
        Site s = siteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Site introuvable"));
        return toDTO(s);
    }

    public SiteDTO create(SiteRequest req) {
        Site s = new Site();
        s.setNom(req.getNom());
        s.setAdresse(req.getAdresse());        
        s.setResponsable(req.getResponsable());
        return toDTO(siteRepository.save(s));
    }

    public SiteDTO update(Long id, SiteRequest req) {
        Site s = siteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Site introuvable"));
        s.setNom(req.getNom());
        s.setAdresse(req.getAdresse());          
        s.setResponsable(req.getResponsable());
        return toDTO(siteRepository.save(s));
    }

    public void delete(Long id) {
        siteRepository.deleteById(id);
    }
}