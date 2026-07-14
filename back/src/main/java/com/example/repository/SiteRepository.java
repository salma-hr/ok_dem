package com.example.repository;
 
import com.example.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;
 
public interface SiteRepository extends JpaRepository<Site, Long> {
}
 