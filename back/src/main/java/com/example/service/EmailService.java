package com.example.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

/**
 * Service d'envoi d'emails de notification HTML.
 * Les emails sont envoyés de façon asynchrone pour ne pas bloquer les transactions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    private static final String FROM = "hrabisalma9@gmail.com";
    private static final String APP_NAME = "CheckFactory";
    private static final String PRIMARY_COLOR = "#3B5BF6";
    private static final String DANGER_COLOR  = "#EF4444";
    private static final String SUCCESS_COLOR = "#22C55E";
    private static final String WARN_COLOR    = "#F59E0B";
    private static final String INFO_COLOR    = "#6366F1";

    // ─── Public API ────────────────────────────────────────────────────────────

    /**
     * Email envoyé au chef de ligne / technicien quand une checklist est soumise.
     *
     * @param toEmail       email du destinataire
     * @param recipientName nom affiché
     * @param checklistId   id de la checklist
     * @param operateurNom  nom de l'opérateur
     * @param machineNom    nom de la machine
     * @param session       session (Matin / Soir)
     * @param nbNc          nombre de non-conformités (0 = tout conforme)
     */
    @Async
    public void sendChecklistSoumise(String toEmail,
                                     String recipientName,
                                     Long checklistId,
                                     String operateurNom,
                                     String machineNom,
                                     String session,
                                     int nbNc) {
        if (!hasEmail(toEmail)) return;

        String subject = nbNc > 0
                ? "[" + APP_NAME + "] ⚠️ Checklist #" + checklistId + " soumise — " + nbNc + " non-conformité(s)"
                : "[" + APP_NAME + "] ✅ Checklist #" + checklistId + " soumise — Tout conforme";

        String accentColor = nbNc > 0 ? DANGER_COLOR : SUCCESS_COLOR;
        String statusBadge = nbNc > 0
                ? badge(DANGER_COLOR, "⚠️ " + nbNc + " Non-conformité(s)")
                : badge(SUCCESS_COLOR, "✅ Tout conforme");

        String actionText = "Veuillez valider cette checklist dans l'application.";

        String body = buildEmailHtml(
                recipientName,
                subject,
                accentColor,
                "Checklist #" + checklistId + " — Action requise",
                "<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>" +
                "<tr><td style='padding:8px 12px;background:#f5f7ff;font-weight:600;border-radius:6px 0 0 0;'>Machine</td>" +
                    "<td style='padding:8px 12px;'>" + esc(machineNom) + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#f5f7ff;font-weight:600;'>Opérateur</td>" +
                    "<td style='padding:8px 12px;'>" + esc(operateurNom) + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#f5f7ff;font-weight:600;'>Session</td>" +
                    "<td style='padding:8px 12px;'>" + esc(session) + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#f5f7ff;font-weight:600;border-radius:0 0 0 6px;'>Statut</td>" +
                    "<td style='padding:8px 12px;'>" + statusBadge + "</td></tr>" +
                "</table>" +
                "<p style='color:#555;font-size:14px;margin:16px 0;'>" + actionText + "</p>");

        send(toEmail, subject, body);
    }

    /**
     * Email envoyé au technicien / agent qualité pour validation requise.
     *
     * @param toEmail       email du destinataire
     * @param recipientName nom affiché
     * @param checklistId   id de la checklist
     * @param validationLevel "N2" ou "Finale"
     * @param validatedByNom  nom du validateur précédent
     */
    @Async
    public void sendValidationRequise(String toEmail,
                                      String recipientName,
                                      Long checklistId,
                                      String validationLevel,
                                      String validatedByNom) {
        if (!hasEmail(toEmail)) return;

        String subject = "[" + APP_NAME + "] 🔔 Validation " + validationLevel + " requise — Checklist #" + checklistId;

        String body = buildEmailHtml(
                recipientName,
                subject,
                PRIMARY_COLOR,
                "Validation " + validationLevel + " requise",
                "<p style='color:#444;font-size:15px;margin:0 0 16px;'>" +
                "La checklist <strong>#" + checklistId + "</strong> a été validée " +
                (validatedByNom != null ? "par <strong>" + esc(validatedByNom) + "</strong> " : "") +
                "et nécessite maintenant votre validation <strong>" + esc(validationLevel) + "</strong>." +
                "</p>" +
                "<p style='color:#555;font-size:14px;'>Connectez-vous à l'application pour procéder à la validation.</p>");

        send(toEmail, subject, body);
    }

    /**
     * Email envoyé au responsable d'un plan d'action.
     *
     * @param toEmail         email du responsable
     * @param recipientName   nom du responsable
     * @param planActionId    id du plan d'action
     * @param checklistId     checklist liée
     * @param machineNom      machine concernée
     * @param description     description du plan
     * @param dateEcheance    date limite
     */
    @Async
    public void sendPlanActionAssigne(String toEmail,
                                      String recipientName,
                                      Long planActionId,
                                      Long checklistId,
                                      String machineNom,
                                      String description,
                                      String dateEcheance) {
        if (!hasEmail(toEmail)) return;

        String subject = "[" + APP_NAME + "] 📋 Nouveau plan d'action assigné — #" + planActionId;

        String body = buildEmailHtml(
                recipientName,
                subject,
                WARN_COLOR,
                "Plan d'action #" + planActionId + " — Assigné",
                "<table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>" +
                "<tr><td style='padding:8px 12px;background:#fffbf0;font-weight:600;border-radius:6px 0 0 0;'>Checklist</td>" +
                    "<td style='padding:8px 12px;'>#" + checklistId + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#fffbf0;font-weight:600;'>Machine</td>" +
                    "<td style='padding:8px 12px;'>" + esc(machineNom) + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#fffbf0;font-weight:600;'>Description</td>" +
                    "<td style='padding:8px 12px;'>" + esc(description) + "</td></tr>" +
                "<tr><td style='padding:8px 12px;background:#fffbf0;font-weight:600;border-radius:0 0 0 6px;'>Échéance</td>" +
                    "<td style='padding:8px 12px;'><strong style=\"color:" + DANGER_COLOR + ";\">" + esc(dateEcheance) + "</strong></td></tr>" +
                "</table>" +
                "<p style='color:#555;font-size:14px;margin:16px 0;'>Prenez en charge ce plan d'action dans l'application.</p>");

        send(toEmail, subject, body);
    }

    /**
     * Email générique — pour les notifications in-app enrichies.
     */
    @Async
    public void sendGenericNotification(String toEmail,
                                        String recipientName,
                                        String titre,
                                        String message,
                                        String type) {
        if (!hasEmail(toEmail)) return;

        String accentColor = switch (type != null ? type.toUpperCase() : "") {
            case "NON_CONFORMITE" -> DANGER_COLOR;
            case "VALIDATION", "CHECK", "SUCCESS" -> SUCCESS_COLOR;
            case "PLAN_ACTION", "WARN" -> WARN_COLOR;
            default -> INFO_COLOR;
        };

        String subject = "[" + APP_NAME + "] " + titre;

        String body = buildEmailHtml(
                recipientName,
                subject,
                accentColor,
                titre,
                "<p style='color:#444;font-size:15px;line-height:1.6;margin:0;'>" + esc(message) + "</p>");

        send(toEmail, subject, body);
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    private void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(FROM);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(mime);
            log.info("✅ Email envoyé à {} — {}", to, subject);
        } catch (Exception e) {
            log.error("❌ Erreur envoi email à {} : {} — {}", to, e.getClass().getSimpleName(), e.getMessage());
        }
    }

    private boolean hasEmail(String email) {
        return email != null && !email.isBlank() && email.contains("@");
    }

    private String esc(String s) {
        if (s == null) return "—";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private String badge(String color, String text) {
        return "<span style='display:inline-block;padding:3px 10px;border-radius:12px;background:" +
               color + "22;color:" + color + ";font-weight:700;font-size:13px;'>" + text + "</span>";
    }

    private String buildEmailHtml(String recipientName,
                                  String preheader,
                                  String accentColor,
                                  String headingText,
                                  String contentHtml) {
        return "<!DOCTYPE html><html lang='fr'><head><meta charset='UTF-8'/>" +
               "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
               "<title>" + esc(preheader) + "</title></head>" +
               "<body style='margin:0;padding:0;background:#f0f2f8;font-family:Inter,Arial,sans-serif;'>" +
               "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f0f2f8;padding:32px 0;'><tr><td align='center'>" +
               "<table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>" +

               // Header strip
               "<tr><td style='background:" + accentColor + ";padding:0;height:6px;'></td></tr>" +

               // Logo / App name bar
               "<tr><td style='padding:24px 32px 16px;border-bottom:1px solid #f0f2f8;'>" +
               "<span style='font-size:18px;font-weight:800;color:" + accentColor + ";letter-spacing:-0.5px;'>" + APP_NAME + "</span>" +
               "</td></tr>" +

               // Heading
               "<tr><td style='padding:28px 32px 0;'>" +
               "<h1 style='margin:0;font-size:20px;font-weight:700;color:#1a1a2e;line-height:1.3;'>" + esc(headingText) + "</h1>" +
               "<p style='margin:8px 0 0;font-size:14px;color:#888;'>Bonjour <strong>" + esc(recipientName) + "</strong>,</p>" +
               "</td></tr>" +

               // Content
               "<tr><td style='padding:20px 32px 32px;'>" + contentHtml + "</td></tr>" +

               // Footer
               "<tr><td style='padding:20px 32px;border-top:1px solid #f0f2f8;background:#fafbff;'>" +
               "<p style='margin:0;font-size:12px;color:#aaa;line-height:1.6;'>" +
               "Cet email a été envoyé automatiquement par <strong>" + APP_NAME + "</strong>. " +
               "Merci de ne pas y répondre directement." +
               "</p>" +
               "</td></tr>" +

               "</table></td></tr></table>" +
               "</body></html>";
    }
}