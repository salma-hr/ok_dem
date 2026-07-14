package com.example.repository;

import com.example.entity.Critere;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CritereRepository extends JpaRepository<Critere, Long> {

    @Query("SELECT c FROM Critere c LEFT JOIN FETCH c.processus")
    List<Critere> findAllWithProcessus();

    @Query("SELECT c FROM Critere c LEFT JOIN FETCH c.processus WHERE c.processus.id = :id")
    List<Critere> findByProcessusId(@Param("id") Long id);

    long countByProcessusId(Long processusId);
}
