package com.example.repository;

import com.example.entity.Utilisateur;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
    Optional<Utilisateur> findByMatricule(String matricule);

    boolean existsByMatricule(String matricule);

    List<Utilisateur> findByProcessusId(Long processusId);

    List<Utilisateur> findByRoleNomInAndActifTrue(Collection<String> roleNames);

    List<Utilisateur> findByActifTrueOrderByNomAsc();
}
