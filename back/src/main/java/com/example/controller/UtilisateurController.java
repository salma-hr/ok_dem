package com.example.controller;

import com.example.dto.CreateUtilisateurRequest;
import com.example.dto.UtilisateurAdminDTO;
import com.example.entity.Role;
import com.example.entity.Utilisateur;
import com.example.repository.RoleRepository;
import com.example.service.ScopeService;
import com.example.service.UtilisateurService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion des utilisateurs, avec hiérarchie de création :
 * - ADMIN (système) : gère tout le monde, tous plants.
 * - ADMIN_PLANT (sous-admin) : gère PPO/CHEF_LIGNE/TECHNICIEN/OPERATEUR/AGENT_QUALITE de SON plant.
 * - CHEF_LIGNE : crée uniquement OPERATEUR/TECHNICIEN de SON plant.
 * Le détail des règles (qui peut créer qui, restriction par plant) est appliqué
 * dans UtilisateurService / ScopeService — le contrôleur ne fait que router.
 */
@RestController
@RequestMapping("/api/admin/utilisateurs")
@RequiredArgsConstructor
@Tag(name = "Gestion Utilisateurs", description = "CRUD utilisateurs et rôles")
@SecurityRequirement(name = "bearerAuth")
public class UtilisateurController {

    private final UtilisateurService utilisateurService;
    private final RoleRepository roleRepository;
    private final ScopeService scopeService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Liste les utilisateurs visibles (filtrés par plant sauf pour l'admin système)")
    public ResponseEntity<List<UtilisateurAdminDTO>> findAll() {
        return ResponseEntity.ok(utilisateurService.findAllAdmin());
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Liste les rôles que l'appelant est autorisé à assigner")
    public ResponseEntity<List<Role>> getRoles() {
        List<Role> all = roleRepository.findAll();
        List<String> assignableNames = scopeService.assignableRoleNames(
                all.stream().map(Role::getNom).toList());
        List<Role> assignable = all.stream()
                .filter(r -> assignableNames.contains(r.getNom()))
                .toList();
        return ResponseEntity.ok(assignable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Récupérer un utilisateur par ID")
    public ResponseEntity<Utilisateur> findById(@PathVariable Long id) {
        return ResponseEntity.ok(utilisateurService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Créer un nouvel utilisateur",
        responses = {
            @ApiResponse(responseCode = "200", description = "Utilisateur créé"),
            @ApiResponse(responseCode = "400", description = "Matricule déjà utilisé, rôle non autorisé, ou plant hors périmètre")
        })
    public ResponseEntity<?> create(@RequestBody CreateUtilisateurRequest request) {
        try {
            return ResponseEntity.ok(utilisateurService.create(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Modifier un utilisateur existant")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody CreateUtilisateurRequest request) {
        try {
            return ResponseEntity.ok(utilisateurService.update(id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PatchMapping("/{id}/reactivate")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Réactiver un utilisateur désactivé")
    public ResponseEntity<?> reactivate(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(utilisateurService.reactivate(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ⚠️ IMPORTANT : /permanent DOIT être déclaré AVANT /{id}
    // pour éviter que Spring interprète "permanent" comme un {id}
    @DeleteMapping("/{id}/permanent")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT')")
    @Operation(summary = "Supprimer définitivement un utilisateur")
    public ResponseEntity<?> hardDelete(@PathVariable Long id) {
        try {
            utilisateurService.hardDelete(id);
            return ResponseEntity.ok("Utilisateur supprimé définitivement");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ADMIN_PLANT','CHEF_LIGNE')")
    @Operation(summary = "Désactiver un utilisateur (soft delete)")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            utilisateurService.delete(id);
            return ResponseEntity.ok("Utilisateur désactivé avec succès");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}