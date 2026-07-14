package com.example.back;

import com.example.service.CritereImageStorageService;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class CritereImageStorageServiceTest {

    @Test
    void storeDataUrlWritesAndDeletesFile() throws Exception {
        Path tempDir = Files.createTempDirectory("uploads-test");
        CritereImageStorageService service = new CritereImageStorageService(tempDir.toString());

        String dataUrl = "data:image/png;base64," +
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8" +
                "/5+hHgAGgwJ/lv5QvQAAAABJRU5ErkJggg==";

        String url = service.storeDataUrl(dataUrl);
        assertTrue(url.startsWith("/uploads/criteres/"));

        Path stored = tempDir.resolve(url.substring("/uploads/".length()));
        assertTrue(Files.exists(stored));

        service.deleteIfLocal(url);
        assertFalse(Files.exists(stored));
    }
}
