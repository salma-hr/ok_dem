package com.example.service;

import com.example.dto.PlanActionDTO;
import com.example.dto.PlanActionRequest;
import com.example.entity.ChecklistAuditLog;
import com.example.entity.Machine;
import com.example.entity.OkDemarrage;
import com.example.entity.PlanAction;
import com.example.entity.ReponseCritere;
import com.example.entity.Utilisateur;
import com.example.repository.OkDemarrageRepository;
import com.example.repository.PlanActionRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Comparator;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanActionService {

    private final PlanActionRepository planActionRepository;
    private final OkDemarrageRepository okDemarrageRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final NotificationService notificationService;
    private final ChecklistAuditService checklistAuditService;
    private final GroqService groqService;
    private final ScopeService scopeService;

    // ── Lecture ──────────────────────────────────────────────────────────────

    public List<PlanActionDTO> findAll() {
        List<PlanActionDTO> all = planActionRepository.findAllWithDetails()
                .stream()
                .map(this::toDTO)
                .filter(Objects::nonNull)
                .toList();
        return scopeService.filterByPlant(all, PlanActionDTO::getPlantId);
    }

    /** Résout le plant d'une machine en suivant machine → segment → processus (premier non-null trouvé). */
    private Long resolvePlantId(Machine machine) {
        if (machine == null)
            return null;
        if (machine.getPlant() != null)
            return machine.getPlant().getId();
        if (machine.getSegment() != null && machine.getSegment().getPlant() != null)
            return machine.getSegment().getPlant().getId();
        if (machine.getProcessus() != null && machine.getProcessus().getSegment() != null
                && machine.getProcessus().getSegment().getPlant() != null)
            return machine.getProcessus().getSegment().getPlant().getId();
        return null;
    }

    public List<PlanActionDTO> findByChecklist(Long checklistId) {
        return planActionRepository.findByOkDemarrageIdOrderByCreeLe(checklistId)
                .stream().map(this::toDTO).toList();
    }

    public List<PlanActionDTO> findByResponsable(String matricule) {
        return planActionRepository.findByResponsableMatricule(matricule)
                .stream()
                .map(this::toDTO)
                .filter(Objects::nonNull)
                .toList();
    }

    public PlanActionDTO findById(Long id) {
        return toDTO(planActionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plan d'action introuvable : " + id)));
    }

    // ── Création manuelle (web) ───────────────────────────────────────────────

    @Transactional
    public PlanActionDTO creer(PlanActionRequest req, String creeParMatricule) {
        if (req.getDescription() == null || req.getDescription().isBlank())
            throw new RuntimeException("La description est obligatoire.");
        boolean isAutres = (req.getResponsableMatricule() != null
                && "AUTRES".equalsIgnoreCase(req.getResponsableMatricule().trim()))
                || (req.getResponsableMatricule() == null || req.getResponsableMatricule().isBlank())
                        && req.getResponsableAutre() != null && !req.getResponsableAutre().isBlank();
        if (!isAutres && (req.getResponsableMatricule() == null || req.getResponsableMatricule().isBlank()))
            throw new RuntimeException("Le responsable est obligatoire.");
        if (isAutres && (req.getResponsableAutre() == null || req.getResponsableAutre().isBlank()))
            throw new RuntimeException(
                    "Le champ 'Autres' est obligatoire lorsque le responsable hors plateforme est sélectionné.");
        if (req.getDateEcheance() == null)
            throw new RuntimeException("La date d'échéance est obligatoire.");

        OkDemarrage checklist = okDemarrageRepository.findById(req.getChecklistId())
                .orElseThrow(() -> new RuntimeException("Checklist introuvable."));

        Utilisateur responsable = isAutres ? null
                : utilisateurRepository
                        .findByMatricule(req.getResponsableMatricule()).orElse(null);
        String responsableNom = isAutres
                ? req.getResponsableAutre().trim()
                : (responsable != null ? responsable.getNom() : req.getResponsableMatricule());

        // Couleur détermine le workflow : ROUGE → validation AQ requise / JAUNE → non
        // Recalcul depuis les vraies réponses en base (ne pas faire confiance au
        // frontend)
        boolean hasRouge = checklist.getReponses() != null &&
                checklist.getReponses().stream()
                        .anyMatch(r -> r.getValeur() == ReponseCritere.Valeur.ROUGE);
        String couleur = hasRouge ? "ROUGE" : "JAUNE";

        PlanAction pa = PlanAction.builder()
                .okDemarrage(checklist)
                .description(req.getDescription())
                .responsable(responsable)
                .responsableMatricule(isAutres ? null : req.getResponsableMatricule())
                .responsableNom(responsableNom)
                .responsableAutre(isAutres ? req.getResponsableAutre().trim() : null)
                .dateEcheance(req.getDateEcheance())
                .statut(PlanAction.Statut.OUVERT)
                .priorite(req.getPriorite() != null ? req.getPriorite() : PlanAction.Priorite.NORMALE)
                .couleurCritere(couleur)
                .creeParMatricule(creeParMatricule)
                .build();

        PlanAction saved = planActionRepository.save(pa);

        checklistAuditService.logAction(
                checklist,
                creeParMatricule,
                ChecklistAuditLog.Action.PLAN_ACTION_CREE,
                null,
                saved.getStatut() != null ? saved.getStatut().name() : null,
                "Plan d'action #" + saved.getId() + " cree (" + couleur + ")",
                saved.getId());

        if (responsable != null) {
            String machineNom = checklist.getMachine() != null ? checklist.getMachine().getNom() : "?";
            String dateEch = req.getDateEcheance() != null ? req.getDateEcheance().toString() : "—";
            notificationService.notifyPlanActionAssigne(
                    responsable,
                    saved.getId(),
                    checklist.getId(),
                    machineNom,
                    req.getDescription() != null ? req.getDescription() : "",
                    dateEch);
        }

        return toDTO(saved);
    }

    // ── Suggestion IA depuis le frontend ─────────────────────────────────────

    /**
     * Génère une description de plan d'action pour toutes les NC d'une checklist.
     * Utilisé par le frontend pour pré-remplir le formulaire (sans appel IA côté
     * navigateur).
     */
    public String suggererDescriptionIA(Long checklistId) {
        OkDemarrage checklist = okDemarrageRepository.findById(checklistId)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable : " + checklistId));

        if (checklist.getReponses() == null || checklist.getReponses().isEmpty())
            return "";

        // Include both ROUGE and JAUNE non-conformities for suggestion generation
        List<ReponseCritere> nonConformes = checklist.getReponses()
                .stream()
                .filter(r -> r.getValeur() == ReponseCritere.Valeur.ROUGE
                        || r.getValeur() == ReponseCritere.Valeur.JAUNE)
                .toList();

        if (nonConformes.isEmpty())
            return "";

        // Construire la liste des NC pour le prompt
        StringBuilder listeNC = new StringBuilder();
        for (int i = 0; i < nonConformes.size(); i++) {
            ReponseCritere r = nonConformes.get(i);
            String nom = r.getCritere() != null ? r.getCritere().getNom() : "Critère inconnu";
            String type = (r.getCritere() != null && r.getCritere().getType() != null)
                    ? r.getCritere().getType().name()
                    : "TECHNIQUE";
            String desc = r.getCritere() != null ? r.getCritere().getDescription() : null;
            listeNC.append(i + 1).append(". ").append(nom)
                    .append(" [").append(type).append("]");
            if (r.getCommentaire() != null && !r.getCommentaire().isBlank())
                listeNC.append(" (remarque : ").append(r.getCommentaire()).append(")");
            listeNC.append("\n");
            // Générer via Groq pour la première NC et enrichir si plusieurs
        }

        // Utiliser la NC la plus critique (SECURITE > QUALITE > TECHNIQUE)
        ReponseCritere principale = nonConformes.stream()
                .max((a, b) -> {
                    int pa = typePriorite(a), pb = typePriorite(b);
                    return Integer.compare(pa, pb);
                }).orElse(nonConformes.get(0));

        String nomPrincipal = principale.getCritere() != null ? principale.getCritere().getNom() : "Critère";
        String typePrincipal = (principale.getCritere() != null && principale.getCritere().getType() != null)
                ? principale.getCritere().getType().name()
                : "TECHNIQUE";
        String descPrincipal = principale.getCritere() != null ? principale.getCritere().getDescription() : null;

        String base = groqService.genererDescriptionPlanAction(nomPrincipal, typePrincipal, descPrincipal);

        // Si plusieurs NC, ajouter une mention
        if (nonConformes.size() > 1) {
            base = base + "\n\nAutres non-conformités à traiter : " + listeNC.toString().trim();
        }

        return base;
    }

    private int typePriorite(ReponseCritere r) {
        if (r.getCritere() == null || r.getCritere().getType() == null)
            return 0;
        return switch (r.getCritere().getType().name()) {
            case "SECURITE" -> 3;
            case "QUALITE" -> 2;
            case "TECHNIQUE" -> 1;
            default -> 0;
        };
    }

    // ── Génération automatique à la soumission ────────────────────────────────

    @Transactional
    public void genererPlansActionAuto(OkDemarrage checklist) {
        if (checklist.getReponses() == null || checklist.getReponses().isEmpty())
            return;

        // Génération auto pour ROUGE et JAUNE
        List<ReponseCritere> nonConformes = checklist.getReponses()
                .stream()
                .filter(r -> r.getValeur() == ReponseCritere.Valeur.ROUGE
                        || r.getValeur() == ReponseCritere.Valeur.JAUNE)
                .toList();

        if (nonConformes.isEmpty())
            return;

        log.info("Génération auto de {} plan(s) d'action pour checklist #{}",
                nonConformes.size(), checklist.getId());

        Utilisateur technicien = trouverTechnicienProcessus(checklist);

        for (ReponseCritere reponse : nonConformes) {
            try {
                String critereNom = reponse.getCritere() != null ? reponse.getCritere().getNom() : "Critère inconnu";
                String critereDesc = reponse.getCritere() != null ? reponse.getCritere().getDescription() : null;
                String critereType = (reponse.getCritere() != null && reponse.getCritere().getType() != null)
                        ? reponse.getCritere().getType().name()
                        : "TECHNIQUE";

                // ROUGE → validation AQ requise · JAUNE → clôture technicien suffit
                String couleur = reponse.getValeur().name(); // "ROUGE" ou "JAUNE"

                String description = groqService.genererDescriptionPlanAction(critereNom, critereType, critereDesc);

                PlanAction.Priorite priorite = switch (critereType) {
                    case "SECURITE" -> PlanAction.Priorite.CRITIQUE;
                    case "QUALITE" -> PlanAction.Priorite.HAUTE;
                    default -> PlanAction.Priorite.NORMALE;
                };

                PlanAction plan = PlanAction.builder()
                        .okDemarrage(checklist)
                        .description(description)
                        .responsable(technicien)
                        .responsableMatricule(technicien != null ? technicien.getMatricule() : null)
                        .responsableNom(technicien != null ? technicien.getNom() : "À assigner")
                        .dateEcheance(LocalDate.now().plusDays(3))
                        .priorite(priorite)
                        .statut(PlanAction.Statut.OUVERT)
                        .couleurCritere(couleur)
                        .creeParMatricule("SYSTEM")
                        .build();

                PlanAction saved = planActionRepository.save(plan);

                if (technicien != null) {
                    String machineNom = checklist.getMachine() != null ? checklist.getMachine().getNom() : "?";
                    notificationService.notifyPlanActionAssigne(
                            technicien,
                            saved.getId(),
                            checklist.getId(),
                            machineNom,
                            description,
                            saved.getDateEcheance().toString());
                }

                log.info("Plan d'action auto #{} créé pour critère '{}' ({})", saved.getId(), critereNom, couleur);

            } catch (Exception e) {
                log.error("Erreur génération plan auto pour reponse #{}: {}", reponse.getId(), e.getMessage());
            }
        }
    }

    // ── Mise à jour statut ────────────────────────────────────────────────────

    @Transactional
    public PlanActionDTO mettreEnCours(Long id, String matricule) {
        PlanAction pa = getOrThrow(id);
        if (pa.getStatut() == PlanAction.Statut.CLOS
                || pa.getStatut() == PlanAction.Statut.VALIDE_AQ
                || pa.getStatut() == PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ)
            throw new RuntimeException("Ce plan d'action est déjà clôturé ou en attente de validation AQ.");
        String before = pa.getStatut() != null ? pa.getStatut().name() : null;
        pa.setStatut(PlanAction.Statut.EN_COURS);
        PlanAction saved = planActionRepository.save(pa);
        if (saved.getOkDemarrage() != null) {
            checklistAuditService.logAction(
                    saved.getOkDemarrage(), matricule,
                    ChecklistAuditLog.Action.PLAN_ACTION_EN_COURS,
                    before, saved.getStatut().name(),
                    "Plan d'action #" + saved.getId() + " mis en cours",
                    saved.getId());
        }
        return toDTO(saved);
    }

    @Transactional
    public PlanActionDTO cloturer(Long id, String commentaire, String matricule) {
        PlanAction pa = getOrThrow(id);
        Utilisateur acteur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        if (acteur == null)
            throw new RuntimeException("Utilisateur introuvable pour la clôture du plan d'action.");
        String role = acteur.getRole() != null ? acteur.getRole().getNom() : "";
        boolean estRouge = "ROUGE".equalsIgnoreCase(pa.getCouleurCritere());

        boolean isAutresPlan = (pa.getResponsableAutre() != null && !pa.getResponsableAutre().isBlank())
                || (pa.getResponsableMatricule() != null
                        && "AUTRES".equalsIgnoreCase(pa.getResponsableMatricule()));
        boolean isAdmin = "ADMIN".equalsIgnoreCase(role);
        boolean isCreatorChef = "CHEF_LIGNE".equalsIgnoreCase(role)
                && pa.getCreeParMatricule() != null && !pa.getCreeParMatricule().isBlank()
                && pa.getCreeParMatricule().equalsIgnoreCase(matricule);
        boolean isTechnicienAssigned = "TECHNICIEN".equalsIgnoreCase(role)
                && !isAutresPlan
                && (pa.getResponsableMatricule() == null || pa.getResponsableMatricule().isBlank()
                        || pa.getResponsableMatricule().equalsIgnoreCase(matricule));

        if (estRouge) {
            if (!(isTechnicienAssigned || (isCreatorChef && isAutresPlan) || isAdmin)) {
                throw new RuntimeException(
                        "Seul le technicien assigné, ou le chef de ligne créateur pour un plan AUTRES, peut clôturer un plan d'action ROUGE.");
            }
        }

        if (!estRouge) {
            if (!(isCreatorChef || isAdmin))
                throw new RuntimeException(
                        "Seul le chef de ligne créateur du plan d'action JAUNE, ou un administrateur, peut le clôturer.");
        }

        if (pa.getStatut() == PlanAction.Statut.CLOS
                || pa.getStatut() == PlanAction.Statut.VALIDE_AQ
                || pa.getStatut() == PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ)
            throw new RuntimeException(
                    "Ce plan d'action est déjà clôturé ou en attente de validation Agent Qualité.");

        String before = pa.getStatut() != null ? pa.getStatut().name() : null;

        if (estRouge) {
            // ROUGE → traitement clôturé, puis passage en attente AQ
            pa.setStatut(PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ);
            pa.setClosLe(LocalDateTime.now());
            pa.setCommentaireCloture(commentaire);
        } else {
            // JAUNE → clôture définitive par le chef de ligne créateur, pas besoin d'AQ
            pa.setStatut(PlanAction.Statut.CLOS);
            pa.setClosLe(LocalDateTime.now());
            pa.setCommentaireCloture(commentaire);
        }

        PlanAction saved = planActionRepository.save(pa);

        if (saved.getOkDemarrage() != null) {
            checklistAuditService.logAction(
                    saved.getOkDemarrage(), matricule,
                    ChecklistAuditLog.Action.PLAN_ACTION_CLOTURE,
                    before, saved.getStatut().name(),
                    "Plan d'action #" + saved.getId()
                            + (estRouge ? " traité par technicien — en attente validation AQ"
                                    : " clôturé (critère jaune)"),
                    saved.getId());
        }

        // Notifier le créateur du plan
        Utilisateur createur = utilisateurRepository.findByMatricule(pa.getCreeParMatricule()).orElse(null);
        if (createur != null) {
            String msg = estRouge
                    ? "Le plan d'action #" + id + " a été traité par " + matricule
                            + ". En attente de votre validation (Agent Qualité)."
                    : "Le plan d'action #" + id + " a été clôturé par " + matricule + ".";
            notificationService.notifyUser(
                    createur,
                    estRouge ? "⏳ Plan d'action traité — validation AQ requise"
                            : "✅ Plan d'action clôturé",
                    msg,
                    estRouge ? "info" : "success",
                    pa.getOkDemarrage() != null ? pa.getOkDemarrage().getId() : null);
        }

        // Si ROUGE : notifier les agents qualité
        if (estRouge) {
            try {
                notificationService.notifyRoles(
                        List.of("AGENT_QUALITE", "ADMIN"),
                        "✅ Validation AQ requise — Plan d'action #" + id,
                        "Le technicien " + matricule + " a traité le plan d'action #" + id
                                + ". Veuillez valider le traitement (critère ROUGE).",
                        "info",
                        pa.getOkDemarrage() != null ? pa.getOkDemarrage().getId() : null,
                        matricule);
            } catch (Exception e) {
                log.warn("Notification AQ échouée : {}", e.getMessage());
            }
        }

        return toDTO(saved);
    }

    // ── Validation Agent Qualité (critère ROUGE uniquement) ───────────────────

    @Transactional
    public PlanActionDTO validerAQ(Long id, String commentaire, String matricule) {
        PlanAction pa = getOrThrow(id);

        if (pa.getStatut() != PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ)
            throw new RuntimeException(
                    "Ce plan d'action n'est pas en attente de validation Agent Qualité. "
                            + "Statut actuel : " + pa.getStatut());

        if (!"ROUGE".equalsIgnoreCase(pa.getCouleurCritere()))
            throw new RuntimeException(
                    "Seuls les plans d'action issus d'un critère ROUGE nécessitent une validation AQ.");

        String before = pa.getStatut().name();
        pa.setStatut(PlanAction.Statut.VALIDE_AQ);
        pa.setValideAqLe(LocalDateTime.now());
        pa.setValideAqParMatricule(matricule);
        pa.setCommentaireValidationAq(commentaire);

        PlanAction saved = planActionRepository.save(pa);

        if (saved.getOkDemarrage() != null) {
            checklistAuditService.logAction(
                    saved.getOkDemarrage(), matricule,
                    ChecklistAuditLog.Action.PLAN_ACTION_VALIDE_AQ,
                    before, saved.getStatut().name(),
                    "Plan d'action #" + saved.getId() + " validé par Agent Qualité",
                    saved.getId());
        }

        // Notifier le créateur (chef de ligne) et le responsable (technicien)
        for (String mat : java.util.Arrays.asList(pa.getCreeParMatricule(), pa.getResponsableMatricule())) {
            if (mat == null)
                continue;
            Utilisateur dest = utilisateurRepository.findByMatricule(mat).orElse(null);
            if (dest == null)
                continue;
            notificationService.notifyUser(
                    dest,
                    "✅ Plan d'action validé par l'Agent Qualité",
                    "Le plan d'action #" + id + " (critère ROUGE) a été validé par l'Agent Qualité "
                            + matricule + ".",
                    "success",
                    pa.getOkDemarrage() != null ? pa.getOkDemarrage().getId() : null);
        }

        return toDTO(saved);
    }

    @Transactional
    public void supprimer(Long id) {
        PlanAction pa = planActionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plan d'action introuvable : " + id));
        if (pa.getOkDemarrage() != null) {
            checklistAuditService.logAction(
                    pa.getOkDemarrage(), null,
                    ChecklistAuditLog.Action.PLAN_ACTION_SUPPRIME,
                    pa.getStatut() != null ? pa.getStatut().name() : null,
                    "SUPPRIME",
                    "Plan d'action #" + pa.getId() + " supprime",
                    pa.getId());
        }
        planActionRepository.delete(pa);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Removes plans d'action whose checklist (okDemarrage) has been deleted.
     * Prevents EntityNotFoundException when accessing lazy-loaded orphan
     * references.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void cleanupOrphanedPlans() {
        try {
            int deleted = planActionRepository.deleteOrphanedPlans();
            if (deleted > 0) {
                log.info("Nettoyage: {} plans d'action orphelins supprimés", deleted);
            }
        } catch (Exception e) {
            log.warn("Erreur nettoyage plans orphelins: {}", e.getMessage());
        }
    }

    /**
     * Cherche un technicien actif dans le même processus que la machine.
     * Utilise findByRoleNomInAndActifTrue() qui existe déjà dans ton repo.
     */
    private Utilisateur trouverTechnicienProcessus(OkDemarrage checklist) {
        try {
            if (checklist.getMachine() == null)
                return null;
            if (checklist.getMachine().getProcessus() == null)
                return null;
            Long processusId = checklist.getMachine().getProcessus().getId();

            return utilisateurRepository
                    .findByRoleNomInAndActifTrue(List.of("TECHNICIEN"))
                    .stream()
                    .filter(u -> u.getProcessus() != null
                            && processusId.equals(u.getProcessus().getId()))
                    .findFirst()
                    .orElse(null);

        } catch (Exception e) {
            log.warn("Impossible de trouver le technicien du processus: {}", e.getMessage());
            return null;
        }
    }

    private PlanAction getOrThrow(Long id) {
        return planActionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Plan d'action introuvable : " + id));
    }

    private PlanActionDTO toDTO(PlanAction pa) {
        try {
            PlanActionDTO dto = new PlanActionDTO();
            dto.setId(pa.getId());
            dto.setDescription(pa.getDescription());
            dto.setResponsableMatricule(pa.getResponsableMatricule());
            dto.setResponsableNom(pa.getResponsableNom());
            dto.setResponsableAutre(pa.getResponsableAutre());
            dto.setDateEcheance(pa.getDateEcheance());
            dto.setStatut(pa.getStatut());
            dto.setPriorite(pa.getPriorite());
            dto.setCreeLe(pa.getCreeLe());
            dto.setCreeParMatricule(pa.getCreeParMatricule());
            dto.setClosLe(pa.getClosLe());
            dto.setCommentaireCloture(pa.getCommentaireCloture());
            // Nouveaux champs workflow
            dto.setCouleurCritere(pa.getCouleurCritere());
            dto.setValideAqLe(pa.getValideAqLe());
            dto.setValideAqParMatricule(pa.getValideAqParMatricule());
            dto.setCommentaireValidationAq(pa.getCommentaireValidationAq());
            dto.setEnAttenteValidationAq(
                    pa.getStatut() == PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ);

            if (pa.getResponsable() != null)
                dto.setResponsableId(pa.getResponsable().getId());

            // Safely handle orphaned plans (checklist deleted but plan still exists)
            if (pa.getOkDemarrage() != null) {
                OkDemarrage okd = pa.getOkDemarrage();
                dto.setChecklistId(okd.getId());
                if (okd.getMachine() != null) {
                    dto.setMachineNom(okd.getMachine().getNom());
                    if (okd.getMachine().getProcessus() != null)
                        dto.setProcessusNom(okd.getMachine().getProcessus().getNom());
                    dto.setPlantId(resolvePlantId(okd.getMachine()));
                }
                if (okd.getOperateur() != null)
                    dto.setOperateurNom(okd.getOperateur().getNom());
            }
            return dto;
        } catch (Exception e) {
            log.warn("Plan d'action #{} pointe vers une checklist orpheline (supprimée): {}", pa.getId(),
                    e.getMessage());
            return null;
        }
    }
}