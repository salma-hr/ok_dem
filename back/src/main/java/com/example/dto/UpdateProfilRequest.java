package com.example.dto;

import lombok.Data;

@Data
public class UpdateProfilRequest {

    private String nom;
    private String email;
    private String password; // optionnel — null ou vide = inchangé
}