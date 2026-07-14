package com.example.repository;

import com.example.entity.Machine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {

       @Query("SELECT m FROM Machine m " +
                     "LEFT JOIN FETCH m.processus " +
                     "LEFT JOIN FETCH m.segment " +
                     "LEFT JOIN FETCH m.plant " +
                     "LEFT JOIN FETCH m.site")
       List<Machine> findAllWithProcessus();

       @Query("SELECT m FROM Machine m " +
                     "LEFT JOIN FETCH m.processus " +
                     "LEFT JOIN FETCH m.segment " +
                     "LEFT JOIN FETCH m.plant " +
                     "LEFT JOIN FETCH m.site " +
                     "WHERE m.processus.id = :id")
       List<Machine> findByProcessusId(@Param("id") Long id);

       long countByProcessusId(Long processusId);

       Optional<Machine> findById(Long id);
}