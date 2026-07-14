package com.example.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.ToString;
import java.util.List;

@Entity
@Table(name = "site")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = { "plants", "okDemarrages" })
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(columnDefinition = "TEXT")   // ← ajouté
    private String adresse;

    @Column(length = 100)
    private String responsable;

    @OneToMany(mappedBy = "site", cascade = CascadeType.ALL)
    private List<Plant> plants;

    @OneToMany(mappedBy = "site", cascade = CascadeType.ALL)
    private List<OkDemarrage> okDemarrages;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Site)) return false;
        Site s = (Site) o;
        return id != null && id.equals(s.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}