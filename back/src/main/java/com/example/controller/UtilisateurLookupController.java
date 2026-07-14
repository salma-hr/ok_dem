package com.example.controller;

import com.example.dto.UtilisateurLiteDTO;
import com.example.service.UtilisateurService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/utilisateurs")
@RequiredArgsConstructor
@Tag(name = "Utilisateurs (lookup)", description = "Liste des utilisateurs actifs pour selection")
@SecurityRequirement(name = "bearerAuth")
public class UtilisateurLookupController {

    private final UtilisateurService utilisateurService;

    @GetMapping
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','TECHNICIEN','AGENT_QUALITE','ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Liste des utilisateurs actifs (lite)")
    public ResponseEntity<List<UtilisateurLiteDTO>> findActiveLite() {
        return ResponseEntity.ok(utilisateurService.findActiveLite());
    }
}