package com.example.service;

import com.example.dto.DashboardStatsDTO;
import com.example.dto.ProcessusCountDTO;
import com.example.dto.ChecklistRecentDTO;
import com.example.dto.OperatorPerformanceDTO;
import com.example.entity.OkDemarrage;
import com.example.entity.ReponseCritere;
import com.example.repository.ChecklistRepository;
import com.example.repository.ReponseCritereRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional; // ← AJOUT

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true) // ← AJOUT : toutes les méthodes dans une transaction lecture
public class DashboardService {

    @Autowired
    private ChecklistRepository checklistRepository;

    @Autowired
    private ReponseCritereRepository reponseCritereRepository;

    @Autowired
    private ScopeService scopeService;

    // ── Stats globales ───────────────────────────────────────────────
    public DashboardStatsDTO getGlobalStats() {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        Long plantId = scopeService.getPlantFilterId();

        LocalDate now = LocalDate.now();
        LocalDate debutMois = now.withDayOfMonth(1);
        LocalDate finMois = now.with(TemporalAdjusters.lastDayOfMonth());
        LocalDate debutMoisPrecedent = debutMois.minusMonths(1);
        LocalDate finMoisPrecedent = debutMoisPrecedent.with(TemporalAdjusters.lastDayOfMonth());

        // 1. Checklists validées finalement ce mois (VALIDE_FINAL uniquement)
        Long valideesMois = checklistRepository.countByStatusAndDateBetweenScoped(
                OkDemarrage.Status.VALIDE_FINAL, debutMois, finMois, plantId);
        Long valideesMoisPrec = checklistRepository.countByStatusAndDateBetweenScoped(
                OkDemarrage.Status.VALIDE_FINAL, debutMoisPrecedent, finMoisPrecedent, plantId);

        stats.setChecklistsValidees(valideesMois);
        stats.setEvolutionValidees(calculateEvolutionPercent(valideesMois, valideesMoisPrec));

        // 2. Non-conformités (critères ROUGE ou JAUNE) ce mois
        Long ncMois = checklistRepository.countWithNonConformiteAndDateBetweenScoped(debutMois, finMois, plantId);
        Long ncMoisPrec = checklistRepository.countWithNonConformiteAndDateBetweenScoped(debutMoisPrecedent,
                finMoisPrecedent, plantId);

        stats.setNonConformites(ncMois);
        stats.setEvolutionNC(calculateEvolutionPercent(ncMois, ncMoisPrec));

        // 3. En attente de validation = SOUMIS + VALIDE_N1 + VALIDE_N2
        Long enAttenteN1 = checklistRepository.countByStatusScoped(OkDemarrage.Status.SOUMIS, plantId);
        Long enAttenteN2 = checklistRepository.countByStatusScoped(OkDemarrage.Status.VALIDE_N1, plantId);
        Long enAttenteValidation = checklistRepository.countByStatusScoped(OkDemarrage.Status.VALIDE_N2, plantId);
        Long enAttente = enAttenteN1 + enAttenteN2 + enAttenteValidation;

        stats.setEnAttente(enAttente);
        stats.setEnAttenteN1(enAttenteN1);
        stats.setEnAttenteN2(enAttenteN2);
        stats.setEnAttenteValidation(enAttenteValidation);
        stats.setEvolutionAttente("+" + enAttente);

        // 4. Taux de conformité du mois
        Long totalMois = checklistRepository.countByDateBetweenScoped(debutMois, finMois, plantId);
        Double tauxConformite = totalMois > 0 ? (valideesMois * 100.0) / totalMois : 0.0;

        Long totalMoisPrec = checklistRepository.countByDateBetweenScoped(debutMoisPrecedent, finMoisPrecedent, plantId);
        Double tauxConfPrec = totalMoisPrec > 0 ? (valideesMoisPrec * 100.0) / totalMoisPrec : 0.0;

        stats.setTauxConformite(tauxConformite);
        stats.setEvolutionTaux(String.format("%+.1f%%", tauxConformite - tauxConfPrec));
        stats.setTotalChecklists(totalMois);

        return stats;
    }

    // ── Checklists par processus ─────────────────────────────────────
    public List<ProcessusCountDTO> getChecklistCountsByProcessus() {
        List<Object[]> results = checklistRepository.countChecklistsByProcessusScoped(scopeService.getPlantFilterId());
        return results.stream()
                .map(r -> new ProcessusCountDTO(
                        (Long) r[0],
                        (String) r[1],
                        ((Number) r[2]).longValue()))
                .collect(Collectors.toList());
    }

        // ── Stats par site et plant ─────────────────────────────────────
        // Réservé de fait à l'admin système (comparaison inter-plants) ; pour un
        // utilisateur scopé, ne renvoie que la ligne de son propre plant.
        public List<com.example.dto.SitePlantStatsDTO> getStatsBySiteAndPlant() {
                Long myPlantId = scopeService.isSystemAdmin() ? null : scopeService.getPlantFilterId();
                // Safer approach: iterate over all checklists and resolve site/plant via machine/segment/processus
                List<com.example.entity.OkDemarrage> all = checklistRepository.findAll();

                // Key: siteId|plantId (use 0 for null), Value: accumulator array {checks, alerts, siteId, siteName, plantId, plantName}
                Map<String, long[]> accum = new HashMap<>();
                Map<String, String[]> names = new HashMap<>();

                for (com.example.entity.OkDemarrage o : all) {
                        com.example.entity.Machine m = o.getMachine();
                        com.example.entity.Site site = null;
                        com.example.entity.Plant plant = null;

                        if (m != null) {
                                if (m.getSite() != null) {
                                        site = m.getSite();
                                }
                                if (m.getPlant() != null) {
                                        plant = m.getPlant();
                                        if (site == null && plant.getSite() != null) site = plant.getSite();
                                }
                                if (site == null && m.getSegment() != null && m.getSegment().getPlant() != null && m.getSegment().getPlant().getSite() != null) {
                                        site = m.getSegment().getPlant().getSite();
                                        plant = m.getSegment().getPlant();
                                }
                                if (site == null && m.getProcessus() != null && m.getProcessus().getSegment() != null && m.getProcessus().getSegment().getPlant() != null && m.getProcessus().getSegment().getPlant().getSite() != null) {
                                        plant = m.getProcessus().getSegment().getPlant();
                                        site = plant.getSite();
                                }
                        }

                        Long siteId = site != null && site.getId() != null ? site.getId() : 0L;
                        String siteName = site != null ? site.getNom() : "N/A";
                        Long plantId = plant != null && plant.getId() != null ? plant.getId() : 0L;
                        String plantName = plant != null ? plant.getNom() : "N/A";

                        String key = siteId + "|" + plantId;
                        names.putIfAbsent(key, new String[]{siteName, plantName});
                        long[] acc = accum.get(key);
                        if (acc == null) {
                                acc = new long[]{0L, 0L};
                                accum.put(key, acc);
                        }
                        acc[0] = acc[0] + 1; // checks
                        boolean hasAlert = false;
                        if (o.getReponses() != null) {
                                for (com.example.entity.ReponseCritere r : o.getReponses()) {
                                        if (r.getValeur() == com.example.entity.ReponseCritere.Valeur.ROUGE || r.getValeur() == com.example.entity.ReponseCritere.Valeur.JAUNE) {
                                                hasAlert = true;
                                                break;
                                        }
                                }
                        }
                        if (hasAlert) acc[1] = acc[1] + 1;
                }

                List<com.example.dto.SitePlantStatsDTO> result = new ArrayList<>();
                for (Map.Entry<String, long[]> e : accum.entrySet()) {
                        String key = e.getKey();
                        long[] acc = e.getValue();
                        String[] n = names.get(key);
                        String[] parts = key.split("\\|");
                        Long sid = Long.parseLong(parts[0]);
                        Long pid = Long.parseLong(parts[1]);
                        long checks = acc[0];
                        long alerts = acc[1];
                        double taux = checks > 0 ? (alerts * 100.0) / checks : 0.0;
                        result.add(new com.example.dto.SitePlantStatsDTO(sid, n[0], pid, n[1], checks, alerts, taux));
                }

                // sort by site then plant name
                result.sort(Comparator.comparing(com.example.dto.SitePlantStatsDTO::getSiteName).thenComparing(com.example.dto.SitePlantStatsDTO::getPlantName));

                if (myPlantId != null) {
                        result = result.stream()
                                        .filter(r -> myPlantId.equals(r.getPlantId()))
                                        .collect(Collectors.toList());
                }
                return result;
        }

    // ── Dernières checklists ─────────────────────────────────────────
    public List<ChecklistRecentDTO> getRecentChecklists(int limit) {
        // ← CORRECTION : utiliser la requête eager qui charge machine+operateur en JOIN
        List<OkDemarrage> checklists = checklistRepository.findRecentWithDetailsScoped(
                scopeService.getPlantFilterId(), PageRequest.of(0, limit));
        return checklists.stream()
                .map(this::convertToChecklistRecentDTO)
                .collect(Collectors.toList());
    }

    // ── Stats par période personnalisée ──────────────────────────────
    public DashboardStatsDTO getStatsByPeriod(String startDateStr, String endDateStr) {
        LocalDate startDate = LocalDate.parse(startDateStr);
        LocalDate endDate = LocalDate.parse(endDateStr);
        Long plantId = scopeService.getPlantFilterId();

        DashboardStatsDTO stats = new DashboardStatsDTO();

        Long validees = checklistRepository.countByStatusAndDateBetweenScoped(
                OkDemarrage.Status.VALIDE_FINAL, startDate, endDate, plantId);
        stats.setChecklistsValidees(validees);
        stats.setEvolutionValidees("+0%");

        Long nc = checklistRepository.countWithNonConformiteAndDateBetweenScoped(startDate, endDate, plantId);
        stats.setNonConformites(nc);
        stats.setEvolutionNC("0%");

        Long enAttenteN1 = checklistRepository.countByStatusScoped(OkDemarrage.Status.SOUMIS, plantId);
        Long enAttenteN2 = checklistRepository.countByStatusScoped(OkDemarrage.Status.VALIDE_N1, plantId);
        Long enAttenteValidation = checklistRepository.countByStatusScoped(OkDemarrage.Status.VALIDE_N2, plantId);
        Long enAttente = enAttenteN1 + enAttenteN2 + enAttenteValidation;

        stats.setEnAttente(enAttente);
        stats.setEnAttenteN1(enAttenteN1);
        stats.setEnAttenteN2(enAttenteN2);
        stats.setEnAttenteValidation(enAttenteValidation);
        stats.setEvolutionAttente("+" + enAttente);

        Long total = checklistRepository.countByDateBetweenScoped(startDate, endDate, plantId);
        Double taux = total > 0 ? (validees * 100.0) / total : 0.0;
        stats.setTauxConformite(taux);
        stats.setEvolutionTaux("0%");
        stats.setTotalChecklists(total);

        return stats;
    }

    // ── Historique performance par opérateur ─────────────────────────
    public List<OperatorPerformanceDTO> getOperatorPerformance(LocalDate startDate, LocalDate endDate) {
        List<Object[]> rows = checklistRepository.getOperatorPerformanceScoped(
                startDate, endDate, scopeService.getPlantFilterId());
        return rows.stream()
                .map(r -> {
                    Long operateurId = (Long) r[0];
                    String operateurNom = (String) r[1];
                    LocalDate date = (LocalDate) r[2];
                    Long total = ((Number) r[3]).longValue();
                    Long nonConformes = ((Number) r[4]).longValue();
                    double taux = total > 0 ? ((total - nonConformes) * 100.0) / total : 0.0;
                    return new OperatorPerformanceDTO(
                            operateurId,
                            operateurNom,
                            date,
                            total,
                            nonConformes,
                            taux);
                })
                .collect(Collectors.toList());
    }

    // ── Helpers ──────────────────────────────────────────────────────
    private String calculateEvolutionPercent(Long current, Long previous) {
        if (previous == null || previous == 0) {
            return current > 0 ? "+100%" : "0%";
        }
        double evolution = ((current - previous) * 100.0) / previous;
        return String.format("%+.0f%%", evolution);
    }

    private ChecklistRecentDTO convertToChecklistRecentDTO(OkDemarrage checklist) {
        ChecklistRecentDTO dto = new ChecklistRecentDTO();

        dto.setId(checklist.getId());
        dto.setMachineNom(checklist.getMachine() != null ? checklist.getMachine().getNom() : "N/A");
        dto.setMachineCode(checklist.getMachine() != null ? "M-" + checklist.getMachine().getId() : "N/A"); // ←
                                                                                                            // CORRECTION
                                                                                                            // : getId()
                                                                                                            // au lieu
                                                                                                            // de
                                                                                                            // getNom()
        dto.setOperateurNom(checklist.getOperateur() != null ? checklist.getOperateur().getNom() : "N/A");
        dto.setDateControle(checklist.getDate());

        dto.setDateCreation(
                checklist.getDateValidationFinale() != null ? checklist.getDateValidationFinale()
                        : checklist.getDateRejet() != null ? checklist.getDateRejet()
                                : checklist.getDateValidationN2() != null ? checklist.getDateValidationN2()
                                        : checklist.getDateValidationN1() != null ? checklist.getDateValidationN1()
                                                : null);

        dto.setStatut(checklist.getStatus() != null ? checklist.getStatus().name() : null);

        List<ReponseCritere> reponses = reponseCritereRepository.findByOkDemarrageId(checklist.getId());
        int total = reponses.size();
        int ok = (int) reponses.stream().filter(r -> ReponseCritere.Valeur.VERT == r.getValeur()).count();

        dto.setCriteresOk(ok);
        dto.setCriteresTotal(total);
        dto.setHasNonConformite(reponses.stream().anyMatch(r -> ReponseCritere.Valeur.ROUGE == r.getValeur()));

        return dto;
    }
}