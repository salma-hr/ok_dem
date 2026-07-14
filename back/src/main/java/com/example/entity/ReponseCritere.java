package com.example.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "reponse_critere")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"critere", "okDemarrage"})
public class ReponseCritere {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Valeur valeur;

    @Column(columnDefinition = "TEXT")
    private String commentaire;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "critere_id", nullable = false)
    private Critere critere;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ok_demarrage_id", nullable = false)
    private OkDemarrage okDemarrage;

    public enum Valeur {
        VERT, JAUNE, ROUGE, NA
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ReponseCritere)) return false;
        ReponseCritere r = (ReponseCritere) o;
        return id != null && id.equals(r.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}