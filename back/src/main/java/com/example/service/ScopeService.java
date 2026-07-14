package com.example.service;

import com.example.entity.Utilisateur;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Service central de gestion des droits d'accès par plant/site.
 *
 * Règles générales de la plateforme :
 * - ADMIN (admin système) : accès à toute la plateforme, tous sites, tous plants.
 * - ADMIN_PLANT (sous-admin) : créé par un ADMIN, limité à UN seul plant.
 * - CHEF_LIGNE : limité à son plant, peut créer OPERATEUR / TECHNICIEN de son plant.
 * - Tous les autres rôles (PPO, TECHNICIEN, AGENT_QUALITE, OPERATEUR, ...) :
 * accès en lecture limité aux données de leur propre plant.
 */
@Service
@RequiredArgsConstructor
public class ScopeService {

    /** Rôles considérés comme "admin système" : accès total, aucune restriction de plant. */
    private static final Set<String> SYSTEM_ADMIN_ROLES = Set.of("ADMIN");

    /** Sentinelle utilisée quand un utilisateur scopé n'a aucun plant assigné (ne doit rien voir). */
    public static final Long NO_ACCESS_SENTINEL = -1L;

    private final UtilisateurRepository utilisateurRepository;

    /** Utilisateur actuellement authentifié (via le matricule porté par le JWT), ou null si anonyme. */
    public Utilisateur getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            return null;
        }
        return utilisateurRepository.findByMatricule(auth.getName()).orElse(null);
    }

    public String getCurrentRoleName() {
        Utilisateur u = getCurrentUser();
        return (u != null && u.getRole() != null) ? u.getRole().getNom() : null;
    }

    /** true si personne n'est authentifié (cas des endpoints publics comme /api/sites, /api/plants). */
    public boolean isAnonymous() {
        return getCurrentUser() == null;
    }

    /** true si l'utilisateur connecté a accès à toute la plateforme (aucune restriction de plant/site). */
    public boolean isSystemAdmin() {
        if (isAnonymous()) {
            // Endpoints atteints sans authentification ne sont accessibles que là où
            // SecurityConfig les a explicitement rendus publics (ex: liste des sites/plants
            // à l'inscription) : dans ce cas, pas de restriction applicable.
            return true;
        }
        String role = getCurrentRoleName();
        return role != null && SYSTEM_ADMIN_ROLES.contains(role);
    }

    public boolean isAdminPlant() {
        return "ADMIN_PLANT".equalsIgnoreCase(getCurrentRoleName());
    }

    public boolean isChefLigne() {
        return "CHEF_LIGNE".equalsIgnoreCase(getCurrentRoleName());
    }

    /** Id du plant de l'utilisateur connecté (null si non assigné, sans objet si system admin). */
    public Long getPlantId() {
        Utilisateur u = getCurrentUser();
        return (u != null && u.getPlant() != null) ? u.getPlant().getId() : null;
    }

    public Long getSiteId() {
        Utilisateur u = getCurrentUser();
        return (u != null && u.getSite() != null) ? u.getSite().getId() : null;
    }

    /**
     * Id de plant à utiliser comme filtre dans les requêtes :
     * - null → aucun filtre (admin système, voit tout)
     * - id du plant → filtre normal
     * - NO_ACCESS_SENTINEL (-1) → utilisateur scopé sans plant assigné, ne doit rien voir
     */
    public Long getPlantFilterId() {
        if (isSystemAdmin()) {
            return null;
        }
        Long plantId = getPlantId();
        return plantId != null ? plantId : NO_ACCESS_SENTINEL;
    }

    /** Filtre une liste d'objets pour ne garder que ceux appartenant au plant de l'utilisateur connecté. */
    public <T> List<T> filterByPlant(List<T> items, Function<T, Long> plantIdExtractor) {
        if (isSystemAdmin()) {
            return items;
        }
        Long myPlantId = getPlantId();
        if (myPlantId == null) {
            return List.of();
        }
        return items.stream()
                .filter(item -> myPlantId.equals(plantIdExtractor.apply(item)))
                .collect(Collectors.toList());
    }

    /** Filtre une liste d'objets pour ne garder que ceux appartenant au site de l'utilisateur connecté. */
    public <T> List<T> filterBySite(List<T> items, Function<T, Long> siteIdExtractor) {
        if (isSystemAdmin()) {
            return items;
        }
        Long mySiteId = getSiteId();
        if (mySiteId == null) {
            return List.of();
        }
        return items.stream()
                .filter(item -> mySiteId.equals(siteIdExtractor.apply(item)))
                .collect(Collectors.toList());
    }

    /** Lève une exception si l'utilisateur connecté n'a pas accès au plant donné. */
    public void assertPlantAccess(Long plantId) {
        if (isSystemAdmin()) {
            return;
        }
        Long myPlantId = getPlantId();
        if (myPlantId == null || plantId == null || !myPlantId.equals(plantId)) {
            throw new RuntimeException("Accès refusé : cette ressource n'appartient pas à votre plant.");
        }
    }

    /**
     * Vérifie qu'un utilisateur (créateur) a le droit de créer/gérer un utilisateur du rôle donné.
     * Hiérarchie :
     * ADMIN → tout rôle (ADMIN, ADMIN_PLANT, PPO, CHEF_LIGNE, TECHNICIEN, OPERATEUR, AGENT_QUALITE, ...)
     * ADMIN_PLANT → PPO, CHEF_LIGNE, TECHNICIEN, OPERATEUR, AGENT_QUALITE (pas ADMIN ni ADMIN_PLANT)
     * CHEF_LIGNE → OPERATEUR, TECHNICIEN uniquement
     * autres → aucun
     */
    public boolean canManageRole(String creatorRole, String targetRole) {
        if (creatorRole == null || targetRole == null) {
            return false;
        }
        String creator = creatorRole.toUpperCase();
        String target = targetRole.toUpperCase();

        if (SYSTEM_ADMIN_ROLES.contains(creator)) {
            return true;
        }
        if ("ADMIN_PLANT".equals(creator)) {
            return !SYSTEM_ADMIN_ROLES.contains(target) && !"ADMIN_PLANT".equals(target);
        }
        if ("CHEF_LIGNE".equals(creator)) {
            return "OPERATEUR".equals(target) || "TECHNICIEN".equals(target);
        }
        return false;
    }

    /** Rôles que l'utilisateur connecté est autorisé à assigner à un nouvel utilisateur. */
    public List<String> assignableRoleNames(List<String> allRoleNames) {
        String myRole = getCurrentRoleName();
        return allRoleNames.stream()
                .filter(r -> canManageRole(myRole, r))
                .collect(Collectors.toList());
    }
}
