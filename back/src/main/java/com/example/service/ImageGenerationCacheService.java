package com.example.service;

import com.example.entity.GeneratedImageCache;
import com.example.repository.GeneratedImageCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ImageGenerationCacheService {

    private final GeneratedImageCacheRepository cacheRepository;
    private final HfImageGenerationService hfImageGenerationService;
    private final CritereImageStorageService imageStorageService;

    @Value("${hf.cache.enabled:true}")
    private boolean cacheEnabled;

    @Value("${hf.cache.key-version:v2}")
    private String cacheKeyVersion;

    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String getOrGenerate(String prompt, String filePrefix) {
        if (prompt == null || prompt.isBlank()) {
            throw new RuntimeException("Prompt IA vide.");
        }

        String normalizedPrompt = normalizePrompt(prompt);
        String promptHash = sha256(
                normalizedPrompt + "|" + cacheKeyVersion + "|" + hfImageGenerationService.getCacheSignature());

        if (!cacheEnabled) {
            return generateAndStore(prompt, filePrefix);
        }

        Object lock = locks.computeIfAbsent(promptHash, k -> new Object());
        try {
            synchronized (lock) {
                Optional<GeneratedImageCache> existing = cacheRepository.findByPromptHash(promptHash);
                if (existing.isPresent()) {
                    GeneratedImageCache entry = existing.get();
                    if (isUsable(entry.getImageUrl())) {
                        touch(entry);
                        cacheRepository.save(entry);
                        return entry.getImageUrl();
                    }
                    String regeneratedImageUrl = generateAndStore(prompt, filePrefix);
                    refreshEntry(entry, normalizedPrompt, regeneratedImageUrl);
                    cacheRepository.save(entry);
                    return regeneratedImageUrl;
                }

                String imageUrl = generateAndStore(prompt, filePrefix);
                LocalDateTime now = LocalDateTime.now();
                GeneratedImageCache cacheEntry = GeneratedImageCache.builder()
                        .promptHash(promptHash)
                        .promptNormalized(normalizedPrompt)
                        .imageUrl(imageUrl)
                        .provider("hf")
                        .createdAt(now)
                        .lastUsedAt(now)
                        .hitCount(1L)
                        .build();
                return saveCacheEntrySafely(promptHash, normalizedPrompt, imageUrl, cacheEntry);
            }
        } finally {
            locks.remove(promptHash, lock);
        }
    }

    private String saveCacheEntrySafely(
            String promptHash,
            String normalizedPrompt,
            String imageUrl,
            GeneratedImageCache cacheEntry) {
        try {
            cacheRepository.saveAndFlush(cacheEntry);
            return imageUrl;
        } catch (DataIntegrityViolationException ex) {
            Optional<GeneratedImageCache> concurrent = cacheRepository.findByPromptHash(promptHash);
            if (concurrent.isPresent()) {
                GeneratedImageCache existingEntry = concurrent.get();
                if (isUsable(existingEntry.getImageUrl())) {
                    touch(existingEntry);
                    cacheRepository.save(existingEntry);
                    return existingEntry.getImageUrl();
                }

                refreshEntry(existingEntry, normalizedPrompt, imageUrl);
                cacheRepository.save(existingEntry);
                return imageUrl;
            }
            throw ex;
        }
    }

    private void refreshEntry(GeneratedImageCache entry, String normalizedPrompt, String imageUrl) {
        LocalDateTime now = LocalDateTime.now();
        entry.setPromptNormalized(normalizedPrompt);
        entry.setImageUrl(imageUrl);
        entry.setProvider("hf");
        entry.setLastUsedAt(now);
        entry.setHitCount(1L);
    }

    private String generateAndStore(String prompt, String filePrefix) {
        byte[] imageBytes = hfImageGenerationService.generateImage(prompt);
        String safePrefix = (filePrefix == null || filePrefix.isBlank()) ? "ai-cache-" : filePrefix;
        return imageStorageService.storeBytes(imageBytes, "image/png", safePrefix);
    }

    private boolean isUsable(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return false;
        }
        if (imageUrl.startsWith("/uploads/")) {
            return imageStorageService.existsLocal(imageUrl);
        }
        return true;
    }

    private void touch(GeneratedImageCache entry) {
        entry.setLastUsedAt(LocalDateTime.now());
        Long hits = entry.getHitCount() == null ? 0L : entry.getHitCount();
        entry.setHitCount(hits + 1);
    }

    private String normalizePrompt(String prompt) {
        return prompt
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase();
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Hash SHA-256 indisponible", e);
        }
    }
}
