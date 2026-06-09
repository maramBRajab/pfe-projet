package com.smartassign.pfe;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.CompetenceRepository;
import com.smartassign.pfe.service.AuthService;
import com.smartassign.pfe.service.NotificationGeneratorService;
import com.smartassign.pfe.service.RhDashboardService;

@SpringBootApplication
@EnableScheduling
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

    @Bean
    CommandLineRunner ensureNourCompetences(
        CollaborateurRepository collaborateurRepository,
        CompetenceRepository competenceRepository
    ) {
        return args -> {
            final Long targetId = 80L;
            final String targetFullName = "nour ben romdhane";
            final String fallbackEmail = "nour.ben.romdhane@smartassign.tn";

            Collaborateur nour = collaborateurRepository.findById(targetId)
                .or(() -> collaborateurRepository.findAll().stream()
                    .filter(c -> {
                        String fullName = String.format("%s %s", c.getPrenom(), c.getNom())
                            .trim()
                            .toLowerCase();
                        return targetFullName.equals(fullName);
                    })
                    .findFirst())
                .or(() -> collaborateurRepository.findByEmailIgnoreCase(fallbackEmail))
                .orElseGet(() -> Collaborateur.builder()
                    .prenom("Nour")
                    .nom("Ben Romdhane")
                    .email(fallbackEmail)
                    .role("COLLAB")
                    .experienceAnnees(3)
                    .disponible(true)
                    .build());

            nour.setExperienceAnnees(3);

            List<String> requiredSkills = List.of("Angular", "Java", "React Native");

            for (String skillName : requiredSkills) {
                Competence skill = competenceRepository.findByNomIgnoreCase(skillName)
                    .orElseGet(() -> competenceRepository.save(Competence.builder().nom(skillName).build()));
                nour.getCompetences().add(skill);
            }

            collaborateurRepository.save(nour);
        };
    }

    @Bean
    CommandLineRunner initRhDashboardData(RhDashboardService rhDashboardService) {
        return args -> rhDashboardService.generateTestData();
    }

    @Bean
    CommandLineRunner initSystemNotifications(NotificationGeneratorService notificationGeneratorService) {
        return args -> notificationGeneratorService.generateSystemNotifications();
    }
}