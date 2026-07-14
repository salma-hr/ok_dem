package com.example.controller;
 
import com.example.dto.SiteDTO;
import com.example.dto.SiteRequest;
import com.example.service.SiteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
 
@RestController
@RequestMapping("/api/sites")
@RequiredArgsConstructor
public class SiteController {
 
    private final SiteService siteService;
 
    @GetMapping
    public ResponseEntity<List<SiteDTO>> findAll() {
        return ResponseEntity.ok(siteService.findAll());
    }
 
    @GetMapping("/{id}")
    public ResponseEntity<SiteDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(siteService.findById(id));
    }
 
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> create(@RequestBody SiteRequest req) {
        try {
            return ResponseEntity.ok(siteService.create(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody SiteRequest req) {
        try {
            return ResponseEntity.ok(siteService.update(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        siteService.delete(id);
        return ResponseEntity.noContent().build();
    }
}