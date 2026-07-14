package com.example.service;

import com.example.dto.ChecklistAuditLogDTO;
import com.example.dto.ChecklistDTO;
import com.example.dto.ChecklistRequest;
import com.example.entity.*;
import com.example.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.awt.Color;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChecklistService {

    private static final Logger log = LoggerFactory.getLogger(ChecklistService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    
    // ── Anciens constants (gardés pour compatibilité) ──────────────────
    private static final Color PDF_BORDER_COLOR = PdfStyleLeoni.getTableBorderColor();
    private static final Color PDF_HEADER_BG = PdfStyleLeoni.getHeaderBackgroundColor();
    private static final Color PDF_ROW_ALT_BG = PdfStyleLeoni.getTableRowAlternateColor();

    private final OkDemarrageRepository okDemarrageRepository;
    private final MachineRepository machineRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final CritereRepository critereRepository;
    private final CritereService critereService;
    private final SiteRepository siteRepository;
    private final ProcessusRepository processusRepository;
    private final RestTemplate restTemplate;
    private final PdfCritereParser pdfCritereParser;
    private final ReponseCritereRepository reponseCritereRepository;
    private final NotificationService notificationService;
    private final ChecklistAuditService checklistAuditService;
    private final PlanActionRepository planActionRepository;
    private final ScopeService scopeService;

    @Value("${ocr.service.url:http://localhost:8000/ocr}")
    private String ocrServiceUrl;

    @Value("${app.pdf.logo-path:}")
    private String pdfLogoPath;

    @Value("${app.pdf.brand-name:EONI Wiring Systems}")
    private String pdfBrandName;

    @Value("${hf.auto.import.enabled:true}")
    private boolean hfAutoImportEnabled;

    @Value("${app.checklist.limit-one-submission-per-day:true}")
    private boolean limitOneSubmissionPerDay;

    // ── toDTO ────────────────────────────────────────────────────────
    private ChecklistDTO toDTO(OkDemarrage okd) {
        ChecklistDTO dto = new ChecklistDTO();
        dto.setId(okd.getId());
        dto.setDate(okd.getDate());
        dto.setStatus(okd.getStatus());
        dto.setSession(okd.getSession());

        dto.setDateValidationN1(okd.getDateValidationN1());
        if (okd.getValideN1Par() != null) {
            dto.setValideN1Par(okd.getValideN1Par().getNom());
            dto.setValideN1ParMatricule(okd.getValideN1Par().getMatricule());
        }
        dto.setDateValidationN2(okd.getDateValidationN2());
        if (okd.getValideN2Par() != null) {
            dto.setValideN2Par(okd.getValideN2Par().getNom());
            dto.setValideN2ParMatricule(okd.getValideN2Par().getMatricule());
        }
        dto.setDateValidationFinale(okd.getDateValidationFinale());
        if (okd.getValideParFinal() != null) {
            dto.setValideParFinal(okd.getValideParFinal().getNom());
            dto.setValideParFinalMatricule(okd.getValideParFinal().getMatricule());
        }
        dto.setMotifRejet(okd.getMotifRejet());
        dto.setDateRejet(okd.getDateRejet());
        if (okd.getRejetePar() != null)
            dto.setRejetePar(okd.getRejetePar().getNom());

        if (okd.getMachine() != null) {
            dto.setMachineId(okd.getMachine().getId());
            dto.setMachineNom(okd.getMachine().getNom());
            if (okd.getMachine().getProcessus() != null) {
                dto.setProcessusId(okd.getMachine().getProcessus().getId());
                dto.setProcessusNom(okd.getMachine().getProcessus().getNom());
            }
        }
        // Fallback : déduire le processus depuis l'opérateur si machine absente
        if (dto.getProcessusId() == null && okd.getOperateur() != null
                && okd.getOperateur().getProcessus() != null) {
            dto.setProcessusId(okd.getOperateur().getProcessus().getId());
            dto.setProcessusNom(okd.getOperateur().getProcessus().getNom());
        }
        if (okd.getOperateur() != null) {
            dto.setOperateurId(okd.getOperateur().getId());
            dto.setOperateurNom(okd.getOperateur().getNom());
            dto.setOperateurMatricule(okd.getOperateur().getMatricule());
        }
        if (okd.getSite() != null) {
            dto.setSiteId(okd.getSite().getId());
            dto.setSiteNom(okd.getSite().getNom());
            Processus proc = (okd.getMachine() != null) ? okd.getMachine().getProcessus() : null;
            if (proc == null && okd.getOperateur() != null)
                proc = okd.getOperateur().getProcessus();
            if (proc != null && proc.getSegment() != null) {
                Segment segment = proc.getSegment();
                dto.setSegmentId(segment.getId());
                if (segment.getPlant() != null) {
                    dto.setPlantId(segment.getPlant().getId());
                    dto.setPlantNom(segment.getPlant().getNom());
                }
            }
        }
        if (okd.getReponses() != null) {
            dto.setReponses(okd.getReponses().stream().map(r -> {
                ChecklistDTO.ReponseDTO rd = new ChecklistDTO.ReponseDTO();
                rd.setId(r.getId());
                rd.setValeur(r.getValeur().name());
                rd.setCommentaire(r.getCommentaire());
                if (r.getCritere() != null) {
                    rd.setCritereId(r.getCritere().getId());
                    rd.setCritereNom(r.getCritere().getNom());
                    rd.setCritereNomAr(r.getCritere().getNomAr());
                    rd.setCritereNomEn(r.getCritere().getNomEn());
                    rd.setCritereNomDe(r.getCritere().getNomDe());
                    rd.setCritereCouleur(r.getCritere().getCouleur());
                }
                return rd;
            }).toList());
        }

        return dto;
    }

    // ── Lectures ─────────────────────────────────────────────────────
    public List<ChecklistDTO> findAll() {
        List<ChecklistDTO> all = okDemarrageRepository.findAllWithDetails().stream().map(this::toDTO).toList();
        return scopeService.filterByPlant(all, ChecklistDTO::getPlantId);
    }

    public ChecklistDTO findById(Long id) {
        return toDTO(okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable")));
    }

    // ── Dossier PDF ───────────────────────────────────────────────
    public byte[] exportChecklistPdf(Long id) {
        OkDemarrage okd = okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable"));

        List<PlanAction> plans = planActionRepository.findByOkDemarrageIdOrderByCreeLe(id);
        List<ChecklistAuditLogDTO> auditLogs = checklistAuditService.getHistoriqueChecklist(id);
        return renderPdf(okd, plans, auditLogs);
    }

    public Map<String, Object> verifierEtat(Long operateurId, Long machineId, String session, String date) {
        LocalDate dateChecklist = LocalDate.parse(date);

        // ── Règle prioritaire : une seule soumission par opérateur par journée ──
        if (limitOneSubmissionPerDay) {
            List<OkDemarrage> soumisJournee = okDemarrageRepository
                    .findSoumisParJournee(operateurId, dateChecklist, OkDemarrage.Status.EN_COURS);
            if (!soumisJournee.isEmpty()) {
                OkDemarrage okd = soumisJournee.get(0);
                return Map.of(
                        "status", "DEJA_SOUMIS_JOURNEE",
                        "id", okd.getId(),
                        "statusActuel", okd.getStatus().name(),
                        "message",
                        "Vous avez déjà soumis une checklist aujourd'hui. La soumission est limitée à une fois par jour.");
            }
        }

        Optional<OkDemarrage> existing = (machineId != null)
                ? findExisting(operateurId, machineId, dateChecklist)
                : findExistingByOperateur(operateurId, dateChecklist);
        if (existing.isPresent()) {
            OkDemarrage okd = existing.get();
            if (okd.getStatus() == OkDemarrage.Status.EN_COURS) {
                return Map.of(
                        "status", "BROUILLON",
                        "id", okd.getId(),
                        "statusActuel", okd.getStatus().name(),
                        "machineId", okd.getMachine() != null ? okd.getMachine().getId() : machineId);
            }
            return Map.of(
                    "status", "DEJA_SOUMIS",
                    "id", okd.getId(),
                    "statusActuel", okd.getStatus().name(),
                    "machineId", okd.getMachine() != null ? okd.getMachine().getId() : machineId);
        }

        Optional<OkDemarrage> conflict = machineId != null
                ? findMachineConflict(operateurId, machineId, dateChecklist)
                : Optional.empty();
        if (conflict.isPresent()) {
            OkDemarrage okd = conflict.get();
            return Map.of(
                    "status", "MACHINE_OCCUPEE",
                    "id", okd.getId(),
                    "statusActuel", okd.getStatus().name(),
                    "machineId", okd.getMachine() != null ? okd.getMachine().getId() : machineId,
                    "operateurId", okd.getOperateur() != null ? okd.getOperateur().getId() : null);
        }

        return Map.of("status", "NOUVEAU");
    }

    // ── Helper : évite NonUniqueResultException si doublons en base ──
    private Optional<OkDemarrage> findExisting(Long operateurId, Long machineId,
            OkDemarrage.Session session, LocalDate date) {
        List<OkDemarrage> results = okDemarrageRepository
                .findAllByOperateurIdAndMachineIdAndSessionAndDate(
                        operateurId, machineId, session, date);
        if (results.isEmpty())
            return Optional.empty();
        if (results.size() > 1) {
            log.warn(
                    "Doublons détectés en base pour opérateur={} machine={} session={} date={} — {} entrées. On prend la plus ancienne (id={}).",
                    operateurId, machineId, session, date, results.size(), results.get(0).getId());
        }
        return Optional.of(results.get(0));
    }

    private Optional<OkDemarrage> findExisting(Long operateurId, Long machineId, LocalDate date) {
        List<OkDemarrage> results = okDemarrageRepository
                .findAllByOperateurIdAndMachineIdAndDate(operateurId, machineId, date);
        if (results.isEmpty())
            return Optional.empty();
        if (results.size() > 1) {
            log.warn(
                    "Doublons détectés en base pour opérateur={} machine={} date={} — {} entrées. On prend la plus ancienne (id={}).",
                    operateurId, machineId, date, results.size(), results.get(0).getId());
        }
        return Optional.of(results.get(0));
    }

    /** Fallback quand aucune machine : cherche par opérateur + date uniquement. */
    private Optional<OkDemarrage> findExistingByOperateur(Long operateurId, LocalDate date) {
        List<OkDemarrage> results = okDemarrageRepository
                .findAllByOperateurIdAndMachineIdNullAndDate(operateurId, date);
        if (results.isEmpty())
            return Optional.empty();
        if (results.size() > 1) {
            log.warn(
                    "Doublons détectés (sans machine) pour opérateur={} date={} — {} entrées.",
                    operateurId, date, results.size());
        }
        return Optional.of(results.get(0));
    }

    private Optional<OkDemarrage> findMachineConflict(Long operateurId, Long machineId,
            OkDemarrage.Session session, LocalDate date) {
        return okDemarrageRepository
                .findConflictingByMachineIdAndSessionAndDateAndOperateurIdNotAndStatusNot(
                        machineId, session, date, operateurId, OkDemarrage.Status.EN_COURS)
                .stream()
                .findFirst();
    }

    private Optional<OkDemarrage> findMachineConflict(Long operateurId, Long machineId, LocalDate date) {
        return okDemarrageRepository
                .findConflictingByMachineIdAndDateAndOperateurIdNotAndStatusNot(
                        machineId, date, operateurId, OkDemarrage.Status.EN_COURS)
                .stream()
                .findFirst();
    }


    
    @Transactional
    public ChecklistDTO sauvegarderBrouillon(ChecklistRequest req) {
        Machine machine = (req.getMachineId() != null)
                ? machineRepository.findById(req.getMachineId())
                        .orElseThrow(() -> new RuntimeException("Machine introuvable"))
                : null;
        Utilisateur operateur = utilisateurRepository.findById(req.getOperateurId())
                .orElseThrow(() -> new RuntimeException("Opérateur introuvable"));
        Site site = resolveSite(req, machine, operateur);

        LocalDate date = req.getDate() != null ? req.getDate() : LocalDate.now();
        OkDemarrage.Session session = req.getSession() != null ? req.getSession() : OkDemarrage.Session.M;

        // Chercher un brouillon existant (sans machine si machine null)
        Optional<OkDemarrage> existing = (machine != null)
                ? findExisting(operateur.getId(), machine.getId(), date)
                : findExistingByOperateur(operateur.getId(), date);
        Optional<OkDemarrage> conflict = (machine != null)
                ? findMachineConflict(operateur.getId(), machine.getId(), date)
                : Optional.empty();

        OkDemarrage okd;
        if (existing.isPresent()) {
            okd = existing.get();

            // Ne pas écraser si déjà soumis
            if (okd.getStatus() != OkDemarrage.Status.EN_COURS) {
                throw new RuntimeException(
                        "Cette checklist a déjà été soumise (statut : " + okd.getStatus() + "). " +
                                "Impossible de la modifier.");
            }

            // Supprimer les anciennes réponses du brouillon
            if (okd.getId() != null) {
                reponseCritereRepository.deleteByOkDemarrageId(okd.getId());
            }
        } else {
            if (conflict.isPresent()) {
                throw new RuntimeException(
                        "Cette machine est déjà utilisée par un autre opérateur pour ce processus et cette date.");
            }

            // Nouveau brouillon
            okd = new OkDemarrage();
            okd.setDate(date);
            okd.setSession(session);
            okd.setMachine(machine);
            okd.setOperateur(operateur);
            okd.setSite(site);
            okd.setStatus(OkDemarrage.Status.EN_COURS);
        }

        // Sauvegarder les réponses partielles (peut être vide ou incomplet)
        List<ReponseCritere> reponses = new ArrayList<>();
        if (req.getReponses() != null) {
            for (ChecklistRequest.ReponseDto r : req.getReponses()) {
                if (r.getCritereId() == null || r.getValeur() == null)
                    continue;
                Critere critere = critereRepository.findById(r.getCritereId()).orElse(null);
                if (critere == null)
                    continue;
                ReponseCritere rep = new ReponseCritere();
                rep.setValeur(r.getValeur());
                rep.setCommentaire(r.getCommentaire());
                rep.setCritere(critere);
                rep.setOkDemarrage(okd);
                reponses.add(rep);
            }
        }

        okd.setReponses(reponses);
        return toDTO(okDemarrageRepository.save(okd));
    }

    /**
     * Soumettre une checklist complète.
     * Si un brouillon EN_COURS existe → le finaliser (passer à SOUMIS).
     * Sinon crée directement en SOUMIS.
     * Bloque si déjà soumis pour cette combinaison opérateur/machine/session/date.
     */
    @Transactional
    public ChecklistDTO soumettre(ChecklistRequest req, int dureeFillSec) {
        if (req.getReponses() == null || req.getReponses().isEmpty()) {
            throw new RuntimeException("Aucune réponse à soumettre.");
        }

        // Validation des reponses
        req.getReponses().forEach(r -> {
            if (r.getCritereId() == null) {
                throw new RuntimeException("Un critère soumis est invalide (id manquant).");
            }
            if (r.getValeur() == null) {
                throw new RuntimeException("Une réponse soumise est invalide (valeur manquante).");
            }
        });

        Machine machine = (req.getMachineId() != null)
                ? machineRepository.findById(req.getMachineId())
                        .orElseThrow(() -> new RuntimeException("Machine introuvable"))
                : null;
        Utilisateur operateur = utilisateurRepository.findById(req.getOperateurId())
                .orElseThrow(() -> new RuntimeException("Opérateur introuvable"));
        Site site = resolveSite(req, machine, operateur);

        LocalDate date = req.getDate() != null ? req.getDate() : LocalDate.now();
        OkDemarrage.Session session = req.getSession() != null ? req.getSession() : OkDemarrage.Session.M;

        // Résoudre le brouillon en cours UNE SEULE FOIS (utilisé aussi pour la règle
        // journée)
        Optional<OkDemarrage> existing = (machine != null)
                ? findExisting(operateur.getId(), machine.getId(), date)
                : findExistingByOperateur(operateur.getId(), date);

        // ── Règle : une seule soumission par opérateur par journée ──
        // On applique la règle uniquement s'il n'existe PAS de brouillon EN_COURS
        // pour cette soumission, car la finalisation d'un brouillon existant est
        // toujours autorisée.
        if (limitOneSubmissionPerDay && existing.isEmpty()) {
            List<OkDemarrage> soumisJournee = okDemarrageRepository
                    .findSoumisParJournee(operateur.getId(), date, OkDemarrage.Status.EN_COURS);
            if (!soumisJournee.isEmpty()) {
                OkDemarrage deja = soumisJournee.get(0);
                throw new RuntimeException(
                        "Vous avez déjà soumis une checklist aujourd'hui (id=" + deja.getId() + "). " +
                                "La soumission est limitée à une seule fois par journée par opérateur.");
            }
        }
        Optional<OkDemarrage> conflict = (machine != null)
                ? findMachineConflict(operateur.getId(), machine.getId(), date)
                : Optional.empty();

        OkDemarrage okd;
        OkDemarrage.Status beforeStatus = null;
        if (existing.isPresent()) {
            okd = existing.get();
            beforeStatus = okd.getStatus();
            // Bloquer si déjà soumis
            if (okd.getStatus() != OkDemarrage.Status.EN_COURS) {
                if (okd.getStatus() == OkDemarrage.Status.SOUMIS) {
                    return toDTO(okd);
                }
                throw new RuntimeException(
                        "Cette checklist a déjà été soumise pour cette machine aujourd'hui. " +
                                "Statut actuel : " + okd.getStatus());
            }
            // Reprendre le brouillon et le finaliser
            if (okd.getId() != null) {
                reponseCritereRepository.deleteByOkDemarrageId(okd.getId());
            }
        } else {
            if (conflict.isPresent()) {
                throw new RuntimeException(
                        "Cette machine est déjà utilisée par un autre opérateur pour ce processus et cette date.");
            }
            // Aucun brouillon, créer directement
            okd = new OkDemarrage();
            okd.setDate(date);
            okd.setSession(session);
            okd.setMachine(machine);
            okd.setOperateur(operateur);
            okd.setSite(site);
            beforeStatus = okd.getStatus();
        }

        okd.setStatus(OkDemarrage.Status.SOUMIS);

        List<ReponseCritere> reponses = req.getReponses().stream().map(r -> {
            Critere critere = critereRepository.findById(r.getCritereId())
                    .orElseThrow(() -> new RuntimeException("Critère introuvable"));
            ReponseCritere rep = new ReponseCritere();
            rep.setValeur(r.getValeur());
            rep.setCommentaire(r.getCommentaire());
            rep.setCritere(critere);
            rep.setOkDemarrage(okd);
            return rep;
        }).toList();

        okd.setReponses(reponses);
        OkDemarrage saved = okDemarrageRepository.save(okd);
        notifierSansBloquer("soumission", () -> notifierSoumission(saved, operateur));
        checklistAuditService.logAction(
                saved,
                operateur != null ? operateur.getMatricule() : null,
                ChecklistAuditLog.Action.SOUMISSION,
                beforeStatus != null ? beforeStatus.name() : null,
                saved.getStatus() != null ? saved.getStatus().name() : null,
                "Checklist soumise",
                null);

        OkDemarrage refreshed = okDemarrageRepository.findById(saved.getId()).orElse(saved);
        return toDTO(refreshed);
    }

    /**
     * Récupérer les brouillons d'un opérateur (statut EN_COURS uniquement).
     */
    public List<ChecklistDTO> getBrouillonsOperateur(Long operateurId, String date) {
        List<OkDemarrage> brouillons = okDemarrageRepository
                .findByOperateurIdAndStatus(operateurId, OkDemarrage.Status.EN_COURS);

        // Si une date est fournie, filtrer uniquement sur cette date
        if (date != null && !date.isBlank()) {
            LocalDate localDate = LocalDate.parse(date);
            brouillons = brouillons.stream()
                    .filter(b -> b.getDate().equals(localDate))
                    .toList();
        }

        return brouillons.stream().map(this::toDTO).toList();
    }

    // ── Validation N1 (Chef de Ligne) ────────────────────────────────
    // Workflow VERT : autorisée dès SOUMIS
    // Workflow JAUNE : autorisée après clôture du plan JAUNE par le technicien
    // (CLOS)
    // Workflow ROUGE : autorisée après validation AQ du plan ROUGE (VALIDE_AQ ou
    // CLOS)
    @Transactional
    public ChecklistDTO validerN1(Long id, String matricule) {
        OkDemarrage okd = okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable"));
        OkDemarrage.Status beforeStatus = okd.getStatus();
        if (okd.getStatus() == OkDemarrage.Status.EN_COURS)
            throw new RuntimeException("Validation N1 impossible : checklist non soumise.");
        if (okd.getStatus() == OkDemarrage.Status.REJETE || okd.getStatus() == OkDemarrage.Status.VALIDE_FINAL)
            throw new RuntimeException("Validation N1 impossible : checklist déjà " + okd.getStatus());
        if (okd.getDateValidationN1() != null)
            throw new RuntimeException("Validation N1 déjà effectuée.");

        // Workflow ROUGE : l'AQ doit avoir validé le plan (VALIDE_AQ) avant que le chef
        // de ligne puisse valider N1
        assertRedNcPlanValidatedAQ(okd, "Validation N1 bloquée");
        // Workflow JAUNE : le technicien doit avoir clôturé le plan (CLOS) avant que le
        // chef de ligne puisse valider N1
        assertYellowNcPlanClosed(okd, "Validation N1 bloquée");

        Utilisateur validateur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        okd.setValideN1Par(validateur);
        okd.setDateValidationN1(LocalDateTime.now());
        okd.setStatus(OkDemarrage.Status.VALIDE_N1);
        OkDemarrage saved = okDemarrageRepository.save(okd);
        notifierSansBloquer("validation N1", () -> notifierValidationN1(saved, validateur));
        checklistAuditService.logAction(
                saved,
                matricule,
                ChecklistAuditLog.Action.VALIDATION_N1,
                beforeStatus != null ? beforeStatus.name() : null,
                saved.getStatus() != null ? saved.getStatus().name() : null,
                "Validation N1 (Chef de Ligne)",
                null);
        return toDTO(saved);
    }

    // ── Validation N2 (Technicien) ────────────────────────────────────
    // Workflow VERT : autorisée dès que la checklist est soumise
    // Workflow JAUNE : autorisée dès que la checklist est soumise
    // Workflow ROUGE : autorisée dès que la checklist est soumise
    @Transactional
    public ChecklistDTO validerN2(Long id, String matricule) {
        OkDemarrage okd = okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable"));
        OkDemarrage.Status beforeStatus = okd.getStatus();
        if (okd.getStatus() == OkDemarrage.Status.EN_COURS)
            throw new RuntimeException("Validation N2 impossible : checklist non soumise.");
        if (okd.getStatus() == OkDemarrage.Status.REJETE || okd.getStatus() == OkDemarrage.Status.VALIDE_FINAL)
            throw new RuntimeException("Validation N2 impossible : checklist déjà " + okd.getStatus());
        if (okd.getDateValidationN2() != null)
            throw new RuntimeException("Validation N2 déjà effectuée.");

        Utilisateur validateur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        okd.setValideN2Par(validateur);
        okd.setDateValidationN2(LocalDateTime.now());
        okd.setStatus(OkDemarrage.Status.VALIDE_N2);
        OkDemarrage saved = okDemarrageRepository.save(okd);
        notifierSansBloquer("validation N2", () -> notifierValidationN2(saved, validateur));
        checklistAuditService.logAction(
                saved,
                matricule,
                ChecklistAuditLog.Action.VALIDATION_N2,
                beforeStatus != null ? beforeStatus.name() : null,
                saved.getStatus() != null ? saved.getStatus().name() : null,
                "Validation N2 (Technicien)",
                null);
        return toDTO(saved);
    }

    // ── Validation finale N3 (Agent Qualité) ─────────────────────────
    // Workflow VERT : N1 (Chef Ligne) + N2 (Technicien) requis, dans n'importe quel
    // ordre
    // Workflow JAUNE : N1 (Chef Ligne) + N2 (Technicien) requis, dans n'importe
    // quel ordre
    // Workflow ROUGE : N1 (Chef Ligne) + N2 (Technicien) requis, dans n'importe
    // quel ordre
    @Transactional
    public ChecklistDTO validerFinal(Long id, String matricule) {
        OkDemarrage okd = okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable"));
        OkDemarrage.Status beforeStatus = okd.getStatus();
        if (okd.getStatus() == OkDemarrage.Status.REJETE || okd.getStatus() == OkDemarrage.Status.VALIDE_FINAL)
            throw new RuntimeException("Validation finale impossible : checklist déjà " + okd.getStatus());

        if (okd.getDateValidationN1() == null)
            throw new RuntimeException("Validation finale impossible : la validation N1 du Chef de Ligne est requise.");
        if (okd.getDateValidationN2() == null)
            throw new RuntimeException("Validation finale impossible : la validation N2 du Technicien est requise.");

        // Plans ROUGE doivent être VALIDE_AQ avant la validation finale
        assertRedNcPlanValidatedAQ(okd, "Validation finale bloquée");
        // Plans JAUNE doivent être CLOS avant la validation finale
        assertYellowNcPlanClosed(okd, "Validation finale bloquée");

        Utilisateur validateur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        okd.setValideParFinal(validateur);
        okd.setDateValidationFinale(LocalDateTime.now());
        okd.setStatus(OkDemarrage.Status.VALIDE_FINAL);
        OkDemarrage saved = okDemarrageRepository.save(okd);
        notifierSansBloquer("validation finale", () -> notifierValidationFinale(saved, validateur));
        checklistAuditService.logAction(
                saved,
                matricule,
                ChecklistAuditLog.Action.VALIDATION_FINALE,
                beforeStatus != null ? beforeStatus.name() : null,
                saved.getStatus() != null ? saved.getStatus().name() : null,
                "Validation finale N3 (Agent Qualité)",
                null);
        return toDTO(saved);
    }

    // ── Rejet ────────────────────────────────────────────────────────
    @Transactional
    public ChecklistDTO rejeter(Long id, String motif, String matricule) {
        OkDemarrage okd = okDemarrageRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable"));
        OkDemarrage.Status beforeStatus = okd.getStatus();
        if (okd.getStatus() == OkDemarrage.Status.VALIDE_FINAL || okd.getStatus() == OkDemarrage.Status.REJETE)
            throw new RuntimeException("Impossible de rejeter : la checklist est déjà " + okd.getStatus());
        if (motif == null || motif.isBlank())
            throw new RuntimeException("Le motif de rejet est obligatoire.");
        okd.setStatus(OkDemarrage.Status.REJETE);
        okd.setMotifRejet(motif);
        Utilisateur rejecteur = utilisateurRepository.findByMatricule(matricule).orElse(null);
        okd.setRejetePar(rejecteur);
        okd.setDateRejet(LocalDateTime.now());
        OkDemarrage saved = okDemarrageRepository.save(okd);
        notifierSansBloquer("rejet", () -> notifierRejet(saved, rejecteur, motif));
        checklistAuditService.logAction(
                saved,
                matricule,
                ChecklistAuditLog.Action.REJET,
                beforeStatus != null ? beforeStatus.name() : null,
                saved.getStatus() != null ? saved.getStatus().name() : null,
                "Motif: " + motif,
                null);
        return toDTO(saved);
    }

    private void notifierSansBloquer(String contexte, Runnable action) {
        try {
            action.run();
        } catch (Exception ex) {
            log.warn("Notification ignorée après {}: {}", contexte, ex.getMessage());
        }
    }

    /**
     * Résout la couleur réelle d'un critère NC :
     * - Priorité à critere.couleur (la couleur définie dans le référentiel)
     * - Fallback sur r.valeur si critere ou couleur est absent
     *
     * Cas typique : critère JAUNE coché "0" → valeur=ROUGE mais
     * critere.couleur=Jaune
     * → bucket JAUNE → ne doit PAS déclencher le workflow ROUGE.
     */
    private String resolveNcBucket(ReponseCritere r) {
        if (r == null)
            return "";
        String couleur = (r.getCritere() != null) ? r.getCritere().getCouleur() : null;
        if (couleur != null && !couleur.isBlank()) {
            String norm = couleur.trim().toUpperCase();
            if ("ROUGE".equals(norm) || "RED".equals(norm))
                return "ROUGE";
            if ("JAUNE".equals(norm) || "YELLOW".equals(norm))
                return "JAUNE";
        }
        // Fallback : pas de couleur dans le critère → on se base sur la valeur cochée
        if (r.getValeur() == ReponseCritere.Valeur.ROUGE)
            return "ROUGE";
        if (r.getValeur() == ReponseCritere.Valeur.JAUNE)
            return "JAUNE";
        return "";
    }

    /** Vrai seulement si au moins une NC a un critère dont la couleur est ROUGE. */
    private boolean hasRedNc(OkDemarrage okd) {
        if (okd == null || okd.getReponses() == null || okd.getReponses().isEmpty())
            return false;
        return okd.getReponses().stream()
                .filter(r -> r != null && (r.getValeur() == ReponseCritere.Valeur.ROUGE
                        || r.getValeur() == ReponseCritere.Valeur.JAUNE))
                .anyMatch(r -> "ROUGE".equals(resolveNcBucket(r)));
    }

    /**
     * Vrai seulement si au moins une NC a un critère dont la couleur est JAUNE (et
     * aucune ROUGE).
     */
    private boolean hasOnlyYellowNc(OkDemarrage okd) {
        if (okd == null || okd.getReponses() == null || okd.getReponses().isEmpty())
            return false;
        boolean hasAnyNc = okd.getReponses().stream()
                .anyMatch(r -> r != null && (r.getValeur() == ReponseCritere.Valeur.ROUGE
                        || r.getValeur() == ReponseCritere.Valeur.JAUNE));
        return hasAnyNc && !hasRedNc(okd);
    }

    /**
     * Workflow ROUGE : vérifie que tous les plans ROUGE ont été validés par l'Agent
     * Qualité
     * (statut VALIDE_AQ ou CLOS) avant que le Chef de Ligne puisse valider N1.
     * L'AQ doit clôturer le plan ROUGE après que le technicien l'a traité
     * (EN_ATTENTE_VALIDATION_AQ).
     */
    private void assertRedNcPlanValidatedAQ(OkDemarrage okd, String prefix) {
        if (!hasRedNc(okd))
            return;
        List<PlanAction> plans = planActionRepository.findByOkDemarrageIdOrderByCreeLe(okd.getId());
        List<PlanAction> plansRouge = plans == null ? List.of()
                : plans.stream()
                        .filter(p -> p != null && "ROUGE".equalsIgnoreCase(p.getCouleurCritere()))
                        .toList();
        if (plansRouge.isEmpty()) {
            throw new RuntimeException(
                    prefix + " : NC rouge détectée. Le chef de ligne doit d'abord créer un plan d'action ROUGE.");
        }
        // Technicien doit avoir traité (EN_ATTENTE_VALIDATION_AQ) et AQ doit avoir
        // validé (VALIDE_AQ ou CLOS)
        boolean allValidatedByAQ = plansRouge.stream().allMatch(p -> p.getStatut() == PlanAction.Statut.VALIDE_AQ
                || p.getStatut() == PlanAction.Statut.CLOS);
        boolean somePendingTech = plansRouge.stream().anyMatch(p -> p.getStatut() == PlanAction.Statut.OUVERT
                || p.getStatut() == PlanAction.Statut.EN_COURS);
        boolean somePendingAQ = plansRouge.stream()
                .anyMatch(p -> p.getStatut() == PlanAction.Statut.EN_ATTENTE_VALIDATION_AQ);
        if (somePendingTech) {
            throw new RuntimeException(prefix
                    + " : NC rouge détectée. Le technicien doit d'abord traiter et clôturer le plan d'action ROUGE.");
        }
        if (somePendingAQ) {
            throw new RuntimeException(prefix
                    + " : NC rouge détectée. L'Agent Qualité doit d'abord valider le plan d'action ROUGE (critère ROUGE).");
        }
        if (!allValidatedByAQ) {
            throw new RuntimeException(
                    prefix + " : NC rouge détectée. Tous les plans ROUGE doivent être validés par l'Agent Qualité.");
        }
    }

    /**
     * Workflow JAUNE : vérifie que tous les plans JAUNE sont CLOS (par le
     * technicien)
     * avant que le Chef de Ligne puisse valider N1.
     * Ignoré si la checklist a des NC ROUGE (workflow ROUGE prioritaire)
     * ou si elle n'a que des NC conformes.
     */
    private void assertYellowNcPlanClosed(OkDemarrage okd, String prefix) {
        if (!hasOnlyYellowNc(okd))
            return;
        List<PlanAction> plans = planActionRepository.findByOkDemarrageIdOrderByCreeLe(okd.getId());
        List<PlanAction> plansJaune = plans == null ? List.of()
                : plans.stream()
                        .filter(p -> p != null && !"ROUGE".equalsIgnoreCase(p.getCouleurCritere()))
                        .toList();
        if (plansJaune.isEmpty()) {
            throw new RuntimeException(
                    prefix + " : NC jaune détectée. Le chef de ligne doit d'abord créer un plan d'action.");
        }
        boolean allClos = plansJaune.stream()
                .allMatch(p -> p.getStatut() == PlanAction.Statut.CLOS || p.getClosLe() != null);
        if (!allClos) {
            throw new RuntimeException(
                    prefix + " : NC jaune détectée. Le technicien doit d'abord clôturer le plan d'action.");
        }
    }

    // ── Helpers PDF ───────────────────────────────────────────────
    private static final class PdfContext {
        private final PDDocument doc;
        private final PDFont fontRegular;
        private final PDFont fontBold;
        private final PDImageXObject logo;
        private final float margin;
        private final float headerHeight;
        private final float footerHeight;
        private final float pageWidth;
        private final float pageHeight;
        private final String brandName;
        private final String title;
        private final String exportDate;

        private PdfContext(PDDocument doc, PDFont fontRegular, PDFont fontBold, PDImageXObject logo,
                float margin, float headerHeight, float footerHeight,
                String brandName, String title, String exportDate) {
            this.doc = doc;
            this.fontRegular = fontRegular;
            this.fontBold = fontBold;
            this.logo = logo;
            this.margin = margin;
            this.headerHeight = headerHeight;
            this.footerHeight = footerHeight;
            this.pageWidth = PDRectangle.A4.getWidth();
            this.pageHeight = PDRectangle.A4.getHeight();
            this.brandName = brandName;
            this.title = title;
            this.exportDate = exportDate;
        }
    }

    private static final class PdfPageState {
        private final PDPage page;
        private final PDPageContentStream content;
        private float y;
        private final int pageNumber;

        private PdfPageState(PDPage page, PDPageContentStream content, float y, int pageNumber) {
            this.page = page;
            this.content = content;
            this.y = y;
            this.pageNumber = pageNumber;
        }
    }

    private static final class RowLayout {
        private final List<List<String>> lines;
        private final float height;

        private RowLayout(List<List<String>> lines, float height) {
            this.lines = lines;
            this.height = height;
        }
    }

    private byte[] renderPdf(OkDemarrage okd, List<PlanAction> plans, List<ChecklistAuditLogDTO> auditLogs) {
        try (PDDocument doc = new PDDocument()) {
            PDFont fontRegular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDFont fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            float margin = 40f;
            float headerHeight = 60f;
            float footerHeight = 28f;

            String title = "Dossier checklist #" + okd.getId();
            String exportDate = fmtDateTime(LocalDateTime.now());

            PDImageXObject logo = loadLogo(doc);
            PdfContext ctx = new PdfContext(doc, fontRegular, fontBold, logo,
                    margin, headerHeight, footerHeight,
                    pdfBrandName, title, exportDate);

            PdfPageState state = newPage(ctx, 1);

            // Infos checklist
            state = drawSectionTitle(ctx, state, "Infos checklist");
            List<List<String>> infoRows = new ArrayList<>();
            infoRows.add(List.of("Checklist ID", nvl(okd.getId() != null ? okd.getId().toString() : null)));
            infoRows.add(List.of("Date", fmtDate(okd.getDate())));
            infoRows.add(List.of("Session", okd.getSession() != null ? okd.getSession().name() : "—"));
            infoRows.add(List.of("Statut", okd.getStatus() != null ? okd.getStatus().name() : "—"));
            infoRows.add(List.of("Operateur", formatUser(okd.getOperateur())));
            infoRows.add(List.of("Machine", nvl(okd.getMachine() != null ? okd.getMachine().getNom() : null)));
            infoRows.add(List.of("Processus",
                    nvl(okd.getMachine() != null && okd.getMachine().getProcessus() != null
                            ? okd.getMachine().getProcessus().getNom()
                            : null)));
            infoRows.add(List.of("Site", nvl(okd.getSite() != null ? okd.getSite().getNom() : null)));
            state = drawKeyValueTable(ctx, state, infoRows);
            state.y -= 8f;

            // Validations
            state = drawSectionTitle(ctx, state, "Validations");
            List<List<String>> validationRows = new ArrayList<>();
            validationRows.add(List.of("Niveau 1",
                    fmtDateTime(okd.getDateValidationN1()),
                    formatUser(okd.getValideN1Par()),
                    okd.getDateValidationN1() != null ? "Valide" : "En attente"));
            validationRows.add(List.of("Niveau 2",
                    fmtDateTime(okd.getDateValidationN2()),
                    formatUser(okd.getValideN2Par()),
                    okd.getDateValidationN2() != null ? "Valide" : "En attente"));
            validationRows.add(List.of("Finale",
                    fmtDateTime(okd.getDateValidationFinale()),
                    formatUser(okd.getValideParFinal()),
                    okd.getDateValidationFinale() != null ? "Valide" : "En attente"));

            float tableWidth = ctx.pageWidth - (ctx.margin * 2);
            float[] validationWidths = normalizeWidths(tableWidth, new float[] { 90f, 120f, 200f, -1f });
            state = drawTable(ctx, state,
                    new String[] { "Niveau", "Date", "Par", "Statut" },
                    validationWidths,
                    validationRows);

            if (okd.getStatus() == OkDemarrage.Status.REJETE
                    && okd.getMotifRejet() != null && !okd.getMotifRejet().isBlank()) {
                state = drawParagraph(ctx, state, "Motif rejet: " + okd.getMotifRejet());
            }
            state.y -= 8f;

            // Reponses criteres
            state = drawSectionTitle(ctx, state, "Reponses criteres");
            if (okd.getReponses() == null || okd.getReponses().isEmpty()) {
                state = drawParagraph(ctx, state, "Aucune reponse.");
            } else {
                List<List<String>> responseRows = new ArrayList<>();
                int idx = 1;
                for (ReponseCritere r : okd.getReponses()) {
                    String critereNom = r.getCritere() != null ? r.getCritere().getNom() : "Critere";
                    String valeur = r.getValeur() != null ? r.getValeur().name() : "—";
                    String commentaire = nvl(r.getCommentaire());
                    responseRows.add(List.of(String.valueOf(idx), valeur, critereNom, commentaire));
                    idx++;
                }

                float[] responseWidths = normalizeWidths(tableWidth, new float[] { 32f, 70f, 200f, -1f });
                state = drawTable(ctx, state,
                        new String[] { "#", "Valeur", "Critere", "Commentaire" },
                        responseWidths,
                        responseRows);
            }
            state.y -= 8f;

            // Plans d'action
            state = drawSectionTitle(ctx, state, "Plans d'action");
            if (plans == null || plans.isEmpty()) {
                state = drawParagraph(ctx, state, "Aucun plan d'action.");
            } else {
                List<List<String>> planRows = new ArrayList<>();
                for (PlanAction pa : plans) {
                    String resp = formatPlanResponsable(pa);
                    String desc = nvl(pa.getDescription());
                    planRows.add(List.of(
                            nvl(pa.getId() != null ? pa.getId().toString() : null),
                            pa.getStatut() != null ? pa.getStatut().name() : "—",
                            pa.getPriorite() != null ? pa.getPriorite().name() : "—",
                            resp,
                            fmtDate(pa.getDateEcheance()),
                            desc));
                }

                float[] planWidths = normalizeWidths(tableWidth, new float[] { 36f, 70f, 70f, 120f, 80f, -1f });
                state = drawTable(ctx, state,
                        new String[] { "ID", "Statut", "Priorite", "Responsable", "Echeance", "Description" },
                        planWidths,
                        planRows);
            }
            state.y -= 8f;

            // Journal d'audit
            state = drawSectionTitle(ctx, state, "Journal d'audit");
            if (auditLogs == null || auditLogs.isEmpty()) {
                state = drawParagraph(ctx, state, "Aucune action.");
            } else {
                List<List<String>> auditRows = new ArrayList<>();
                for (ChecklistAuditLogDTO log : auditLogs) {
                    String action = formatAuditAction(log.getAction());
                    String status = formatAuditStatus(log);
                    String who = log.getUtilisateurNom() != null ? log.getUtilisateurNom() : log.getMatricule();
                    auditRows.add(List.of(
                            fmtDateTime(log.getDateAction()),
                            action,
                            nvl(status),
                            nvl(who),
                            nvl(log.getDetails())));
                }

                float[] auditWidths = normalizeWidths(tableWidth, new float[] { 110f, 110f, 110f, 110f, -1f });
                state = drawTable(ctx, state,
                        new String[] { "Date", "Action", "Statut", "Utilisateur", "Details" },
                        auditWidths,
                        auditRows);
            }

            state.content.close();
            addPageNumbers(doc, ctx.fontRegular, 9f, ctx.margin);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new RuntimeException("Erreur lors de la generation PDF", ex);
        }
    }

    private PdfPageState newPage(PdfContext ctx, int pageNumber) throws IOException {
        PDPage page = new PDPage(PDRectangle.A4);
        ctx.doc.addPage(page);
        PDPageContentStream content = new PDPageContentStream(ctx.doc, page);
        float y = drawHeader(ctx, content);
        return new PdfPageState(page, content, y, pageNumber);
    }

    private float drawHeader(PdfContext ctx, PDPageContentStream content) throws IOException {
        float top = ctx.pageHeight - ctx.margin;
        float headerBottom = top - ctx.headerHeight;
        float logoHeight = 32f;
        float logoWidth = 0f;
        float logoX = ctx.margin;

        // Fond très léger pour l'en-tête
        content.setNonStrokingColor(PdfStyleLeoni.getHeaderBackgroundColor());
        content.addRect(0, headerBottom - 2f, ctx.pageWidth, ctx.headerHeight + 2f);
        content.fill();
        content.setNonStrokingColor(PdfStyleLeoni.LEONI_BLACK);

        if (ctx.logo != null) {
            float ratio = ctx.logo.getWidth() > 0 ? (float) ctx.logo.getHeight() / (float) ctx.logo.getWidth() : 1f;
            logoWidth = ratio > 0 ? logoHeight / ratio : logoHeight;
            float logoY = top - logoHeight;
            content.drawImage(ctx.logo, logoX, logoY, logoWidth, logoHeight);
        }

        float textX = ctx.margin + (logoWidth > 0 ? logoWidth + 10f : 0f);
        
        // Marque Leoni en gris foncé
        drawText(content, ctx.fontBold, PdfStyleLeoni.Design.FONT_TITLE, textX, top - 10f, nvl(ctx.brandName));
        
        // Titre en gris moyen
        drawText(content, ctx.fontRegular, PdfStyleLeoni.Design.FONT_HEADER, textX, top - 26f, ctx.title);

        // Date d'export à droite en gris clair
        drawRightAlignedText(content, ctx.fontRegular, PdfStyleLeoni.Design.FONT_SMALL,
                ctx.pageWidth - ctx.margin, top - 10f, "Généré: " + ctx.exportDate);

        // Ligne de bordure fine en bas de l'en-tête
        content.setStrokingColor(PdfStyleLeoni.getHeaderBorderColor());
        content.setLineWidth(0.75f);
        content.moveTo(ctx.margin, headerBottom);
        content.lineTo(ctx.pageWidth - ctx.margin, headerBottom);
        content.stroke();
        content.setStrokingColor(PdfStyleLeoni.LEONI_BLACK);

        return headerBottom - 12f;
    }

    private void drawText(PDPageContentStream content, PDFont font, float fontSize,
            float x, float y, String text) throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(safeLine(text));
        content.endText();
    }

    private void drawRightAlignedText(PDPageContentStream content, PDFont font, float fontSize,
            float rightX, float y, String text) throws IOException {
        float textWidth = textWidth(font, fontSize, text);
        drawText(content, font, fontSize, rightX - textWidth, y, text);
    }

    private PdfPageState ensureSpace(PdfContext ctx, PdfPageState state, float requiredHeight) throws IOException {
        if (state.y - requiredHeight < ctx.margin + ctx.footerHeight) {
            state.content.close();
            return newPage(ctx, state.pageNumber + 1);
        }
        return state;
    }

    private PdfPageState drawSectionTitle(PdfContext ctx, PdfPageState state, String title) throws IOException {
        state = ensureSpace(ctx, state, 24f);
        
        // Fond blanc pur pour le titre
        float lineHeight = 16f;
        state.content.setNonStrokingColor(PdfStyleLeoni.LEONI_WHITE);
        state.content.addRect(ctx.margin, state.y - lineHeight, ctx.pageWidth - (ctx.margin * 2), lineHeight);
        state.content.fill();
        
        // Titre en couleur Leoni
        drawText(state.content, ctx.fontBold, PdfStyleLeoni.Design.FONT_SUBTITLE, ctx.margin + 2f, state.y - 3f, title);
        
        // Ligne bleue professionnelle sous le titre
        float lineY = state.y - lineHeight;
        state.content.setStrokingColor(PdfStyleLeoni.getSectionLineColor());
        state.content.setLineWidth(2f);
        state.content.moveTo(ctx.margin, lineY);
        state.content.lineTo(ctx.pageWidth - ctx.margin, lineY);
        state.content.stroke();
        state.content.setStrokingColor(PdfStyleLeoni.LEONI_BLACK);
        state.content.setLineWidth(0.5f);
        
        state.y = lineY - 12f;
        return state;
    }

    private PdfPageState drawKeyValueTable(PdfContext ctx, PdfPageState state, List<List<String>> rows)
            throws IOException {
        float tableWidth = ctx.pageWidth - (ctx.margin * 2);
        float[] widths = normalizeWidths(tableWidth, new float[] { 130f, -1f });
        return drawTable(ctx, state,
                new String[] { "Champ", "Valeur" },
                widths,
                rows);
    }

    private PdfPageState drawTable(PdfContext ctx, PdfPageState state, String[] headers,
            float[] colWidths, List<List<String>> rows) throws IOException {
        float x = ctx.margin;
        float y = state.y;
        float tableWidth = 0f;
        for (float w : colWidths) {
            tableWidth += w;
        }

        float headerFontSize = 10.5f;
        float rowFontSize = 10f;
        float padding = 3f;

        RowLayout headerLayout = buildRowLayout(List.of(headers), ctx.fontBold, headerFontSize, colWidths, padding);
        state = ensureSpace(ctx, state, headerLayout.height);
        y = state.y;

        drawRow(ctx, state.content, x, y, tableWidth, headerLayout, colWidths, ctx.fontBold,
                headerFontSize, padding, true, false);
        y -= headerLayout.height;

        int rowIndex = 0;
        for (List<String> row : rows) {
            RowLayout layout = buildRowLayout(row, ctx.fontRegular, rowFontSize, colWidths, padding);
            if (y - layout.height < ctx.margin + ctx.footerHeight) {
                state.content.close();
                state = newPage(ctx, state.pageNumber + 1);
                y = state.y;
                drawRow(ctx, state.content, x, y, tableWidth, headerLayout, colWidths, ctx.fontBold,
                        headerFontSize, padding, true, false);
                y -= headerLayout.height;
            }

            boolean zebra = rowIndex % 2 == 1;
            drawRow(ctx, state.content, x, y, tableWidth, layout, colWidths, ctx.fontRegular,
                    rowFontSize, padding, false, zebra);
            y -= layout.height;
            rowIndex++;
        }

        state.y = y - 6f;
        return state;
    }

    private RowLayout buildRowLayout(List<String> cells, PDFont font, float fontSize,
            float[] colWidths, float padding) throws IOException {
        List<List<String>> lines = new ArrayList<>();
        int maxLines = 1;
        float leading = fontSize + 2f;

        for (int i = 0; i < colWidths.length; i++) {
            String cell = i < cells.size() ? cells.get(i) : "";
            float maxWidth = Math.max(10f, colWidths[i] - (padding * 2));
            List<String> wrapped = wrapTextToWidth(cell, font, fontSize, maxWidth);
            lines.add(wrapped);
            if (wrapped.size() > maxLines) {
                maxLines = wrapped.size();
            }
        }

        float height = (maxLines * leading) + (padding * 2);
        return new RowLayout(lines, height);
    }

    private void drawRow(PdfContext ctx, PDPageContentStream content,
            float x, float y, float tableWidth, RowLayout layout, float[] colWidths,
            PDFont font, float fontSize, float padding, boolean header, boolean zebra) throws IOException {
        float rowHeight = layout.height;

        if (header) {
            // En-tête: gris très foncé avec texte blanc
            content.setNonStrokingColor(PdfStyleLeoni.getTableHeaderBgColor());
            content.addRect(x, y - rowHeight, tableWidth, rowHeight);
            content.fill();
            content.setNonStrokingColor(PdfStyleLeoni.getTableHeaderTextColor());
        } else if (zebra) {
            // Alternance très subtile
            content.setNonStrokingColor(PdfStyleLeoni.getTableRowAlternateColor());
            content.addRect(x, y - rowHeight, tableWidth, rowHeight);
            content.fill();
            content.setNonStrokingColor(PdfStyleLeoni.getTableTextColor());
        } else {
            // Blanc pour les lignes normales
            content.setNonStrokingColor(PdfStyleLeoni.LEONI_WHITE);
            content.addRect(x, y - rowHeight, tableWidth, rowHeight);
            content.fill();
            content.setNonStrokingColor(PdfStyleLeoni.getTableTextColor());
        }

        // Bordures fines en gris clair
        content.setStrokingColor(PdfStyleLeoni.getTableBorderColor());
        content.setLineWidth(PdfStyleLeoni.Design.BORDER_THICKNESS);
        content.addRect(x, y - rowHeight, tableWidth, rowHeight);
        content.stroke();

        // Lignes verticales
        float xPos = x;
        for (float w : colWidths) {
            xPos += w;
            content.moveTo(xPos, y);
            content.lineTo(xPos, y - rowHeight);
            content.stroke();
        }
        content.setStrokingColor(PdfStyleLeoni.LEONI_BLACK);

        // Texte
        float leading = fontSize + 2f;
        xPos = x;
        for (int i = 0; i < colWidths.length; i++) {
            List<String> lines = i < layout.lines.size() ? layout.lines.get(i) : List.of(" ");
            float textY = y - padding - fontSize;
            for (String line : lines) {
                drawText(content, font, fontSize, xPos + padding, textY, line);
                textY -= leading;
                if (textY < (y - rowHeight + padding)) {
                    break;
                }
            }
            xPos += colWidths[i];
        }
    }

    private PdfPageState drawParagraph(PdfContext ctx, PdfPageState state, String text) throws IOException {
        float fontSize = 10f;
        float maxWidth = ctx.pageWidth - (ctx.margin * 2);
        List<String> lines = wrapTextToWidth(text, ctx.fontRegular, fontSize, maxWidth);
        float leading = fontSize + 2f;

        for (String line : lines) {
            state = ensureSpace(ctx, state, leading);
            drawText(state.content, ctx.fontRegular, fontSize, ctx.margin, state.y, line);
            state.y -= leading;
        }
        return state;
    }

    private void addPageNumbers(PDDocument doc, PDFont font, float fontSize, float margin) throws IOException {
        int total = doc.getNumberOfPages();
        for (int i = 0; i < total; i++) {
            PDPage page = doc.getPage(i);
            float pageWidth = page.getMediaBox().getWidth();
            float y = margin - 10f;
            String label = "Page " + (i + 1) + " / " + total;

            try (PDPageContentStream footer = new PDPageContentStream(doc, page,
                    PDPageContentStream.AppendMode.APPEND, true)) {
                // Ligne de séparation fine en haut du pied de page
                footer.setStrokingColor(PdfStyleLeoni.getFooterBorderColor());
                footer.setLineWidth(0.5f);
                footer.moveTo(margin, y + 5f);
                footer.lineTo(pageWidth - margin, y + 5f);
                footer.stroke();
                
                // Numéro de page en gris clair
                footer.setNonStrokingColor(PdfStyleLeoni.getFooterTextColor());
                drawRightAlignedText(footer, font, fontSize, pageWidth - margin, y, label);
                footer.setNonStrokingColor(PdfStyleLeoni.LEONI_BLACK);
            }
        }
    }

    private List<String> wrapTextToWidth(String text, PDFont font, float fontSize, float maxWidth)
            throws IOException {
        String clean = safeLine(text).trim();
        if (clean.isEmpty()) {
            return List.of("—");
        }

        List<String> out = new ArrayList<>();
        String[] words = clean.split("\\s+");
        StringBuilder line = new StringBuilder();

        for (String word : words) {
            if (line.length() == 0) {
                line.append(word);
                continue;
            }
            String next = line + " " + word;
            if (textWidth(font, fontSize, next) <= maxWidth) {
                line.append(" ").append(word);
            } else {
                out.add(line.toString());
                line = new StringBuilder(word);
            }
        }
        if (line.length() > 0) {
            out.add(line.toString());
        }
        return out;
    }

    private float textWidth(PDFont font, float fontSize, String text) throws IOException {
        return font.getStringWidth(text) / 1000f * fontSize;
    }

    private float[] normalizeWidths(float totalWidth, float[] widths) {
        float used = 0f;
        int autoCount = 0;
        for (float w : widths) {
            if (w <= 0f) {
                autoCount++;
            } else {
                used += w;
            }
        }
        float remaining = Math.max(0f, totalWidth - used);
        float auto = autoCount > 0 ? remaining / autoCount : 0f;
        float[] out = new float[widths.length];
        for (int i = 0; i < widths.length; i++) {
            out[i] = widths[i] <= 0f ? auto : widths[i];
        }
        return out;
    }

    private PDImageXObject loadLogo(PDDocument doc) {
        if (pdfLogoPath == null || pdfLogoPath.isBlank()) {
            return null;
        }
        Path path = Paths.get(pdfLogoPath);
        if (!Files.exists(path)) {
            log.warn("Logo PDF introuvable: {}", pdfLogoPath);
            return null;
        }

        try (InputStream in = Files.newInputStream(path)) {
            String lower = pdfLogoPath.toLowerCase();
            if (lower.endsWith(".png")) {
                BufferedImage img = ImageIO.read(in);
                if (img == null) {
                    return null;
                }
                return LosslessFactory.createFromImage(doc, img);
            }
            return JPEGFactory.createFromStream(doc, in);
        } catch (Exception ex) {
            log.warn("Logo PDF non charge: {}", ex.getMessage());
            return null;
        }
    }

    private String formatUser(Utilisateur user) {
        if (user == null) {
            return "—";
        }
        String nom = user.getNom() != null ? user.getNom() : "";
        String matricule = user.getMatricule() != null ? user.getMatricule() : "";
        if (nom.isBlank() && matricule.isBlank()) {
            return "—";
        }
        if (matricule.isBlank()) {
            return nom;
        }
        if (nom.isBlank()) {
            return matricule;
        }
        return nom + " (" + matricule + ")";
    }

    private String formatPlanResponsable(PlanAction plan) {
        if (plan == null) {
            return "—";
        }
        if (plan.getResponsableNom() != null && !plan.getResponsableNom().isBlank()) {
            return plan.getResponsableNom();
        }
        if (plan.getResponsableMatricule() != null && !plan.getResponsableMatricule().isBlank()) {
            return plan.getResponsableMatricule();
        }
        if (plan.getResponsable() != null) {
            return formatUser(plan.getResponsable());
        }
        return "—";
    }

    private String formatAuditStatus(ChecklistAuditLogDTO log) {
        if (log == null) {
            return "";
        }
        if (log.getStatutAvant() == null && log.getStatutApres() == null) {
            return "";
        }
        String before = nvl(log.getStatutAvant());
        String after = nvl(log.getStatutApres());
        return before + " -> " + after;
    }

    private String safeLine(String text) {
        if (text == null)
            return "";
        return text.replace("\t", " ").replace("\n", " ").replace("\r", " ");
    }

    private String nvl(String value) {
        return value != null && !value.isBlank() ? value : "—";
    }

    private void appendWrapped(List<String> lines, String text) {
        for (String line : wrapText(text, 110)) {
            lines.add(line);
        }
    }

    private List<String> wrapText(String text, int maxLen) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isBlank()) {
            out.add("—");
            return out;
        }
        String remaining = text.trim();
        while (remaining.length() > maxLen) {
            int cut = remaining.lastIndexOf(' ', maxLen);
            if (cut <= 0)
                cut = maxLen;
            out.add(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
        }
        if (!remaining.isBlank())
            out.add(remaining);
        return out;
    }

    private String fmtDate(LocalDate date) {
        return date != null ? DATE_FMT.format(date) : "—";
    }

    private String fmtDateTime(LocalDateTime date) {
        return date != null ? DATE_TIME_FMT.format(date) : "—";
    }

    private String validationLine(LocalDateTime date, Utilisateur user) {
        if (date == null)
            return "En attente";
        String nom = user != null ? user.getNom() : "—";
        return "Valide par " + nom + " le " + fmtDateTime(date);
    }

    private String formatAuditAction(ChecklistAuditLog.Action action) {
        if (action == null)
            return "Action";
        return switch (action) {
            case SOUMISSION -> "Soumission";
            case VALIDATION_N1 -> "Validation N1";
            case VALIDATION_N2 -> "Validation N2";
            case VALIDATION_FINALE -> "Validation finale";
            case REJET -> "Rejet";
            case PLAN_ACTION_CREE -> "Plan action cree";
            case PLAN_ACTION_EN_COURS -> "Plan action en cours";
            case PLAN_ACTION_CLOTURE -> "Plan action cloture";
            case PLAN_ACTION_VALIDE_AQ -> "Plan action valide AQ";
            case PLAN_ACTION_SUPPRIME -> "Plan action supprime";
            case SUPPRESSION -> "Suppression";
        };
    }

    private Site resolveSite(ChecklistRequest req, Machine machine, Utilisateur operateur) {
        if (req == null) {
            log.warn("resolveSite: requete null");
            throw new RuntimeException("Site introuvable : requete invalide.");
        }

        if (req.getSiteId() != null) {
            Long siteId = req.getSiteId();
            return siteRepository.findById(siteId)
                    .orElseThrow(() -> new RuntimeException("Site introuvable (id=" + siteId + ")"));
        }

        // Machine fournie : résolution via la machine
        if (machine != null) {
            if (machine.getSite() != null)
                return machine.getSite();
            if (machine.getPlant() != null && machine.getPlant().getSite() != null)
                return machine.getPlant().getSite();
            if (machine.getSegment() != null
                    && machine.getSegment().getPlant() != null
                    && machine.getSegment().getPlant().getSite() != null)
                return machine.getSegment().getPlant().getSite();
            if (machine.getProcessus() != null
                    && machine.getProcessus().getSegment() != null
                    && machine.getProcessus().getSegment().getPlant() != null
                    && machine.getProcessus().getSegment().getPlant().getSite() != null)
                return machine.getProcessus().getSegment().getPlant().getSite();
        }

        // Pas de machine : fallback via affectation opérateur
        if (operateur != null) {
            if (operateur.getSite() != null) {
                return operateur.getSite();
            }
            if (operateur.getPlant() != null && operateur.getPlant().getSite() != null) {
                return operateur.getPlant().getSite();
            }
            if (operateur.getSegment() != null
                    && operateur.getSegment().getPlant() != null
                    && operateur.getSegment().getPlant().getSite() != null) {
                return operateur.getSegment().getPlant().getSite();
            }
            if (operateur.getProcessus() != null
                    && operateur.getProcessus().getSegment() != null
                    && operateur.getProcessus().getSegment().getPlant() != null
                    && operateur.getProcessus().getSegment().getPlant().getSite() != null) {
                return operateur.getProcessus().getSegment().getPlant().getSite();
            }
        }

        // Pas de machine et pas d'affectation opérateur : fallback via processusId de
        // la requête
        if (req.getProcessusId() != null) {
            Processus processus = processusRepository.findById(req.getProcessusId())
                    .orElseThrow(() -> new RuntimeException("Processus introuvable (id=" + req.getProcessusId() + ")"));
            if (processus.getSegment() != null
                    && processus.getSegment().getPlant() != null
                    && processus.getSegment().getPlant().getSite() != null) {
                return processus.getSegment().getPlant().getSite();
            }
        }

        log.warn("resolveSite: machine null, siteId absent et aucune affectation site trouvée");
        throw new RuntimeException("Site introuvable : fournissez siteId dans la requête ou associez une machine.");
    }

    private void notifierSoumission(OkDemarrage okd, Utilisateur auteur) {
        if (okd == null || okd.getId() == null) {
            return;
        }
        String machineNom = okd.getMachine() != null ? okd.getMachine().getNom() : "machine inconnue";
        String operateurNom = okd.getOperateur() != null ? okd.getOperateur().getNom() : "Opérateur";
        String session = okd.getSession() != null ? okd.getSession().name() : "—";

        // Compter les non-conformités (ROUGE = non-conforme)
        int nbNc = 0;
        if (okd.getReponses() != null) {
            for (com.example.entity.ReponseCritere r : okd.getReponses()) {
                if (r.getValeur() == com.example.entity.ReponseCritere.Valeur.ROUGE) {
                    nbNc++;
                }
            }
        }

        notificationService.notifyChecklistSoumise(
                List.of("CHEF_LIGNE", "ADMIN"),
                okd.getId(),
                operateurNom,
                machineNom,
                session,
                nbNc,
                auteur != null ? auteur.getMatricule() : null);
    }

    private void notifierValidationN1(OkDemarrage okd, Utilisateur validateur) {
        if (okd == null || okd.getId() == null) {
            return;
        }
        String validateurNom = validateur != null ? validateur.getNom() : "Chef de ligne";

        if (okd.getDateValidationN2() == null) {
            notificationService.notifyValidationRequise(
                    List.of("TECHNICIEN", "ADMIN"),
                    okd.getId(),
                    "N2",
                    validateurNom,
                    validateur != null ? validateur.getMatricule() : null);
        } else {
            notificationService.notifyValidationRequise(
                    List.of("AGENT_QUALITE", "ADMIN"),
                    okd.getId(),
                    "Finale",
                    validateurNom,
                    validateur != null ? validateur.getMatricule() : null);
        }

        if (okd.getOperateur() != null) {
            notificationService.notifyUser(
                    okd.getOperateur(),
                    "Checklist validée N1",
                    "Votre checklist #" + okd.getId() + " a été validée au niveau N1.",
                    "check",
                    okd.getId());
        }
    }

    private void notifierValidationN2(OkDemarrage okd, Utilisateur validateur) {
        if (okd == null || okd.getId() == null) {
            return;
        }
        String validateurNom = validateur != null ? validateur.getNom() : "Technicien";

        if (okd.getDateValidationN1() == null) {
            notificationService.notifyRoles(
                    List.of("CHEF_LIGNE", "ADMIN"),
                    "Validation N1 requise",
                    "Checklist #" + okd.getId() + " validée N2 par " + validateurNom + ".",
                    "info",
                    okd.getId(),
                    validateur != null ? validateur.getMatricule() : null);
        } else {
            notificationService.notifyRoles(
                    List.of("AGENT_QUALITE", "ADMIN"),
                    "Validation finale requise",
                    "Checklist #" + okd.getId() + " validée N1 et N2. Validation finale requise.",
                    "info",
                    okd.getId(),
                    validateur != null ? validateur.getMatricule() : null);
        }

        if (okd.getOperateur() != null) {
            notificationService.notifyUser(
                    okd.getOperateur(),
                    "Checklist validée N2",
                    "Votre checklist #" + okd.getId() + " a été validée au niveau N2.",
                    "check",
                    okd.getId());
        }
    }

    private void notifierValidationFinale(OkDemarrage okd, Utilisateur validateur) {
        if (okd == null || okd.getId() == null) {
            return;
        }
        String validateurNom = validateur != null ? validateur.getNom() : "Agent qualité";

        if (okd.getOperateur() != null) {
            notificationService.notifyUser(
                    okd.getOperateur(),
                    "Checklist validée",
                    "Votre checklist #" + okd.getId() + " a été validée définitivement par "
                            + validateurNom + ".",
                    "check",
                    okd.getId());
        }
    }

    private void notifierRejet(OkDemarrage okd, Utilisateur rejecteur, String motif) {
        if (okd == null || okd.getId() == null) {
            return;
        }
        String rejecteurNom = rejecteur != null ? rejecteur.getNom() : "Validateur";

        if (okd.getOperateur() != null) {
            notificationService.notifyUser(
                    okd.getOperateur(),
                    "Checklist rejetée",
                    "Votre checklist #" + okd.getId() + " a été rejetée par " + rejecteurNom
                            + ". Motif : " + motif,
                    "warn",
                    okd.getId());
        }
    }

    // ── Import PDF ──────────────────────────────────────────────────
    @Transactional
    public Map<String, Object> importerCriteresDepuisPdf(MultipartFile file, Long processusId)
            throws Exception {
        Processus processus = processusRepository.findById(processusId)
                .orElseThrow(() -> new RuntimeException("Processus introuvable"));

        List<com.example.dto.CritereRequest> parsed = pdfCritereParser.parse(file, processusId);

        if (parsed.isEmpty()) {
            throw new RuntimeException(
                    "Aucun critère détecté dans ce PDF. " +
                            "Assurez-vous que le fichier est une checklist LEONI valide.");
        }

        int count = 0;
        for (com.example.dto.CritereRequest req : parsed) {
            Critere c = new Critere();
            c.setNom(req.getNom());
            c.setDescription(req.getDescription());
            c.setNomAr(req.getNomAr());
            c.setDescriptionAr(req.getDescriptionAr());
            c.setType(req.getType());
            c.setCouleur(req.getCouleur() != null ? req.getCouleur() : "Jaune");
            c.setMoyenVerification(req.getMoyenVerification() != null ? req.getMoyenVerification() : "VISUEL");
            c.setCategorie(req.getCategorie() != null ? req.getCategorie() : "Machine");
            c.setProcessus(processus);
            if (hfAutoImportEnabled) {
                critereService.assignAutoImageIfMissing(c);
            }
            critereRepository.save(c);
            count++;
        }

        return Map.of(
                "total", count,
                "message", count + " critère(s) importé(s) avec succès.",
                "processusId", processusId,
                "processusNom", processus.getNom());
    }

    // ── Suppression ─────────────────────────────────────────────────
    @Transactional
    public void delete(Long id) {
        OkDemarrage checklist = okDemarrageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Checklist introuvable : " + id));
        checklistAuditService.logAction(
                checklist,
                null,
                ChecklistAuditLog.Action.SUPPRESSION,
                checklist.getStatus() != null ? checklist.getStatus().name() : null,
                "SUPPRIMEE",
                "Checklist supprimée",
                null);
        // 1. Supprimer les plans d'action liés (PA)
        planActionRepository.deleteByOkDemarrageId(id);
        // 2. Supprimer les réponses / non-conformités (NC)
        reponseCritereRepository.deleteByOkDemarrageId(id);
        // 3. Supprimer les logs de validation (audit trail)
        checklistAuditService.deleteAllByChecklistId(id);
        // 4. Supprimer la checklist elle-même
        okDemarrageRepository.delete(checklist);
    }

    // ── Appel OCR micro-service Python ───────────────────────────────
    @SuppressWarnings("unchecked")
    private String appellerServiceOCR(MultipartFile file) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(ocrServiceUrl, requestEntity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("text");
            }
            throw new RuntimeException("Le service OCR a retourné une réponse invalide.");
        } catch (Exception e) {
            throw new RuntimeException(
                    "Service OCR inaccessible. Vérifiez que le service Python est démarré sur le port 8000. Détail : "
                            + e.getMessage());
        }
    }
}