package com.smartassign.pfe.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.access.AccessDeniedHandlerImpl;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final BearerTokenAuthenticationFilter bearerTokenAuthenticationFilter;

    public SecurityConfig(BearerTokenAuthenticationFilter bearerTokenAuthenticationFilter) {
        this.bearerTokenAuthenticationFilter = bearerTokenAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .httpBasic(httpBasic -> httpBasic.disable())
            .formLogin(form -> form.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/auth/csrf-token").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/renvoyer-identifiants").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/reset-password/validate").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/verify-email").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/competences", "/api/competences/*").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/competences").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/competences/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers("/ws", "/ws/**", "/error").permitAll()

                .requestMatchers("/api/dashboard/admin/**", "/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/manager/ia/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers("/api/dashboard/manager/**", "/api/manager/**").hasAnyRole("MANAGER", "ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/projets", "/api/projets/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/projets", "/api/projets/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/projets/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/projets/*/statut").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/projets/**").hasAnyRole("ADMIN", "MANAGER")

                .requestMatchers(HttpMethod.GET, "/api/collaborateurs/search/by-email").hasAnyRole("COLLAB", "MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.GET,
                    "/api/collaborateurs/*/dashboard",
                    "/api/collaborateurs/*/mes-projets",
                    "/api/collaborateurs/*/historique",
                    "/api/collaborateurs/*/affectations",
                    "/api/collaborateurs/*/taches",
                    "/api/collaborateurs/*/conges",
                    "/api/collaborateurs/*/notifications"
                ).hasAnyRole("COLLAB", "MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.POST,
                    "/api/collaborateurs/*/notifications/*/dismiss",
                    "/api/collaborateurs/*/notifications/mark-all-read"
                ).hasAnyRole("COLLAB", "MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/collaborateurs", "/api/collaborateurs/disponibles", "/api/collaborateurs/*").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/collaborateurs").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/collaborateurs/*").hasAnyRole("COLLAB", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/collaborateurs/*/role", "/api/collaborateurs/*/disponibilite").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/collaborateurs/*/renvoyer-verification").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/collaborateurs/*").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/affectations", "/api/affectations/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/affectations", "/api/affectations/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/affectations/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/affectations/**").hasAnyRole("MANAGER", "ADMIN")
                .requestMatchers("/api/planning/**", "/api/utilisateurs/*/disponibilite").hasAnyRole("COLLAB", "MANAGER", "ADMIN")
                .requestMatchers("/api/collaborateur/notifications/**").hasRole("COLLAB")
                .requestMatchers("/api/jalons/**", "/api/activites/**", "/api/journal/**", "/api/utilisateurs/disponibilite/**", "/api/dashboard-rh/**").hasRole("ADMIN")
                .requestMatchers("/api/chatbot/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/auth/users").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                .accessDeniedHandler(new AccessDeniedHandlerImpl())
            )
            .addFilterBefore(bearerTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOriginPatterns(List.of("http://localhost:*", "https://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }
}
