package com.example.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "generated_image_cache", indexes = {
        @Index(name = "idx_generated_image_cache_hash", columnList = "prompt_hash", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeneratedImageCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prompt_hash", nullable = false, length = 64, unique = true)
    private String promptHash;

    @Column(name = "prompt_normalized", columnDefinition = "TEXT")
    private String promptNormalized;

    @Column(name = "image_url", columnDefinition = "TEXT", nullable = false)
    private String imageUrl;

    @Column(name = "provider", length = 50)
    private String provider;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_used_at", nullable = false)
    private LocalDateTime lastUsedAt;

    @Column(name = "hit_count", nullable = false)
    private Long hitCount;
}
