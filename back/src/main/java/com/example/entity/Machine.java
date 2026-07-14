package com.example.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.ToString;

@Entity                          // ← vérifiez que c'est bien là
@Table(name = "machine")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "processus")
public class Machine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processus_id")
    private Processus processus;
 
    
    @ManyToOne @JoinColumn(name = "segment_id") 
    private Segment segment;  
    @ManyToOne @JoinColumn(name = "plant_id")   
    private Plant plant;      
    @ManyToOne @JoinColumn(name = "site_id")    
    private Site site;           

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Machine)) return false;
        Machine m = (Machine) o;
        return id != null && id.equals(m.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}