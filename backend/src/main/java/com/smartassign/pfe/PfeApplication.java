package com.smartassign.pfe;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.ObjectProvider;

import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.service.AuthService;

@SpringBootApplication
public class PfeApplication {

    public static void main(String[] args) {
        SpringApplication.run(PfeApplication.class, args);
    }

    // Créer l'admin par défaut au démarrage
    @Bean
    CommandLineRunner initAdmin(ObjectProvider<AuthService> authServiceProvider) {
        return args -> {
            AuthService authService = authServiceProvider.getIfAvailable();
            if (authService != null) {
                authService.initAdminSiAbsent();
            }
        };
    }

    // Seed compétences de référence si la table est vide
    @Bean
    CommandLineRunner initCompetences(CompetenceRepository repo) {
        return args -> {
            if (repo.count() == 0) {
                List<String> noms = List.of(
                    "JavaScript", "TypeScript", "Angular", "React", "Node.js",
                    "Python", "Java", "SQL", "MongoDB", "Docker", "Git",
                    "Gestion de projet", "Analyse de données", "UX/UI Design",
                    "Communication", "Leadership", "Agile/Scrum"
                );
                for (String nom : noms) {
                    repo.save(Competence.builder().nom(nom).build());
                }
            }
        };
    }
}