package com.example.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

@Service
public class CritereImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(CritereImageStorageService.class);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp");

    private final Path uploadRoot;
    private final Path criteresDir;

    public CritereImageStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.criteresDir = uploadRoot.resolve("criteres");
        try {
            Files.createDirectories(this.criteresDir);
        } catch (IOException e) {
            throw new RuntimeException("Impossible de creer le dossier d'upload: " + this.criteresDir, e);
        }
    }

    public String storeFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Fichier image manquant.");
        }

        String contentType = file.getContentType();
        String extension = extensionFromContentType(contentType);
        if (extension == null) {
            extension = extensionFromFilename(file.getOriginalFilename());
        }
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Format d'image non autorise.");
        }

        String filename = UUID.randomUUID() + "." + extension;
        Path target = criteresDir.resolve(filename).normalize();
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Impossible de stocker l'image.", e);
        }

        return "/uploads/criteres/" + filename;
    }

    public String storeDataUrl(String dataUrl) {
        if (!isDataUrl(dataUrl)) {
            throw new RuntimeException("Image base64 invalide.");
        }

        int commaIndex = dataUrl.indexOf(',');
        String meta = dataUrl.substring(5, commaIndex); // after 'data:'
        String contentType = meta.split(";")[0];
        String extension = extensionFromContentType(contentType);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Format d'image non autorise.");
        }

        String base64 = dataUrl.substring(commaIndex + 1);
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Image base64 invalide.", e);
        }

        String filename = UUID.randomUUID() + "." + extension;
        Path target = criteresDir.resolve(filename).normalize();
        try {
            Files.write(target, bytes);
        } catch (IOException e) {
            throw new RuntimeException("Impossible de stocker l'image.", e);
        }

        return "/uploads/criteres/" + filename;
    }

    public String storeBytes(byte[] bytes, String contentType) {
        return storeBytes(bytes, contentType, "");
    }

    public String storeBytes(byte[] bytes, String contentType, String prefix) {
        if (bytes == null || bytes.length == 0) {
            throw new RuntimeException("Image invalide (vide).");
        }

        String extension = extensionFromContentType(contentType);
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            extension = "png";
        }

        String safePrefix = prefix == null ? "" : prefix;
        String filename = safePrefix + UUID.randomUUID() + "." + extension;
        Path target = criteresDir.resolve(filename).normalize();
        try {
            Files.write(target, bytes);
        } catch (IOException e) {
            throw new RuntimeException("Impossible de stocker l'image.", e);
        }

        return "/uploads/criteres/" + filename;
    }

    public boolean isDataUrl(String value) {
        return value != null
                && value.startsWith("data:image/")
                && value.contains(";base64,");
    }

    public void deleteIfLocal(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return;
        }

        if (!imageUrl.startsWith("/uploads/")) {
            return;
        }

        Path target = uploadRoot.resolve(imageUrl.substring("/uploads/".length())).normalize();
        if (!target.startsWith(uploadRoot)) {
            log.warn("Chemin d'image ignore (hors dossier upload): {}", imageUrl);
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            log.warn("Impossible de supprimer l'image locale: {}", imageUrl, e);
        }
    }

    public boolean existsLocal(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return false;
        }
        if (!imageUrl.startsWith("/uploads/")) {
            return false;
        }

        Path target = uploadRoot.resolve(imageUrl.substring("/uploads/".length())).normalize();
        if (!target.startsWith(uploadRoot)) {
            return false;
        }
        return Files.exists(target);
    }

    private String extensionFromContentType(String contentType) {
        if (contentType == null || !contentType.startsWith("image/")) {
            return null;
        }
        String ext = contentType.substring("image/".length()).toLowerCase();
        if ("jpeg".equals(ext)) {
            return "jpg";
        }
        return ext;
    }

    private String extensionFromFilename(String name) {
        if (name == null) {
            return null;
        }
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == name.length() - 1) {
            return null;
        }
        return name.substring(dotIndex + 1).toLowerCase();
    }
}
