package com.example.controller;

import com.example.dto.PlanActionDTO;
import com.example.dto.PlanActionRequest;
import com.example.service.PlanActionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/plans-action")
@RequiredArgsConstructor
@Tag(name = "Plans d'action", description = "Gestion des plans d'action correctifs")
@SecurityRequirement(name = "bearerAuth")
public class PlanActionController {

    private final PlanActionService planActionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','TECHNICIEN','AGENT_QUALITE','ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Tous les plans d'action")
    public ResponseEntity<List<PlanActionDTO>> findAll() {
        return ResponseEntity.ok(planActionService.findAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PlanActionDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(planActionService.findById(id));
    }

    @GetMapping("/checklist/{checklistId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Plans d'action d'une checklist")
    public ResponseEntity<List<PlanActionDTO>> findByChecklist(@PathVariable Long checklistId) {
        return ResponseEntity.ok(planActionService.findByChecklist(checklistId));
    }

    @GetMapping("/mes-plans")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Plans d'action assignés à l'utilisateur connecté")
    public ResponseEntity<List<PlanActionDTO>> mesPLans(Authentication auth) {
        return ResponseEntity.ok(planActionService.findByResponsable(auth.getName()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Créer un plan d'action (Chef de ligne)")
    public ResponseEntity<?> creer(@RequestBody PlanActionRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(planActionService.creer(req, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/en-cours")
    @PreAuthorize("hasAnyRole('TECHNICIEN','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Passer un plan d'action en cours")
    public ResponseEntity<?> mettreEnCours(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(planActionService.mettreEnCours(id, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/cloturer")
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','TECHNICIEN','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Clôturer un plan d'action. ROUGE → EN_ATTENTE_VALIDATION_AQ / JAUNE → CLOS par le chef de ligne créateur")
    public ResponseEntity<?> cloturer(
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String commentaire,
            Authentication auth) {
        try {
            return ResponseEntity.ok(planActionService.cloturer(id, commentaire, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/valider-aq")
    @PreAuthorize("hasAnyRole('AGENT_QUALITE','ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Valider le traitement d'un plan d'action ROUGE (Agent Qualité uniquement)")
    public ResponseEntity<?> validerAQ(
            @PathVariable Long id,
            @RequestParam(defaultValue = "") String commentaire,
            Authentication auth) {
        try {
            return ResponseEntity.ok(planActionService.validerAQ(id, commentaire, auth.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    public ResponseEntity<?> supprimer(@PathVariable Long id) {
        try {
            planActionService.supprimer(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Génère automatiquement une suggestion de description de plan d'action
     * pour une checklist donnée, basée sur ses non-conformités (critères ROUGE).
     * Appelé depuis le frontend (chef de ligne / technicien) pour pré-remplir
     * le champ description sans passer par l'API IA côté navigateur.
     */
    @PostMapping("/suggerer-description/{checklistId}")
    @PreAuthorize("hasAnyRole('CHEF_LIGNE','TECHNICIEN','AGENT_QUALITE','ADMIN','ADMIN_PLANT','PPO')")
    @Operation(summary = "Suggère automatiquement une description de plan d'action via IA")
    public ResponseEntity<?> suggererDescription(@PathVariable Long checklistId) {
        try {
            String description = planActionService.suggererDescriptionIA(checklistId);
            return ResponseEntity.ok(Map.of("description", description));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}