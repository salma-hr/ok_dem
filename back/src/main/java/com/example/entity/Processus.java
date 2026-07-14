package com.example.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "processus")
@Getter
@Setter
@ToString(exclude = { "segment", "machines", "criteres" })
public class Processus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Processus appartient à un Segment
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "segment_id")
    private Segment segment;

    @OneToMany(mappedBy = "processus", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Machine> machines;

    @OneToMany(mappedBy = "processus", cascade = CascadeType.ALL)
    @JsonManagedReference
    private List<Critere> criteres;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Processus)) return false;
        Processus p = (Processus) o;
        return id != null && id.equals(p.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}