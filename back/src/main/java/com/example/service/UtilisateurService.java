package com.example.service;

import com.example.dto.CreateUtilisateurRequest;
import com.example.dto.UtilisateurAdminDTO;
import com.example.dto.UtilisateurLiteDTO;
import com.example.entity.Processus;
import com.example.entity.Plant;
import com.example.entity.Role;
import com.example.entity.Segment;
import com.example.entity.Site;
import com.example.entity.Utilisateur;
import com.example.repository.OkDemarrageRepository;
import com.example.repository.PasswordResetTokenRepository;
import com.example.repository.ProcessusRepository;
import com.example.repository.ReponseCritereRepository;
import com.example.repository.NotificationRepository;
import com.example.repository.CritereAuditLogRepository;
import com.example.repository.ChecklistAuditLogRepository;
import com.example.repository.PlanActionRepository;
import com.example.repository.PlantRepository;
import com.example.repository.RoleRepository;
import com.example.repository.SegmentRepository;
import com.example.repository.SiteRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UtilisateurService {

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final ProcessusRepository processusRepository;
    private final SiteRepository siteRepository;
    private final PlantRepository plantRepository;
    private final SegmentRepository segmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final OkDemarrageRepository okDemarrageRepository;
    private final ReponseCritereRepository reponseCritereRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final NotificationRepository notificationRepository;
    private final CritereAuditLogRepository critereAuditLogRepository;
    private final ChecklistAuditLogRepository checklistAuditLogRepository;
    private final PlanActionRepository planActionRepository;
    private final ScopeService scopeService;

    public List<Utilisateur> findAll() {
        return utilisateurRepository.findAll();
    }

    /**
     * Liste des utilisateurs visibles par l'appelant sur la page de gestion Utilisateurs :
     * - Si l'appelant a un plant assigné (y compris un ADMIN rattaché à un plant) :
     *   uniquement les utilisateurs de CE plant.
     * - Si l'appelant est ADMIN système SANS plant assigné : vue globale, tous plants confondus.
     * - Si l'appelant est un rôle scopé sans plant assigné : aucun utilisateur visible.
     */
    public List<UtilisateurAdminDTO> findAllAdmin() {
        List<Utilisateur> all = utilisateurRepository.findAll();
        Long myPlantId = scopeService.getPlantId();

        List<Utilisateur> scoped;
        if (myPlantId != null) {
            scoped = all.stream()
                    .filter(u -> u.getPlant() != null && myPlantId.equals(u.getPlant().getId()))
                    .collect(Collectors.toList());
        } else if (scopeService.isSystemAdmin()) {
            scoped = all;
        } else {
            scoped = List.of();
        }

        return scoped.stream()
                .map(this::toAdminDTO)
                .collect(Collectors.toList());
    }

    public List<UtilisateurLiteDTO> findActiveLite() {
        List<UtilisateurLiteDTO> all = utilisateurRepository.findByActifTrueOrderByNomAsc().stream()
                .map(this::toLiteDTO)
                .collect(Collectors.toList());
        return scopeService.filterByPlant(all, UtilisateurLiteDTO::getPlantId);
    }

    public Utilisateur findById(Long id) {
        if (id == null)
            throw new RuntimeException("ID invalide");
        return utilisateurRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
    }

    public Utilisateur create(CreateUtilisateurRequest request) {
        if (utilisateurRepository.existsByMatricule(request.getMatricule())) {
            throw new RuntimeException("Matricule déjà utilisé : " + request.getMatricule());
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new RuntimeException("Rôle introuvable"));

        String creatorRole = scopeService.getCurrentRoleName();
        if (!scopeService.canManageRole(creatorRole, role.getNom())) {
            throw new RuntimeException(
                    "Vous n'êtes pas autorisé à créer un utilisateur avec le rôle " + role.getNom() + ".");
        }

        // Un créateur "scopé" (ADMIN_PLANT, CHEF_LIGNE, ...) ne peut créer que dans SON plant.
        Long siteId = request.getSiteId();
        Long plantId = request.getPlantId();
        Long segmentId = request.getSegmentId();
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            if (myPlantId == null) {
                throw new RuntimeException(
                        "Aucun plant ne vous est assigné : impossible de créer un utilisateur.");
            }
            if (plantId != null && !myPlantId.equals(plantId)) {
                throw new RuntimeException(
                        "Vous ne pouvez créer des utilisateurs que pour votre propre plant.");
            }
            plantId = myPlantId;
            siteId = null; // dérivé automatiquement du plant dans applyAssignment
        }

        Utilisateur user = new Utilisateur();
        user.setNom(request.getNom());
        user.setMatricule(request.getMatricule());
        user.setEmail(request.getEmail()); // ✅ email
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        applyAssignment(user, siteId, plantId, segmentId);
        user.setProcessus(resolveProcessusForRole(role, request.getProcessusId(), null));
        user.setActif(true);

        return utilisateurRepository.save(user);
    }

    public Utilisateur update(Long id, CreateUtilisateurRequest request) {
        Utilisateur user = findById(id);
        assertScopeOnTarget(user);

        if (request.getRoleId() != null) {
            Role targetRole = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new RuntimeException("Rôle introuvable"));
            String creatorRole = scopeService.getCurrentRoleName();
            if (!scopeService.canManageRole(creatorRole, targetRole.getNom())) {
                throw new RuntimeException(
                        "Vous n'êtes pas autorisé à attribuer le rôle " + targetRole.getNom() + ".");
            }
        }

        user.setNom(request.getNom());

        if (request.getMatricule() != null && !request.getMatricule().isBlank()) {
            String newMatricule = request.getMatricule().trim();
            if (!newMatricule.equalsIgnoreCase(user.getMatricule())) {
                utilisateurRepository.findByMatricule(newMatricule)
                        .filter(existing -> !existing.getId().equals(user.getId()))
                        .ifPresent(existing -> {
                            throw new RuntimeException("Matricule déjà utilisé : " + newMatricule);
                        });
                user.setMatricule(newMatricule);
            }
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            user.setEmail(request.getEmail()); // ✅ email
        }

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new RuntimeException("Rôle introuvable"));
            user.setRole(role);
        }

        Long siteId = request.getSiteId();
        Long plantId = request.getPlantId();
        Long segmentId = request.getSegmentId();
        if (!scopeService.isSystemAdmin()) {
            Long myPlantId = scopeService.getPlantId();
            if (plantId != null && myPlantId != null && !myPlantId.equals(plantId)) {
                throw new RuntimeException(
                        "Vous ne pouvez pas déplacer un utilisateur en dehors de votre plant.");
            }
            // Un utilisateur scopé ne peut pas changer le plant/site d'un utilisateur : on garde celui de l'appelant.
            plantId = myPlantId;
            siteId = null;
        }

        applyAssignment(user, siteId, plantId, segmentId);
        user.setProcessus(resolveProcessusForRole(user.getRole(), request.getProcessusId(), user));

        return utilisateurRepository.save(user);
    }

    /** Vérifie que l'appelant (non system admin) a le droit d'agir sur cet utilisateur (même plant). */
    private void assertScopeOnTarget(Utilisateur target) {
        if (scopeService.isSystemAdmin()) {
            return;
        }
        Long myPlantId = scopeService.getPlantId();
        Long targetPlantId = target.getPlant() != null ? target.getPlant().getId() : null;
        if (myPlantId == null || targetPlantId == null || !myPlantId.equals(targetPlantId)) {
            throw new RuntimeException("Accès refusé : cet utilisateur n'appartient pas à votre plant.");
        }
    }

    private void applyAssignment(Utilisateur user, Long siteId, Long plantId, Long segmentId) {
        Site site = null;
        Plant plant = null;
        Segment segment = null;

        if (siteId != null) {
            site = siteRepository.findById(siteId)
                    .orElseThrow(() -> new RuntimeException("Site introuvable"));
        }

        if (plantId != null) {
            plant = plantRepository.findById(plantId)
                    .orElseThrow(() -> new RuntimeException("Plant introuvable"));
            // Plant.site est LAZY : on ne garde jamais le proxy tel quel (il casse la
            // sérialisation JSON une fois la session fermée -> LazyInitializationException,
            // alors que l'utilisateur est déjà enregistré en base à ce stade).
            Long plantSiteId = plant.getSite() != null ? plant.getSite().getId() : null;
            if (site != null && plantSiteId != null && !plantSiteId.equals(site.getId())) {
                throw new RuntimeException("Le plant sélectionné n'appartient pas au site choisi.");
            }
            if (site == null && plantSiteId != null) {
                site = siteRepository.findById(plantSiteId).orElse(null);
            }
        }

        if (segmentId != null) {
            segment = segmentRepository.findById(segmentId)
                    .orElseThrow(() -> new RuntimeException("Segment introuvable"));
            // Segment.plant est également LAZY : même précaution que ci-dessus.
            Long segmentPlantId = segment.getPlant() != null ? segment.getPlant().getId() : null;
            if (plant != null && segmentPlantId != null && !segmentPlantId.equals(plant.getId())) {
                throw new RuntimeException("Le segment sélectionné n'appartient pas au plant choisi.");
            }
            if (plant == null && segmentPlantId != null) {
                plant = plantRepository.findById(segmentPlantId).orElse(null);
            }
            if (site == null && plant != null) {
                Long derivedSiteId = plant.getSite() != null ? plant.getSite().getId() : null;
                if (derivedSiteId != null) {
                    site = siteRepository.findById(derivedSiteId).orElse(null);
                }
            }
        }

        user.setSite(site);
        user.setPlant(plant);
        user.setSegment(segment);
    }

    private Processus resolveProcessusForRole(Role role, Long requestedProcessusId, Utilisateur existingUser) {
        if (!isOperateurRole(role)) {
            return null;
        }

        if (requestedProcessusId != null) {
            return processusRepository.findById(requestedProcessusId)
                    .orElseThrow(() -> new RuntimeException("Processus introuvable"));
        }

        if (existingUser != null && existingUser.getProcessus() != null) {
            return existingUser.getProcessus();
        }

        throw new RuntimeException("Le processus est obligatoire pour le rôle OPERATEUR");
    }

    private boolean isOperateurRole(Role role) {
        return role != null && "OPERATEUR".equalsIgnoreCase(role.getNom());
    }

    public void delete(Long id) {
        Utilisateur user = findById(id);
        assertScopeOnTarget(user);
        user.setActif(false);
        utilisateurRepository.save(user);
    }

    public Utilisateur reactivate(Long id) {
        Utilisateur user = findById(id);
        assertScopeOnTarget(user);
        user.setActif(true);
        return utilisateurRepository.save(user);
    }

    private UtilisateurLiteDTO toLiteDTO(Utilisateur user) {
        UtilisateurLiteDTO dto = new UtilisateurLiteDTO();
        dto.setId(user.getId());
        dto.setNom(user.getNom());
        dto.setMatricule(user.getMatricule());
        dto.setEmail(user.getEmail());
        if (user.getRole() != null) {
            dto.setRole(user.getRole().getNom());
        }
        if (user.getPlant() != null) {
            dto.setPlantId(user.getPlant().getId());
        }
        return dto;
    }

    private UtilisateurAdminDTO toAdminDTO(Utilisateur user) {
        UtilisateurAdminDTO dto = new UtilisateurAdminDTO();
        dto.setId(user.getId());
        dto.setNom(user.getNom());
        dto.setMatricule(user.getMatricule());
        dto.setEmail(user.getEmail());
        dto.setActif(user.getActif());

        dto.setRole(toRef(user.getRole() != null ? user.getRole().getId() : null,
                user.getRole() != null ? user.getRole().getNom() : null));
        dto.setProcessus(toRef(user.getProcessus() != null ? user.getProcessus().getId() : null,
                user.getProcessus() != null ? user.getProcessus().getNom() : null));
        dto.setSite(toRef(user.getSite() != null ? user.getSite().getId() : null,
                user.getSite() != null ? user.getSite().getNom() : null));
        dto.setPlant(toRef(user.getPlant() != null ? user.getPlant().getId() : null,
                user.getPlant() != null ? user.getPlant().getNom() : null));
        dto.setSegment(toRef(user.getSegment() != null ? user.getSegment().getId() : null,
            user.getSegment() != null ? user.getSegment().getNom() : null));

        return dto;
    }

    private UtilisateurAdminDTO.RefDTO toRef(Long id, String nom) {
        if (id == null && (nom == null || nom.isBlank())) {
            return null;
        }
        UtilisateurAdminDTO.RefDTO ref = new UtilisateurAdminDTO.RefDTO();
        ref.setId(id);
        ref.setNom(nom);
        return ref;
    }

    @Transactional
    public void hardDelete(Long id) {
        if (id == null)
            throw new RuntimeException("ID invalide");

        Utilisateur target = findById(id);
        assertScopeOnTarget(target);

        // 1. Supprimer les tokens de reset de mot de passe liés
        passwordResetTokenRepository.deleteByUtilisateurId(id);

        // 1.b Supprimer les notifications destinées à cet utilisateur
        notificationRepository.deleteByDestinataireId(id);

        // 1.c Supprimer les traces d'audit liées à cet utilisateur
        critereAuditLogRepository.deleteByUtilisateurId(id);
        checklistAuditLogRepository.deleteByUtilisateurId(id);

        // 1.d Détacher l'utilisateur des plans d'action où il est responsable
        planActionRepository.clearResponsableReferences(id);

        // 1.e Supprimer les plans d'action liés aux checklists opérateur de cet utilisateur
        planActionRepository.deleteByOkDemarrageOperateurId(id);

        // 2. Supprimer d'abord les réponses liées aux checklists de l'opérateur
        // pour respecter la contrainte FK reponse_critere -> ok_demarrage.
        reponseCritereRepository.deleteByOkDemarrageOperateurId(id);

        // 3. Supprimer les checklists où l'utilisateur est opérateur (relation obligatoire)
        // puis nettoyer les autres références optionnelles.
        okDemarrageRepository.deleteByOperateurId(id);
        okDemarrageRepository.clearValideN1ParReferences(id);
        okDemarrageRepository.clearValideN2ParReferences(id);
        okDemarrageRepository.clearValideParFinalReferences(id);
        okDemarrageRepository.clearRejeteParReferences(id);

        // 4. Supprimer l'utilisateur
        utilisateurRepository.deleteById(id);
    }
}