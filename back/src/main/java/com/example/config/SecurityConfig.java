package com.example.config;

import com.example.security.JwtAuthFilter;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthFilter jwtAuthFilter;

        private static final String[] PUBLIC_URLS = {
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/forgot-password",
                        "/api/auth/reset-password",
                        "/api/auth/roles",
                        // ── Swagger / OpenAPI ──────────────────────────
                        "/v3/api-docs",
                        "/v3/api-docs/**",
                        "/v3/api-docs.yaml",
                        "/swagger-ui/**",
                        "/swagger-ui.html",
                        "/swagger-ui/index.html",
                        "/webjars/**"
        };

        @Bean
        public WebSecurityCustomizer webSecurityCustomizer() {
                return web -> web.ignoring().requestMatchers("/uploads/**");
        }

        @Bean
        public RestTemplate restTemplate() {
                return new RestTemplate();
        }

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(AbstractHttpConfigurer::disable)
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth
                                                .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD)
                                                .permitAll()
                                                .requestMatchers(PUBLIC_URLS).permitAll()
                                                .requestMatchers("/error").permitAll()
                                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                                .requestMatchers(HttpMethod.POST, "/api/auth/register")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.POST, "/api/auth/login",
                                                                "/api/auth/forgot-password",
                                                                "/api/auth/reset-password")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/auth/roles").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/sites").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/plants", "/api/plants/site/**").permitAll()
                                                .requestMatchers("/api/assistant/**").hasAnyRole("AGENT_QUALITE", "ADMIN", "ADMIN_PLANT", "PPO")
                                                .requestMatchers(HttpMethod.GET, "/v3/api-docs/**", "/swagger-ui/**",
                                                                "/webjars/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/criteres/*/historique")
                                                .authenticated()

                                                .requestMatchers("/api/admin/**")
                                                .hasAnyRole("ADMIN", "ADMIN_PLANT", "CHEF_LIGNE")

                                                // ✅ Profil self-update — TOUS les rôles connectés
                                                .requestMatchers("/api/profil/**").authenticated()

                                                // GET — tous les rôles connectés
                                                .requestMatchers(HttpMethod.GET,
                                                                "/api/processus/**", "/api/machines/**",
                                                                "/api/criteres/**", "/api/checklists/**",
                                                                "/api/segments/**", "/api/plants/**",
                                                                "/api/sites/**", "/api/dashboard/**")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.GET, "/api/utilisateurs/**")
                                                .hasAnyRole("CHEF_LIGNE", "TECHNICIEN", "AGENT_QUALITE", "ADMIN", "ADMIN_PLANT", "PPO")
                                                .requestMatchers("/api/ai/**").hasAnyRole("ADMIN", "ADMIN_PLANT", "PPO")
                                                // Checklist — import PDF (Admin et PPO)
                                                .requestMatchers(HttpMethod.POST, "/api/checklists/import-pdf")
                                                .hasAnyRole("ADMIN", "ADMIN_PLANT", "PPO")

                                                // Checklist — soumettre (Opérateur uniquement)
                                                .requestMatchers(HttpMethod.POST, "/api/checklists/soumettre")
                                                .hasAnyRole("OPERATEUR", "ADMIN", "ADMIN_PLANT")

                                                // Checklist — validation N1 (Chef de ligne)
                                                .requestMatchers(HttpMethod.PATCH, "/api/checklists/*/valider-n1")
                                                .hasAnyRole("CHEF_LIGNE", "ADMIN", "ADMIN_PLANT")

                                                // Checklist — validation N2 (Technicien)
                                                .requestMatchers(HttpMethod.PATCH, "/api/checklists/*/valider-n2")
                                                .hasAnyRole("TECHNICIEN", "ADMIN", "ADMIN_PLANT")

                                                // Checklist — validation finale (Agent Qualité)
                                                .requestMatchers(HttpMethod.PATCH, "/api/checklists/*/valider-final")
                                                .hasAnyRole("AGENT_QUALITE", "ADMIN", "ADMIN_PLANT")

                                                // Checklist — rejet (Chef de ligne, Technicien, Agent Qualité)
                                                .requestMatchers(HttpMethod.PATCH, "/api/checklists/*/rejeter")
                                                .hasAnyRole("CHEF_LIGNE", "TECHNICIEN", "AGENT_QUALITE", "ADMIN", "ADMIN_PLANT")

                                                // IA PDF
                                                .requestMatchers(HttpMethod.POST, "/api/ai/**")
                                                .hasAnyRole("PPO", "ADMIN", "ADMIN_PLANT")

                                                // CRUD processus / machines / critères
                                                .requestMatchers(HttpMethod.POST,
                                                                "/api/processus/**", "/api/machines/**",
                                                                "/api/criteres/**")
                                                .hasAnyRole("PPO", "ADMIN", "ADMIN_PLANT")
                                                .requestMatchers(HttpMethod.PUT,
                                                                "/api/processus/**", "/api/machines/**",
                                                                "/api/criteres/**")
                                                .hasAnyRole("PPO", "ADMIN", "ADMIN_PLANT")
                                                .requestMatchers(HttpMethod.DELETE,
                                                                "/api/processus/**", "/api/machines/**",
                                                                "/api/criteres/**")
                                                .hasAnyRole("PPO", "ADMIN", "ADMIN_PLANT")
                                                .requestMatchers(HttpMethod.GET, "/api/plans-action/**")
                                                .hasAnyRole("CHEF_LIGNE", "TECHNICIEN", "AGENT_QUALITE", "ADMIN", "ADMIN_PLANT", "PPO")
                                                .requestMatchers(HttpMethod.POST, "/api/plans-action/suggerer-description/**")
                                                .hasAnyRole("CHEF_LIGNE", "TECHNICIEN", "AGENT_QUALITE", "ADMIN", "ADMIN_PLANT", "PPO")
                                                .requestMatchers(HttpMethod.POST, "/api/plans-action/**")
                                                .hasAnyRole("CHEF_LIGNE", "ADMIN", "ADMIN_PLANT", "PPO")
                                                .requestMatchers(HttpMethod.PATCH, "/api/plans-action/**")
                                                .hasAnyRole("CHEF_LIGNE", "TECHNICIEN", "AGENT_QUALITE", "ADMIN", "ADMIN_PLANT")
                                                .requestMatchers(HttpMethod.DELETE, "/api/plans-action/**")
                                                .hasAnyRole("ADMIN", "ADMIN_PLANT")
                                                .anyRequest().authenticated())

                                .exceptionHandling(ex -> ex
                                                .authenticationEntryPoint((request, response, e) -> {
                                                        response.setStatus(401);
                                                        response.getWriter().write("Non authentifié");
                                                })
                                                .accessDeniedHandler((request, response, e) -> {
                                                        response.setStatus(403);
                                                        response.getWriter().write("Accès refusé : rôle insuffisant");
                                                }))
                                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationManager authenticationManager(
                        AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowedOriginPatterns(List.of("*"));
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }
}