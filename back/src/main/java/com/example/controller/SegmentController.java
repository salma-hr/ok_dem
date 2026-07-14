package com.example.controller;
 
import com.example.dto.SegmentDTO;
import com.example.dto.SegmentRequest;
import com.example.service.SegmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
 
@RestController
@RequestMapping("/api/segments")
@RequiredArgsConstructor
public class SegmentController {
 
    private final SegmentService segmentService;
 
    @GetMapping
    public ResponseEntity<List<SegmentDTO>> findAll() {
        return ResponseEntity.ok(segmentService.findAll());
    }
 
    @GetMapping("/{id}")
    public ResponseEntity<SegmentDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(segmentService.findById(id));
    }
 
    // GET /api/segments/plant/{plantId}  ← nouveau
    @GetMapping("/plant/{plantId}")
    public ResponseEntity<List<SegmentDTO>> findByPlant(@PathVariable Long plantId) {
        return ResponseEntity.ok(segmentService.findByPlant(plantId));
    }
 
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> create(@RequestBody SegmentRequest req) {
        try {
            return ResponseEntity.ok(segmentService.create(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody SegmentRequest req) {
        try {
            return ResponseEntity.ok(segmentService.update(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
 
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        segmentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}