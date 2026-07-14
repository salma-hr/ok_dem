package com.example.controller;
 
import com.example.dto.PlantDTO;
import com.example.dto.PlantRequest;
import com.example.service.PlantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
 
@RestController
@RequestMapping("/api/plants")
@RequiredArgsConstructor
public class PlantController {
 
    private final PlantService plantService;
 
    @GetMapping
    public ResponseEntity<List<PlantDTO>> findAll() {
        return ResponseEntity.ok(plantService.findAll());
    }
 
    // GET /api/plants/site/{siteId}  ← remplace /segment/{segmentId}
    @GetMapping("/site/{siteId}")
    public ResponseEntity<List<PlantDTO>> findBySite(@PathVariable Long siteId) {
        return ResponseEntity.ok(plantService.findBySite(siteId));
    }
 
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> create(@RequestBody PlantRequest req) {
        try {
            return ResponseEntity.ok(plantService.create(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody PlantRequest req) {
        try {
            return ResponseEntity.ok(plantService.update(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        plantService.delete(id);
        return ResponseEntity.noContent().build();
    }
}