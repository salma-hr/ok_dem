package com.example.repository;
 
import com.example.entity.Plant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
 
public interface PlantRepository extends JpaRepository<Plant, Long> {
 
    @Query("SELECT p FROM Plant p LEFT JOIN FETCH p.site")
    List<Plant> findAllWithSite();
 
    @Query("SELECT p FROM Plant p LEFT JOIN FETCH p.site WHERE p.site.id = :id")
    List<Plant> findBySiteId(@Param("id") Long id);
}