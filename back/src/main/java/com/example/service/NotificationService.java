package com.example.service;

import com.example.dto.NotificationDTO;
import com.example.entity.Notification;
import com.example.entity.Utilisateur;
import com.example.repository.NotificationRepository;
import com.example.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final EmailService emailService;

    public List<NotificationDTO> getNotifications(String matricule) {
        if (matricule == null || matricule.isBlank()) {
            return List.of();
        }
        return notificationRepository
                .findTop50ByDestinataireMatriculeOrderByCreeLeDesc(matricule)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public long getUnreadCount(String matricule) {
        if (matricule == null || matricule.isBlank()) {
            return 0;
        }
        return notificationRepository.countByDestinataireMatriculeAndLueFalse(matricule);
    }

    @Transactional
    public boolean markAsRead(Long id, String matricule) {
        if (id == null || matricule == null || matricule.isBlank()) {
            return false;
        }
        return notificationRepository.findByIdAndDestinataireMatricule(id, matricule)
                .map(n -> {
                    if (!n.isLue()) {
                        n.setLue(true);
                        notificationRepository.save(n);
                    }
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public int markAllAsRead(String matricule) {
        if (matricule == null || matricule.isBlank()) {
            return 0;
        }
        return notificationRepository.markAllAsRead(matricule);
    }

    // ── notifyUser (Utilisateur) ─────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUser(Utilisateur utilisateur,
            String titre,
            String message,
            String type,
            Long checklistId) {
        if (utilisateur == null) {
            return;
        }
        Notification notification = buildNotification(utilisateur, titre, message, type, checklistId);
        if (notification != null) {
            notificationRepository.save(notification);
            // Email parallèle
            emailService.sendGenericNotification(
                    utilisateur.getEmail(),
                    utilisateur.getNom(),
                    titre,
                    message,
                    type);
        }
    }

    // ── notifyUser (matricule) ──────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUser(String matricule,
            String nom,
            String titre,
            String message,
            String type,
            Long checklistId) {
        if (matricule == null || matricule.isBlank()) {
            return;
        }
        Notification notification = buildNotification(matricule, nom, titre, message, type, checklistId);
        if (notification != null) {
            notificationRepository.save(notification);
            // Email parallèle : résoudre l'utilisateur pour avoir son email
            Utilisateur u = utilisateurRepository.findByMatricule(matricule).orElse(null);
            if (u != null) {
                emailService.sendGenericNotification(u.getEmail(), u.getNom(), titre, message, type);
            }
        }
    }

    // ── notifyRoles ─────────────────────────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyRoles(Collection<String> roleNames,
            String titre,
            String message,
            String type,
            Long checklistId,
            String excludeMatricule) {
        if (roleNames == null || roleNames.isEmpty()) {
            return;
        }

        List<Utilisateur> utilisateurs = utilisateurRepository.findByRoleNomInAndActifTrue(roleNames);
        Set<String> sent = new LinkedHashSet<>();
        List<Notification> notifications = new ArrayList<>();

        for (Utilisateur utilisateur : utilisateurs) {
            String matricule = utilisateur.getMatricule();
            if (matricule == null || matricule.isBlank()) {
                continue;
            }
            if (excludeMatricule != null && excludeMatricule.equalsIgnoreCase(matricule)) {
                continue;
            }
            if (!sent.add(matricule)) {
                continue;
            }
            Notification notification = buildNotification(
                    utilisateur,
                    titre,
                    message,
                    type,
                    checklistId);
            if (notification != null) {
                notifications.add(notification);
                // Email parallèle pour chaque destinataire
                emailService.sendGenericNotification(
                        utilisateur.getEmail(),
                        utilisateur.getNom(),
                        titre,
                        message,
                        type);
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository
                    .saveAll(notifications.stream().filter(n -> n != null && n.getDestinataireId() != null).toList());
        }
    }

    // ── notifyRolesLocal (sans email) ─────────────────────────────────────

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyRolesLocal(Collection<String> roleNames,
            String titre,
            String message,
            String type,
            Long checklistId,
            String excludeMatricule) {
        if (roleNames == null || roleNames.isEmpty()) {
            return;
        }

        List<Utilisateur> utilisateurs = utilisateurRepository.findByRoleNomInAndActifTrue(roleNames);
        Set<String> sent = new LinkedHashSet<>();
        List<Notification> notifications = new ArrayList<>();

        for (Utilisateur utilisateur : utilisateurs) {
            String matricule = utilisateur.getMatricule();
            if (matricule == null || matricule.isBlank()) {
                continue;
            }
            if (excludeMatricule != null && excludeMatricule.equalsIgnoreCase(matricule)) {
                continue;
            }
            if (!sent.add(matricule)) {
                continue;
            }
            Notification notification = buildNotification(
                    utilisateur,
                    titre,
                    message,
                    type,
                    checklistId);
            if (notification != null) {
                notifications.add(notification);
            }
        }

        if (!notifications.isEmpty()) {
            notificationRepository
                    .saveAll(notifications.stream().filter(n -> n != null && n.getDestinataireId() != null).toList());
        }
    }

    // ── Méthodes enrichies pour ChecklistService ─────────────────────────────

    /**
     * Notifie les chefs de ligne / admin qu'une checklist a été soumise,
     * avec indication des non-conformités détectées.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyChecklistSoumise(Collection<String> roleNames,
            Long checklistId,
            String operateurNom,
            String machineNom,
            String session,
            int nbNc,
            String excludeMatricule) {

        String titre = nbNc > 0
                ? "Checklist #" + checklistId + " soumise — " + nbNc + " NC"
                : "Checklist #" + checklistId + " soumise — Conforme";
        String message = "Soumise par " + operateurNom + " sur " + machineNom
                + " (" + session + ")"
                + (nbNc > 0 ? " — " + nbNc + " non-conformité(s) détectée(s)." : " — Tout conforme.");

        if (roleNames == null || roleNames.isEmpty())
            return;

        List<Utilisateur> utilisateurs = utilisateurRepository.findByRoleNomInAndActifTrue(roleNames);
        Set<String> sent = new LinkedHashSet<>();
        List<Notification> notifications = new ArrayList<>();

        for (Utilisateur u : utilisateurs) {
            String mat = u.getMatricule();
            if (mat == null || mat.isBlank())
                continue;
            if (excludeMatricule != null && excludeMatricule.equalsIgnoreCase(mat))
                continue;
            if (!sent.add(mat))
                continue;

            Notification n = buildNotification(u, titre, message, nbNc > 0 ? "NON_CONFORMITE" : "info", checklistId);
            if (n != null) {
                notifications.add(n);
                // Email HTML dédié avec les détails
                emailService.sendChecklistSoumise(
                        u.getEmail(), u.getNom(),
                        checklistId, operateurNom, machineNom, session, nbNc);
            }
        }

        if (!notifications.isEmpty())
            notificationRepository
                    .saveAll(notifications.stream().filter(n -> n != null && n.getDestinataireId() != null).toList());
    }

    /**
     * Notifie les destinataires qu'une validation est requise (N2 ou Finale).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyValidationRequise(Collection<String> roleNames,
            Long checklistId,
            String validationLevel,
            String validatedByNom,
            String excludeMatricule) {

        String titre = "Validation " + validationLevel + " requise — Checklist #" + checklistId;
        String message = "La checklist #" + checklistId + " a été validée"
                + (validatedByNom != null ? " par " + validatedByNom : "")
                + " et nécessite votre validation " + validationLevel + ".";

        if (roleNames == null || roleNames.isEmpty())
            return;

        List<Utilisateur> utilisateurs = utilisateurRepository.findByRoleNomInAndActifTrue(roleNames);
        Set<String> sent = new LinkedHashSet<>();
        List<Notification> notifications = new ArrayList<>();

        for (Utilisateur u : utilisateurs) {
            String mat = u.getMatricule();
            if (mat == null || mat.isBlank())
                continue;
            if (excludeMatricule != null && excludeMatricule.equalsIgnoreCase(mat))
                continue;
            if (!sent.add(mat))
                continue;

            Notification n = buildNotification(u, titre, message, "VALIDATION", checklistId);
            if (n != null) {
                notifications.add(n);
                emailService.sendValidationRequise(
                        u.getEmail(), u.getNom(), checklistId, validationLevel, validatedByNom);
            }
        }

        if (!notifications.isEmpty())
            notificationRepository
                    .saveAll(notifications.stream().filter(n -> n != null && n.getDestinataireId() != null).toList());
    }

    /**
     * Notifie le responsable d'un plan d'action avec email HTML dédié.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyPlanActionAssigne(Utilisateur responsable,
            Long planActionId,
            Long checklistId,
            String machineNom,
            String description,
            String dateEcheance) {
        if (responsable == null)
            return;

        String titre = "📋 Nouveau plan d'action assigné";
        String message = "Plan d'action #" + planActionId + " assigné pour la checklist #" + checklistId
                + " (machine : " + machineNom + "). Échéance : " + dateEcheance;

        Notification n = buildNotification(responsable, titre, message, "PLAN_ACTION", checklistId);
        if (n != null) {
            notificationRepository.save(n);
            emailService.sendPlanActionAssigne(
                    responsable.getEmail(), responsable.getNom(),
                    planActionId, checklistId, machineNom, description, dateEcheance);
        }
    }

    // ── DTO / Builders ───────────────────────────────────────────────────────

    private NotificationDTO toDTO(Notification notification) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(notification.getId());
        dto.setTitre(notification.getTitre());
        dto.setMessage(notification.getMessage());
        dto.setType(notification.getType());
        dto.setLue(notification.isLue());
        dto.setCreeLe(notification.getCreeLe());
        dto.setChecklistId(notification.getChecklistId());
        return dto;
    }

    private Notification buildNotification(Utilisateur utilisateur,
            String titre,
            String message,
            String type,
            Long checklistId) {
        if (utilisateur == null || utilisateur.getId() == null) {
            return null;
        }
        String matricule = utilisateur.getMatricule();
        if (matricule == null || matricule.isBlank()) {
            return null;
        }
        Notification notification = new Notification();
        notification.setDestinataireId(utilisateur.getId());
        notification.setDestinataireMatricule(matricule);
        notification.setDestinataireNom(utilisateur.getNom());
        notification.setTitre(titre);
        notification.setMessage(message);
        notification.setType(type == null || type.isBlank() ? "info" : type);
        notification.setChecklistId(checklistId);
        notification.setLue(false);
        return notification;
    }

    private Notification buildNotification(String matricule,
            String nom,
            String titre,
            String message,
            String type,
            Long checklistId) {
        if (matricule == null || matricule.isBlank()) {
            return null;
        }
        Utilisateur utilisateur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        if (utilisateur == null) {
            return null;
        }
        Notification notification = buildNotification(utilisateur, titre, message, type, checklistId);
        if (notification != null
                && (notification.getDestinataireNom() == null || notification.getDestinataireNom().isBlank())) {
            notification.setDestinataireNom(nom);
        }
        return notification;
    }
}