package com.example.repository;

import com.example.entity.ReponseCritere;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReponseCritereRepository extends JpaRepository<ReponseCritere, Long> {

    /**
     * Trouver toutes les réponses d'une checklist
     */
    List<ReponseCritere> findByOkDemarrageId(Long okDemarrageId);

    /**
     * Trouver les réponses par type de valeur (OK, NON, NA)
     */
    List<ReponseCritere> findByValeur(ReponseCritere.Valeur valeur);

    /**
     * Compter les réponses par checklist
     */
    Long countByOkDemarrageId(Long okDemarrageId);

    /**
     * Compter les réponses d'un type donné pour une checklist
     */
    Long countByOkDemarrageIdAndValeur(Long okDemarrageId, ReponseCritere.Valeur valeur);

    /**
     * Compter les réponses liées à un critère
     */
    Long countByCritereId(Long critereId);

    /**
     * Trouver les réponses NON (qui génèrent des non-conformités)
     */
    List<ReponseCritere> findByOkDemarrageIdAndValeur(Long okDemarrageId, ReponseCritere.Valeur valeur);

    /**
     * Supprimer toutes les réponses d'une checklist
     */
    void deleteByOkDemarrageId(Long okDemarrageId);

    @Modifying
    @Query("delete from ReponseCritere r where r.okDemarrage.operateur.id = :userId")
    void deleteByOkDemarrageOperateurId(@Param("userId") Long userId);
}