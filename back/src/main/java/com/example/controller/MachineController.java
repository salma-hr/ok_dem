package com.example.controller;

import com.example.dto.MachineDTO;
import com.example.dto.MachineRequest;
import com.example.service.MachineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/machines")
@RequiredArgsConstructor
public class MachineController {

    private final MachineService machineService;

    @GetMapping
    public ResponseEntity<List<MachineDTO>> getAll() {
        return ResponseEntity.ok(machineService.findAll());
    }

    @GetMapping("/processus/{id}")
    public ResponseEntity<List<MachineDTO>> getByProcessus(@PathVariable Long id) {
        return ResponseEntity.ok(machineService.findByProcessus(id));
    }

    @PostMapping
    public ResponseEntity<MachineDTO> create(@RequestBody MachineRequest req) {
        return ResponseEntity.ok(machineService.create(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MachineDTO> update(@PathVariable Long id,
                                              @RequestBody MachineRequest req) {
        return ResponseEntity.ok(machineService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            // ← CORRECTION : suppression autorisée même si machine liée à un processus.
            // Le service détache la machine du processus avant de supprimer.
            machineService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}