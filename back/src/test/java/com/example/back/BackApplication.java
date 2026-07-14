package com.example.back;

import com.example.security.JwtUtils;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
public class BackApplication {

    @Test
    void generateAndValidateToken() throws Exception {
        JwtUtils utils = buildJwtUtils(60_000L);
        String token = utils.generateToken("MAT-001", "ADMIN");

        assertTrue(utils.validateToken(token));
        assertEquals("MAT-001", utils.getMatriculeFromToken(token));
        assertEquals("ADMIN", utils.getRoleFromToken(token));
    }

    private JwtUtils buildJwtUtils(long expirationMs) throws Exception {
        JwtUtils utils = new JwtUtils();
        setField(utils, "jwtSecret", "test-secret-key-32-bytes-minimum!!");
        setField(utils, "jwtExpiration", expirationMs);
        return utils;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}