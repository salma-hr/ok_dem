package com.example.repository;

import com.example.entity.GeneratedImageCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GeneratedImageCacheRepository extends JpaRepository<GeneratedImageCache, Long> {
    Optional<GeneratedImageCache> findByPromptHash(String promptHash);
}
