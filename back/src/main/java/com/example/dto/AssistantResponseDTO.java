package com.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssistantResponseDTO {
    private String question;
    private String answer;
    private String periodLabel;
    private String topOperator;
    private Long topAlerts;
    private List<OperatorAlertDTO> ranking;
    private String source;
}
