package com.example.repository;
 
import com.example.entity.Processus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
 
public interface ProcessusRepository extends JpaRepository<Processus, Long> {
 
    @Query("SELECT p FROM Processus p LEFT JOIN FETCH p.segment LEFT JOIN FETCH p.machines")
    List<Processus> findAllWithSegmentAndMachines();
 
    @Query("SELECT p FROM Processus p LEFT JOIN FETCH p.segment WHERE p.segment.id = :id")
    List<Processus> findBySegmentId(@Param("id") Long id);
    @Query("""
    SELECT p, (SELECT COUNT(m) FROM Machine m WHERE m.processus = p)
    FROM Processus p
    LEFT JOIN FETCH p.segment s
    LEFT JOIN FETCH s.plant
    """)
    List<Object[]> findAllWithSegmentAndMachineCount();
}