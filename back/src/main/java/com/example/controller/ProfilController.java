package com.example.controller;

import com.example.dto.UpdateProfilRequest;
import com.example.entity.Utilisateur;
import com.example.repository.UtilisateurRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profil")
@RequiredArgsConstructor
@Tag(name = "Mon Profil", description = "Consultation et mise à jour du profil connecté")
@SecurityRequirement(name = "bearerAuth")
public class ProfilController {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * GET /api/profil/me — Récupérer le profil de l'utilisateur connecté
     */
    @GetMapping("/me")
    @Operation(summary = "Récupérer son propre profil")
    public ResponseEntity<?> getMonProfil(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("Non authentifié");
        }
        // Le principal est le matricule (String) posé par JwtAuthFilter
        String matricule = authentication.getName();
        Utilisateur user = utilisateurRepository.findByMatricule(matricule)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
        // Masquer le mot de passe dans la réponse
        user.setPassword(null);
        boolean isAdmin = authentication.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))
            || authentication.getAuthorities().stream().anyMatch(a -> "ADMIN".equalsIgnoreCase(a.getAuthority()));
        if (!isAdmin) {
            user.setSite(null);
            user.setPlant(null);
            user.setSegment(null);
        }
        return ResponseEntity.ok(user);
    }

    /**
     * PUT /api/profil/me — Mettre à jour son propre profil (nom, email, password)
     */
    @PutMapping("/me")
    @Operation(summary = "Mettre à jour son propre profil")
    public ResponseEntity<?> updateMonProfil(
            Authentication authentication,
            @RequestBody UpdateProfilRequest request) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("Non authentifié");
        }

        String matricule = authentication.getName();
        Utilisateur user = utilisateurRepository.findByMatricule(matricule)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        if (request.getNom() != null && !request.getNom().isBlank()) {
            user.setNom(request.getNom());
        }
        if (request.getEmail() != null) {
            user.setEmail(request.getEmail());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            if (request.getPassword().length() < 6) {
                return ResponseEntity.badRequest().body("Le mot de passe doit contenir au moins 6 caractères.");
            }
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        Utilisateur saved = utilisateurRepository.save(user);
        saved.setPassword(null); // ne jamais retourner le hash
        return ResponseEntity.ok(saved);
    }
}