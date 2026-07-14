package com.example.controller;

import com.example.dto.NotificationDTO;
import com.example.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lister les notifications de l'utilisateur connecté")
    public ResponseEntity<List<NotificationDTO>> getNotifications(Authentication authentication) {
        return ResponseEntity.ok(notificationService.getNotifications(authentication.getName()));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Nombre de notifications non lues")
    public ResponseEntity<Map<String, Object>> getUnreadCount(Authentication authentication) {
        return ResponseEntity.ok(Map.of("count", notificationService.getUnreadCount(authentication.getName())));
    }

    @PatchMapping("/{id}/lire")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Marquer une notification comme lue")
    public ResponseEntity<Map<String, Object>> markAsRead(@PathVariable Long id, Authentication authentication) {
        boolean updated = notificationService.markAsRead(id, authentication.getName());
        return ResponseEntity.ok(Map.of("id", id, "lue", updated));
    }

    @PatchMapping("/lire-tout")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Marquer toutes les notifications comme lues")
    public ResponseEntity<Map<String, Object>> markAllAsRead(Authentication authentication) {
        int updated = notificationService.markAllAsRead(authentication.getName());
        return ResponseEntity.ok(Map.of("updated", updated));
    }
}
