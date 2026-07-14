package com.example.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class NotificationDTO {
    private Long id;
    private String titre;
    private String message;
    private String type;
    private boolean lue;
    private LocalDateTime creeLe;
    private Long checklistId;
}
