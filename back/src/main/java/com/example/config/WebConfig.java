package com.example.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashSet;
import java.util.Set;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path configured = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path cwd = Paths.get("").toAbsolutePath().normalize();

        Set<String> locations = new LinkedHashSet<>();
        locations.add(configured.toUri().toString());
        locations.add(cwd.resolve("uploads").normalize().toUri().toString());
        locations.add(cwd.resolve("back").resolve("uploads").normalize().toUri().toString());
        locations.add(cwd.resolve("..").resolve("uploads").normalize().toUri().toString());

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(locations.toArray(String[]::new));
    }
}
