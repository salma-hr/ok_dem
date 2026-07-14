package com.example.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.slf4j.Logger; 
import org.slf4j.LoggerFactory; 
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtils {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpiration;
    private static final Logger log = LoggerFactory.getLogger(JwtUtils.class);

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
    public String getValidationError(String token) {
        try {
            getClaims(token);
            return "aucune";
        } catch (ExpiredJwtException e) {
            return "expiré le " + e.getClaims().getExpiration();
        } catch (SignatureException e) {
            return "signature invalide (secret différent?)";
        } catch (MalformedJwtException e) {
            return "token malformé";
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    public String generateToken(String matricule, String role) {
        return Jwts.builder()
                .setSubject(matricule)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String getMatriculeFromToken(String token) {
        return getClaims(token).getSubject();
    }

    public String getRoleFromToken(String token) {
        return (String) getClaims(token).get("role");
    }

    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("[JWT] Token expiré le {}", e.getClaims().getExpiration());
        } catch (SignatureException e) {
            log.warn("[JWT] Signature invalide — secret différent ?");
        } catch (MalformedJwtException e) {
            log.warn("[JWT] Token malformé : {}", e.getMessage());
        } catch (Exception e) {
            log.warn("[JWT] Erreur validation : {} — {}", e.getClass().getSimpleName(), e.getMessage());
        }
        return false;
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
