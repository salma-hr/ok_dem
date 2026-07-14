package com.example.repository;

import com.example.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop50ByDestinataireMatriculeOrderByCreeLeDesc(String matricule);

    long countByDestinataireMatriculeAndLueFalse(String matricule);

    Optional<Notification> findByIdAndDestinataireMatricule(Long id, String matricule);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Notification n SET n.lue = true WHERE n.destinataireMatricule = :matricule AND n.lue = false")
    int markAllAsRead(@Param("matricule") String matricule);

    @Modifying
    @Query("delete from Notification n where n.destinataireId = :userId")
    void deleteByDestinataireId(@Param("userId") Long userId);
}
