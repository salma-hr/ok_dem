package com.example.repository;
 
import com.example.entity.Segment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
 
public interface SegmentRepository extends JpaRepository<Segment, Long> {
 
    @Query("SELECT s FROM Segment s LEFT JOIN FETCH s.plant")
    List<Segment> findAllWithPlant();
 
    @Query("SELECT s FROM Segment s LEFT JOIN FETCH s.plant WHERE s.plant.id = :id")
    List<Segment> findByPlantId(@Param("id") Long id);
}