package com.example.dto;

import lombok.Data;

// DTO Requête Login
@Data
public class LoginRequest {
    private String matricule;
    private String password;
}
