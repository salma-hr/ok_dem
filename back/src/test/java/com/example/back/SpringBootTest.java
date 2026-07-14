package com.example.back;

import com.example.repository.*;
import com.example.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.web.client.RestTemplate;

@SpringBootTest
class BackApplicationTests {

    @MockBean OkDemarrageRepository okDemarrageRepository;
    @MockBean MachineRepository machineRepository;
    @MockBean UtilisateurRepository utilisateurRepository;
    @MockBean CritereRepository critereRepository;
    @MockBean CritereService critereService;
    @MockBean SiteRepository siteRepository;
    @MockBean ProcessusRepository processusRepository;
    @MockBean RestTemplate restTemplate;
    @MockBean PdfCritereParser pdfCritereParser;
    @MockBean ReponseCritereRepository reponseCritereRepository;
    @MockBean NotificationService notificationService;
    @MockBean ChecklistAuditService checklistAuditService;
    @MockBean PlanActionRepository planActionRepository;
    @MockBean EmailService emailService;

    @Test
    void contextLoads() {
        // OK
    }
}