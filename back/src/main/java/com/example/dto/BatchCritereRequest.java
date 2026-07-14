package com.example.dto;

import lombok.Data;
import java.util.List;

@Data
public class BatchCritereRequest {
    private Long processusId;
    private List<CritereRequest> criteres;
}