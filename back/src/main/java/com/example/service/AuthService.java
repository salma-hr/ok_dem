package com.example.service;

import com.example.dto.ForgotPasswordRequest;
import com.example.dto.LoginRequest;
import com.example.dto.LoginResponse;
import com.example.dto.RegisterRequest;
import com.example.dto.ResetPasswordRequest;
import com.example.entity.PasswordResetToken;
import com.example.entity.Plant;
import com.example.entity.Role;
import com.example.entity.Segment;
import com.example.entity.Site;
import com.example.entity.Utilisateur;
import com.example.repository.PasswordResetTokenRepository;
import com.example.repository.PlantRepository;
import com.example.repository.RoleRepository;
import com.example.repository.SegmentRepository;
import com.example.repository.SiteRepository;
import com.example.repository.UtilisateurRepository;
import com.example.security.JwtUtils;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AuthService {

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final RoleRepository roleRepository;
    private final SiteRepository siteRepository;
    private final PlantRepository plantRepository;
    private final SegmentRepository segmentRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JavaMailSender mailSender;

    public LoginResponse login(LoginRequest request) {
        Utilisateur user = utilisateurRepository.findByMatricule(request.getMatricule())
                .orElseThrow(() -> new RuntimeException("Matricule ou mot de passe incorrect"));

        if (!user.getActif()) {
            throw new RuntimeException("Compte désactivé. Contactez l'administrateur.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Matricule ou mot de passe incorrect");
        }

        String token = jwtUtils.generateToken(user.getMatricule(), user.getRole().getNom());

        Long siteId = user.getSite() != null ? user.getSite().getId() : null;
        String siteNom = user.getSite() != null ? user.getSite().getNom() : null;
        Long plantId = user.getPlant() != null ? user.getPlant().getId() : null;
        String plantNom = user.getPlant() != null ? user.getPlant().getNom() : null;
        Long segmentId = user.getSegment() != null ? user.getSegment().getId() : null;
        String segmentNom = user.getSegment() != null ? user.getSegment().getNom() : null;
        Long processusId = user.getProcessus() != null ? user.getProcessus().getId() : null;
        String processusNom = user.getProcessus() != null ? user.getProcessus().getNom() : null;

        return new LoginResponse(
                token,
                user.getId(),
                user.getMatricule(),
                user.getNom(),
                user.getRole().getNom(),
                user.getEmail(),
                siteId,
                siteNom,
                plantId,
                plantNom,
                segmentId,
                segmentNom,
                processusId,
                processusNom);
    }

    public Utilisateur register(RegisterRequest request) {
        if (utilisateurRepository.existsByMatricule(request.getMatricule())) {
            throw new RuntimeException("Ce matricule est déjà utilisé.");
        }
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new RuntimeException("Rôle introuvable"));

        Utilisateur user = new Utilisateur();
        user.setNom(request.getNom());
        user.setMatricule(request.getMatricule());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        user.setActif(false);

        // Affectation optionnelle au site
        if (request.getSiteId() != null) {
            Site site = siteRepository.findById(request.getSiteId())
                    .orElseThrow(() -> new RuntimeException("Site introuvable"));
            user.setSite(site);
        }

        // Affectation optionnelle au plant (doit appartenir au site si les deux sont fournis)
        if (request.getPlantId() != null) {
            Plant plant = plantRepository.findById(request.getPlantId())
                    .orElseThrow(() -> new RuntimeException("Plant introuvable"));
            if (request.getSiteId() != null && plant.getSite() != null && !plant.getSite().getId().equals(request.getSiteId())) {
                throw new RuntimeException("Le plant sélectionné n'appartient pas au site choisi.");
            }
            user.setPlant(plant);
            if (user.getSite() == null && plant.getSite() != null) {
                user.setSite(plant.getSite());
            }
        }

        if (request.getSegmentId() != null) {
            Segment segment = segmentRepository.findById(request.getSegmentId())
                    .orElseThrow(() -> new RuntimeException("Segment introuvable"));
            if (request.getPlantId() != null && segment.getPlant() != null && !segment.getPlant().getId().equals(request.getPlantId())) {
                throw new RuntimeException("Le segment sélectionné n'appartient pas au plant choisi.");
            }
            if (request.getPlantId() == null && segment.getPlant() != null) {
                user.setPlant(segment.getPlant());
            }
            if (user.getSite() == null && segment.getPlant() != null && segment.getPlant().getSite() != null) {
                user.setSite(segment.getPlant().getSite());
            }
            user.setSegment(segment);
        }

        return utilisateurRepository.save(user);
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        Utilisateur user = utilisateurRepository.findByMatricule(request.getMatricule())
                .orElseThrow(() -> new RuntimeException("Aucun compte trouvé avec ce matricule."));

        tokenRepository.deleteByUtilisateurId(user.getId());

        String tokenValue = UUID.randomUUID().toString();
        PasswordResetToken resetToken = new PasswordResetToken(tokenValue, user);
        tokenRepository.save(resetToken);

        sendResetEmail(user, tokenValue);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = tokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new RuntimeException("Lien invalide ou expiré."));

        if (resetToken.isExpired()) {
            tokenRepository.delete(resetToken);
            throw new RuntimeException("Ce lien a expiré. Veuillez faire une nouvelle demande.");
        }

        if (resetToken.isUsed()) {
            throw new RuntimeException("Ce lien a déjà été utilisé.");
        }

        Utilisateur user = resetToken.getUtilisateur();
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        utilisateurRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);
    }

    private void sendResetEmail(Utilisateur user, String token) {
        String email = user.getEmail();

        if (email == null || email.isBlank()) {
            throw new RuntimeException(
                    "Aucun email associé au compte '" + user.getMatricule() +
                            "'. Contactez l'administrateur pour mettre à jour votre email.");
        }

        try {
            String resetLink = "http://localhost:3000/reset-password?token=" + token;

            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setFrom("hrabisalma9@gmail.com");
            message.setSubject("LEONI OK Démarrage — Réinitialisation du mot de passe");
            message.setText(
                    "Bonjour " + user.getNom() + ",\n\n" +
                            "Vous avez demandé la réinitialisation de votre mot de passe.\n\n" +
                            "Cliquez sur le lien suivant pour choisir un nouveau mot de passe :\n" +
                            resetLink + "\n\n" +
                            "Ce lien est valide pendant 24 heures.\n\n" +
                            "Si vous n'avez pas fait cette demande, ignorez cet email.\n\n" +
                            "Cordialement,\nL'équipe LEONI OK Démarrage");

            mailSender.send(message);
            System.out.println("✅ Email envoyé à : " + email);

        } catch (Exception e) {
            System.err.println("❌ Erreur envoi email : " + e.getClass().getName() + " — " + e.getMessage());
            if (e.getCause() != null) {
                System.err.println("   Cause : " + e.getCause().getMessage());
            }
            throw new RuntimeException("Impossible d'envoyer l'email : " + e.getMessage());
        }
    }
}