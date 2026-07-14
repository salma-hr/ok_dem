package com.example.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger; // ✅ SLF4J Logger
import org.slf4j.LoggerFactory; // ✅ SLF4J LoggerFactory
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);
    private final JwtUtils jwtUtils;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            String authHeader = request.getHeader("Authorization");
            String uri = request.getRequestURI();
            if ((authHeader == null || !authHeader.startsWith("Bearer "))
                    && uri.startsWith("/api/criteres/") && uri.endsWith("/historique")) {
                log.warn("Authorization manquante ou invalide pour {}", uri);
            }

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = normalizeToken(authHeader.substring(7));

                if (token == null || token.isBlank()) {
                    filterChain.doFilter(request, response);
                    return;
                }

                // JwtAuthFilter.java — replace the validateToken block
                if (jwtUtils.validateToken(token)) {
                    String matricule = jwtUtils.getMatriculeFromToken(token);
                    String role = jwtUtils.getRoleFromToken(token);
                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                            matricule, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } else {
                    log.warn("Token JWT invalide [{}] — raison: {}",
                            uri,
                            jwtUtils.getValidationError(token)); // ← add this method
                }
            }
        } catch (Exception e) {
            log.error("Erreur filtre JWT : {}", e.getMessage(), e);
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private String normalizeToken(String rawToken) {
        if (rawToken == null) {
            return null;
        }

        String token = rawToken.trim();
        if (token.isEmpty()) {
            return null;
        }

        if ((token.startsWith("\"") && token.endsWith("\""))
                || (token.startsWith("'") && token.endsWith("'"))) {
            token = token.substring(1, token.length() - 1).trim();
        }

        if (token.toLowerCase().startsWith("bearer ")) {
            token = token.substring(7).trim();
        }

        return token;
    }
}