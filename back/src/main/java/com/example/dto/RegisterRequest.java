package com.example.dto;

import lombok.Data;

@Data
public class RegisterRequest {
    private String nom;
    private String matricule;
    private String email;
    private String password;
    private Long roleId;
    private Long siteId;   
    private Long plantId;  
    private Long segmentId;
}