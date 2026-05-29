package com.smartassign.pfe.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.smartassign.pfe.dto.AffectationResponse;
import com.smartassign.pfe.dto.ChatbotResponse;
import com.smartassign.pfe.dto.CompetenceResponse;
import com.smartassign.pfe.entity.Affectation;
import com.smartassign.pfe.entity.Collaborateur;
import com.smartassign.pfe.entity.Competence;
import com.smartassign.pfe.entity.Projet;
import com.smartassign.pfe.repository.AffectationRepository;
import com.smartassign.pfe.repository.CollaborateurRepository;
import com.smartassign.pfe.repository.ProjetRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ProjetRepository        projetRepository;
    private final CollaborateurRepository collaborateurRepository;
    private final AffectationRepository   affectationRepository;
    private final AffectationService      affectationService;

    // ────────────────────────────────────────────────────────────────
    //  POINT D'ENTRÉE
    // ────────────────────────────────────────────────────────────────
    public ChatbotResponse repondre(String question, Long managerId) {
        ChatbotResponse response = new ChatbotResponse();

        if (question == null || question.isBlank()) {
            response.setMessage("🤔 Je n'ai pas compris ta question. Tape **aide** pour voir ce que je sais faire.");
            response.setType("erreur");
            return response;
        }

        String q = question.toLowerCase(Locale.ROOT).trim();

        // CAS 6 : aide
        if (contientUn(q, "aide", "help", "que peux-tu", "que peux tu", "commandes")) {
            return aideResponse();
        }

        // CAS 8 : suggestion d'équipe complète
        if (contientUn(q, "équipe", "equipe", "team", "compose", "monte une", "monte-moi une", "monte moi une")) {
            return equipeResponse(question, q);
        }

        // CAS 9 : surcharge / sous-charge
        if (contientUn(q, "surcharg", "sous-charg", "sous charg", "saturé", "sature", "charge de travail", "charge des")) {
            return chargeResponse();
        }

        // CAS 10 : recommandation de formation
        if (contientUn(q, "formation", "former", "à former", "manque", "monter en compétence", "monter en competence")) {
            return formationResponse(question, q);
        }

        // CAS 11 : staffing — remplacer / trouve un profil
        if (contientUn(q, "remplace", "remplacer", "remplaçant", "remplacant",
                          "trouve-moi", "trouve moi", "cherche-moi", "cherche moi", "qui peut",
                          "senior", "junior", "confirmé", "confirme")) {
            ChatbotResponse staffing = staffingResponse(question, q);
            if (staffing != null) return staffing;
        }

        // CAS 4 : statistiques globales
        if (contientUn(q, "stats", "statistique", "tableau de bord", "résumé", "resume", "combien")) {
            return statsResponse();
        }

        // CAS 2 : disponibilités
        if (contientUn(q, "disponible", "libre", "dispo")) {
            return disponiblesResponse();
        }

        // CAS 1 : analyse IA pour un projet
        if (contientUn(q, "meilleur", "recommande", "affecter", "qui pour", "analyse")) {
            return analyseProjetResponse(question, q);
        }

        // CAS 5 : liste des projets
        if (contientUn(q, "projets", "liste des projets", "en cours", "en attente")) {
            return projetsResponse();
        }

        // CAS 3 : profil d'un collaborateur
        if (contientUn(q, "score de", "profil de", "compétences de", "competences de", "montre-moi", "montre moi")) {
            ChatbotResponse profil = collaborateurResponse(question);
            if (profil != null) return profil;
        }

        // CAS 3 (fallback) : prénom dans le message
        ChatbotResponse profilFallback = collaborateurResponse(question);
        if (profilFallback != null) return profilFallback;

        // CAS 7 : non reconnu
        response.setMessage("🤔 Je n'ai pas compris ta question. Tape **aide** pour voir ce que je sais faire.");
        response.setType("erreur");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  SUGGESTIONS RAPIDES
    // ────────────────────────────────────────────────────────────────
    public List<String> getSuggestions() {
        List<String> suggestions = new ArrayList<>();
        suggestions.add("Qui est disponible maintenant ?");
        suggestions.add("Qui est surchargé ?");
        suggestions.add("Trouve-moi un backend senior disponible");
        suggestions.add("Donne-moi les stats globales");

        List<Projet> projetsActifs = projetRepository.findByStatut("en_cours");
        if (projetsActifs.isEmpty()) {
            projetsActifs = projetRepository.findByStatut("en_attente");
        }
        projetsActifs.stream()
                .limit(2)
                .forEach(p -> suggestions.add("Monte-moi une équipe pour " + p.getNom()));

        suggestions.add("Aide");
        return suggestions;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 1 — analyse IA projet
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse analyseProjetResponse(String questionOriginale, String q) {
        ChatbotResponse response = new ChatbotResponse();

        Optional<Projet> projet = trouverProjet(questionOriginale);
        if (projet.isEmpty()) {
            response.setMessage("🔎 Je n'ai pas trouvé le projet mentionné. Précise son nom exact ou tape **projets** pour voir la liste.");
            response.setType("erreur");
            return response;
        }

        Projet p = projet.get();
        List<AffectationResponse> resultats;
        try {
            resultats = affectationService.lancerAffectation(p.getId());
        } catch (Exception ex) {
            response.setMessage("⚠️ Impossible de lancer l'analyse IA pour **" + p.getNom() + "** : " + ex.getMessage());
            response.setType("erreur");
            return response;
        }

        if (resultats.isEmpty()) {
            response.setMessage("ℹ️ Aucun collaborateur ne correspond aux compétences requises pour **" + p.getNom() + "**.");
            response.setType("info");
            return response;
        }

        List<AffectationResponse> top = resultats.stream().limit(3).toList();
        double moyenne = top.stream().mapToDouble(AffectationResponse::getScore).average().orElse(0.0);

        StringBuilder sb = new StringBuilder();
        sb.append("🔍 Analyse IA pour le projet **").append(p.getNom()).append("** :\n\n");
        String[] medals = { "🥇", "🥈", "🥉" };
        List<Map<String, Object>> ligth = new ArrayList<>();
        for (int i = 0; i < top.size(); i++) {
            AffectationResponse a = top.get(i);
            String nom = a.getCollaborateur().getPrenom() + " " + a.getCollaborateur().getNom();
            double score = a.getScore();
            String pot = potentielLabel(score);
            sb.append(medals[i]).append(" **").append(nom).append("** — Score : ")
              .append(formatScore(score)).append("% — ").append(pot).append("\n");

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("rang", i + 1);
            r.put("collaborateurNom", nom);
            r.put("score", formatScore(score));
            r.put("potentielLabel", pot);
            ligth.add(r);
        }
        sb.append("\n📊 Score moyen : ").append(formatScore(moyenne)).append("%");

        response.setMessage(sb.toString());
        response.setType("analyse");
        response.setResultats(new ArrayList<>(ligth));
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 2 — disponibilités
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse disponiblesResponse() {
        ChatbotResponse response = new ChatbotResponse();
        List<Collaborateur> dispos = collaborateurRepository.findByDisponibleTrue();

        if (dispos.isEmpty()) {
            response.setMessage("ℹ️ Aucun collaborateur disponible actuellement.");
            response.setType("info");
            return response;
        }

        StringBuilder sb = new StringBuilder();
        sb.append("✅ **").append(dispos.size()).append(" collaborateurs disponibles** :\n");
        dispos.forEach(c -> sb.append("• ").append(c.getPrenom()).append(" ").append(c.getNom())
                .append(" — ").append(c.getExperienceAnnees()).append(" ans d'expérience\n"));

        response.setMessage(sb.toString());
        response.setType("info");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 3 — profil collaborateur
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse collaborateurResponse(String question) {
        Optional<Collaborateur> collab = trouverCollaborateur(question);
        if (collab.isEmpty()) return null;

        Collaborateur c = collab.get();
        List<Affectation> affectations = affectationRepository.findByCollaborateurId(c.getId());
        double meilleurScore = affectations.stream()
                .mapToDouble(Affectation::getScore)
                .max()
                .orElse(0.0);

        String competences = c.getCompetences() == null || c.getCompetences().isEmpty()
                ? "Aucune compétence renseignée"
                : c.getCompetences().stream().map(Competence::getNom).collect(Collectors.joining(", "));

        StringBuilder sb = new StringBuilder();
        sb.append("👤 **").append(c.getPrenom()).append(" ").append(c.getNom()).append("**\n");
        sb.append("📅 Expérience : ").append(c.getExperienceAnnees()).append(" ans\n");
        sb.append("🛠️ Compétences : ").append(competences).append("\n");
        sb.append("📌 Disponible : ").append(c.isDisponible() ? "oui" : "non").append("\n");
        sb.append("🏆 Meilleur score IA : ").append(formatScore(meilleurScore)).append("%");

        ChatbotResponse response = new ChatbotResponse();
        response.setMessage(sb.toString());
        response.setType("info");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 4 — stats globales
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse statsResponse() {
        long totalCollab = collaborateurRepository.count();
        long dispos      = collaborateurRepository.findByDisponibleTrue().size();

        long projetsActifs = projetRepository.findByStatut("en_cours").size()
                           + projetRepository.findByStatut("en_attente").size();

        List<Affectation> toutes = affectationRepository.findAll();
        long totalAff = toutes.size();

        double moyenne = toutes.stream().mapToDouble(Affectation::getScore).average().orElse(0.0);
        long excellents = toutes.stream().filter(a -> a.getScore() >= 75.0).count();

        StringBuilder sb = new StringBuilder();
        sb.append("📊 **Statistiques SmartAssign**\n");
        sb.append("👥 Collaborateurs : ").append(totalCollab).append(" (").append(dispos).append(" disponibles)\n");
        sb.append("📁 Projets actifs : ").append(projetsActifs).append("\n");
        sb.append("🤖 Affectations IA réalisées : ").append(totalAff).append("\n");
        sb.append("⭐ Score moyen global : ").append(formatScore(moyenne)).append("%\n");
        sb.append("🏆 Excellents profils (≥75%) : ").append(excellents);

        ChatbotResponse response = new ChatbotResponse();
        response.setMessage(sb.toString());
        response.setType("stats");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 5 — liste des projets
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse projetsResponse() {
        List<Projet> projets = projetRepository.findAll();
        ChatbotResponse response = new ChatbotResponse();

        if (projets.isEmpty()) {
            response.setMessage("ℹ️ Aucun projet enregistré.");
            response.setType("info");
            return response;
        }

        StringBuilder sb = new StringBuilder();
        sb.append("📁 **").append(projets.size()).append(" projet(s)** :\n");
        for (Projet p : projets) {
            sb.append("• **").append(p.getNom()).append("** — ")
              .append(statutLabel(p.getStatut())).append(" — ")
              .append(p.getDateDebut()).append(" → ").append(p.getDateFin()).append("\n");
        }
        response.setMessage(sb.toString());
        response.setType("info");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 6 — aide
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse aideResponse() {
        ChatbotResponse response = new ChatbotResponse();
        response.setMessage(
            "🤖 **Je suis l'assistant IA SmartAssign** — Voici ce que tu peux me demander :\n\n"
          + "🔍 **Analyse IA** → 'Qui recommandes-tu pour le projet TunisCommerce B2B ?'\n"
          + "👥 **Disponibilités** → 'Qui est disponible maintenant ?'\n"
          + "👤 **Profil** → 'Montre-moi le profil de Mariem Ben Salah'\n"
          + "📊 **Statistiques** → 'Donne-moi les stats globales'\n"
          + "📁 **Projets** → 'Liste tous les projets en cours'\n"
          + "🧩 **Équipe** → 'Monte-moi une équipe pour TunisCommerce B2B' ou '1 frontend, 1 backend, 1 QA'\n"
          + "⚖️ **Charge** → 'Qui est surchargé ?' / 'Qui est sous-utilisé ?'\n"
          + "🎓 **Formation** → 'Quelle formation pour Mariem ?' ou 'Que manque-t-il pour TunisCommerce B2B ?'\n"
          + "🔁 **Staffing** → 'Trouve-moi un backend senior disponible' / 'Qui peut remplacer Maram ?'"
        );
        response.setType("aide");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 8 — Suggestion d'équipe complète
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse equipeResponse(String questionOriginale, String q) {
        ChatbotResponse response = new ChatbotResponse();

        // Variante A : équipe pour un projet spécifique
        Optional<Projet> projet = trouverProjet(questionOriginale);
        if (projet.isPresent()) {
            return equipePourProjet(projet.get());
        }

        // Variante B : on parse des besoins par poste, ex « 1 frontend, 1 backend, 1 QA »
        LinkedHashMap<String, Integer> besoins = parserBesoinsPostes(q);
        if (besoins.isEmpty()) {
            response.setMessage("ℹ️ Précise un projet (« Monte-moi une équipe pour <projet> ») ou des besoins (« 1 frontend, 1 backend, 1 QA »).");
            response.setType("info");
            return response;
        }

        return equipeParPostes(besoins);
    }

    private ChatbotResponse equipePourProjet(Projet p) {
        ChatbotResponse response = new ChatbotResponse();
        List<AffectationResponse> resultats;
        try {
            resultats = affectationService.lancerAffectation(p.getId());
        } catch (Exception ex) {
            response.setMessage("⚠️ Impossible de composer l'équipe pour **" + p.getNom() + "** : " + ex.getMessage());
            response.setType("erreur");
            return response;
        }

        if (resultats.isEmpty()) {
            response.setMessage("ℹ️ Aucun collaborateur compatible avec les compétences requises pour **" + p.getNom() + "**.");
            response.setType("info");
            return response;
        }

        Set<Long> requisIds = p.getCompetencesRequises().stream()
                .map(Competence::getId).collect(Collectors.toSet());

        List<AffectationResponse> equipe = new ArrayList<>();
        Set<Long> dejaPris = new HashSet<>();
        Set<Long> couvertes = new HashSet<>();

        // Algo glouton : on prend les meilleurs en privilégiant ceux qui apportent
        // des compétences pas encore couvertes par l'équipe
        for (int iter = 0; iter < 4 && couvertes.size() < requisIds.size(); iter++) {
            AffectationResponse meilleur = null;
            int meilleurGain = -1;
            double meilleurScore = -1;
            for (AffectationResponse a : resultats) {
                if (dejaPris.contains(a.getCollaborateur().getId())) continue;
                Set<Long> comps = a.getCollaborateur().getCompetences() == null ? Set.of()
                    : a.getCollaborateur().getCompetences().stream()
                        .map(CompetenceResponse::getId).collect(Collectors.toSet());
                int gain = (int) comps.stream().filter(requisIds::contains).filter(id -> !couvertes.contains(id)).count();
                if (gain > meilleurGain || (gain == meilleurGain && a.getScore() > meilleurScore)) {
                    meilleur = a;
                    meilleurGain = gain;
                    meilleurScore = a.getScore();
                }
            }
            if (meilleur == null || (meilleurGain == 0 && !equipe.isEmpty())) break;
            equipe.add(meilleur);
            dejaPris.add(meilleur.getCollaborateur().getId());
            if (meilleur.getCollaborateur().getCompetences() != null) {
                meilleur.getCollaborateur().getCompetences().forEach(c -> {
                    if (requisIds.contains(c.getId())) couvertes.add(c.getId());
                });
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("🧩 **Équipe optimale pour ").append(p.getNom()).append("**\n\n");
        List<Map<String, Object>> ligth = new ArrayList<>();
        for (int i = 0; i < equipe.size(); i++) {
            AffectationResponse a = equipe.get(i);
            String nom = a.getCollaborateur().getPrenom() + " " + a.getCollaborateur().getNom();
            sb.append("• **").append(nom).append("** — ")
              .append("Score ").append(formatScore(a.getScore())).append("% — ")
              .append(a.getCollaborateur().getExperienceAnnees()).append(" ans — ")
              .append(potentielLabel(a.getScore())).append("\n");

            Map<String, Object> r = new LinkedHashMap<>();
            r.put("rang", i + 1);
            r.put("collaborateurNom", nom);
            r.put("score", formatScore(a.getScore()));
            r.put("potentielLabel", potentielLabel(a.getScore()));
            ligth.add(r);
        }
        int couvert = couvertes.size();
        int total = requisIds.size();
        sb.append("\n📊 Couverture compétences : ").append(couvert).append(" / ").append(total)
          .append(" (").append(total == 0 ? 0 : Math.round(100.0 * couvert / total)).append("%)");

        response.setMessage(sb.toString());
        response.setType("analyse");
        response.setResultats(new ArrayList<>(ligth));
        return response;
    }

    private ChatbotResponse equipeParPostes(LinkedHashMap<String, Integer> besoins) {
        ChatbotResponse response = new ChatbotResponse();
        List<Collaborateur> dispos = collaborateurRepository.findByDisponibleTrue();
        if (dispos.isEmpty()) {
            response.setMessage("ℹ️ Aucun collaborateur disponible pour composer une équipe.");
            response.setType("info");
            return response;
        }

        Set<Long> dejaPris = new HashSet<>();
        StringBuilder sb = new StringBuilder("🧩 **Équipe proposée**\n\n");
        List<Map<String, Object>> ligth = new ArrayList<>();
        boolean auMoinsUn = false;

        for (Map.Entry<String, Integer> entry : besoins.entrySet()) {
            String poste = entry.getKey();
            int nb = entry.getValue();
            List<Collaborateur> candidats = dispos.stream()
                .filter(c -> !dejaPris.contains(c.getId()))
                .filter(c -> matchPoste(c, poste))
                .sorted(Comparator.comparingInt(Collaborateur::getExperienceAnnees).reversed())
                .limit(nb)
                .toList();

            sb.append("**").append(prettyPoste(poste)).append("** (").append(nb).append(") :\n");
            if (candidats.isEmpty()) {
                sb.append("  ⚠️ Aucun profil disponible correspondant.\n");
            } else {
                for (Collaborateur c : candidats) {
                    auMoinsUn = true;
                    dejaPris.add(c.getId());
                    String nom = c.getPrenom() + " " + c.getNom();
                    sb.append("  • ").append(nom)
                      .append(" — ").append(c.getExperienceAnnees()).append(" ans — ")
                      .append(competencesCourtes(c)).append("\n");

                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("rang", ligth.size() + 1);
                    r.put("collaborateurNom", nom);
                    r.put("score", c.getExperienceAnnees() + "a");
                    r.put("potentielLabel", prettyPoste(poste));
                    ligth.add(r);
                }
            }
        }

        response.setMessage(sb.toString());
        response.setType(auMoinsUn ? "analyse" : "info");
        response.setResultats(new ArrayList<>(ligth));
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 9 — Charge de travail (surcharge / sous-charge)
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse chargeResponse() {
        List<Collaborateur> tous = collaborateurRepository.findAll();
        Set<Long> projetsActifs = projetRepository.findByStatut("en_cours").stream()
            .map(Projet::getId).collect(Collectors.toSet());

        Map<Long, Long> chargeParCollab = affectationRepository.findAll().stream()
            .filter(a -> a.getProjet() != null && projetsActifs.contains(a.getProjet().getId()))
            .collect(Collectors.groupingBy(a -> a.getCollaborateur().getId(), Collectors.counting()));

        int seuilSurcharge = 3;   // ≥ 3 projets actifs = surchargé
        int seuilSousCharge = 0;  // 0 projet actif = sous-utilisé

        List<String> surcharges = new ArrayList<>();
        List<String> sousCharges = new ArrayList<>();

        for (Collaborateur c : tous) {
            long n = chargeParCollab.getOrDefault(c.getId(), 0L);
            String nom = c.getPrenom() + " " + c.getNom();
            int pct = (int) Math.min(150, n * 40); // 0,40,80,120,150…
            if (n >= seuilSurcharge) {
                surcharges.add("• **" + nom + "** — " + n + " projets actifs (" + pct + "% charge estimée)");
            } else if (n == seuilSousCharge && c.isDisponible()) {
                sousCharges.add("• **" + nom + "** — 0 projet actif, disponible");
            }
        }

        StringBuilder sb = new StringBuilder("⚖️ **Charge de travail**\n\n");
        sb.append("🔴 **Surchargés** (").append(surcharges.size()).append(") :\n");
        if (surcharges.isEmpty()) sb.append("  Aucun collaborateur surchargé.\n");
        else surcharges.forEach(s -> sb.append("  ").append(s).append("\n"));

        sb.append("\n🟢 **Sous-utilisés** (").append(sousCharges.size()).append(") :\n");
        if (sousCharges.isEmpty()) sb.append("  Aucun collaborateur sous-utilisé.\n");
        else sousCharges.forEach(s -> sb.append("  ").append(s).append("\n"));

        ChatbotResponse response = new ChatbotResponse();
        response.setMessage(sb.toString());
        response.setType("stats");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 10 — Recommandation de formation
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse formationResponse(String questionOriginale, String q) {
        ChatbotResponse response = new ChatbotResponse();

        // Variante A : formation pour un collaborateur
        Optional<Collaborateur> collab = trouverCollaborateur(questionOriginale);
        if (collab.isPresent()) {
            Collaborateur c = collab.get();
            Set<Long> ses = c.getCompetences() == null ? Set.of()
                : c.getCompetences().stream().map(Competence::getId).collect(Collectors.toSet());

            // Compétences demandées par les projets actifs où il n'est pas affecté
            Set<Long> projetsDeLui = affectationRepository.findByCollaborateurId(c.getId()).stream()
                .map(a -> a.getProjet().getId()).collect(Collectors.toSet());

            Map<String, Long> manquantes = projetRepository.findAll().stream()
                .filter(p -> !"termine".equals(p.getStatut()))
                .filter(p -> !projetsDeLui.contains(p.getId()))
                .flatMap(p -> p.getCompetencesRequises().stream())
                .filter(comp -> !ses.contains(comp.getId()))
                .collect(Collectors.groupingBy(Competence::getNom, Collectors.counting()));

            StringBuilder sb = new StringBuilder("🎓 **Formations recommandées pour ")
                .append(c.getPrenom()).append(" ").append(c.getNom()).append("**\n\n");
            if (manquantes.isEmpty()) {
                sb.append("✅ Aucun manque détecté : son profil couvre déjà tous les besoins actuels.");
            } else {
                manquantes.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(5)
                    .forEach(e -> sb.append("• **").append(e.getKey()).append("** — demandée par ")
                        .append(e.getValue()).append(" projet(s)\n"));
                sb.append("\n💡 Formation prioritaire suggérée pour augmenter son employabilité.");
            }
            response.setMessage(sb.toString());
            response.setType("info");
            return response;
        }

        // Variante B : formation pour un projet
        Optional<Projet> projet = trouverProjet(questionOriginale);
        if (projet.isPresent()) {
            Projet p = projet.get();
            Set<Long> requises = p.getCompetencesRequises().stream().map(Competence::getId).collect(Collectors.toSet());

            // Couvert par les collaborateurs disponibles ?
            Set<Long> couvertes = collaborateurRepository.findByDisponibleTrue().stream()
                .flatMap(c -> c.getCompetences().stream())
                .map(Competence::getId)
                .collect(Collectors.toSet());

            List<String> manquantes = p.getCompetencesRequises().stream()
                .filter(c -> !couvertes.contains(c.getId()))
                .map(Competence::getNom).toList();

            StringBuilder sb = new StringBuilder("🎓 **Besoins en formation pour ").append(p.getNom()).append("**\n\n");
            if (manquantes.isEmpty()) {
                sb.append("✅ Toutes les compétences requises sont couvertes par les profils disponibles.");
            } else {
                sb.append("Compétences requises non couvertes par les profils disponibles :\n");
                manquantes.forEach(m -> sb.append("• **").append(m).append("**\n"));
                sb.append("\n💡 Lancer une formation interne ou renforcer le recrutement sur ces compétences.");
            }
            response.setMessage(sb.toString());
            response.setType("info");
            return response;
        }

        response.setMessage("ℹ️ Précise un collaborateur (« Quelle formation pour Mariem ? ») ou un projet (« Que manque-t-il pour TunisCommerce B2B ? »).");
        response.setType("info");
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  CAS 11 — Staffing : remplacer / trouver un profil
    // ────────────────────────────────────────────────────────────────
    private ChatbotResponse staffingResponse(String questionOriginale, String q) {
        // Variante A : remplacer X
        if (q.contains("remplace") || q.contains("remplaçant") || q.contains("remplacant")) {
            Optional<Collaborateur> cible = trouverCollaborateur(questionOriginale);
            if (cible.isPresent()) {
                return remplacantsPour(cible.get());
            }
        }

        // Variante B : trouver un poste/séniorité dispo
        String poste = detecterPoste(q);
        Integer minExp = detecterSeniorite(q);
        boolean veutDispo = q.contains("dispo") || q.contains("disponible") || q.contains("libre");

        if (poste != null || minExp != null) {
            return rechercherProfil(poste, minExp, veutDispo);
        }
        return null; // pas reconnu, laisse les autres cas tenter
    }

    private ChatbotResponse remplacantsPour(Collaborateur cible) {
        Set<Long> sesComps = cible.getCompetences() == null ? Set.of()
            : cible.getCompetences().stream().map(Competence::getId).collect(Collectors.toSet());

        List<Map.Entry<Collaborateur, Integer>> candidats = collaborateurRepository.findByDisponibleTrue().stream()
            .filter(c -> !Objects.equals(c.getId(), cible.getId()))
            .map(c -> {
                Set<Long> ses = c.getCompetences() == null ? Set.of()
                    : c.getCompetences().stream().map(Competence::getId).collect(Collectors.toSet());
                int overlap = (int) ses.stream().filter(sesComps::contains).count();
                return Map.entry(c, overlap);
            })
            .filter(e -> e.getValue() > 0)
            .sorted(Map.Entry.<Collaborateur, Integer>comparingByValue().reversed())
            .limit(3)
            .toList();

        StringBuilder sb = new StringBuilder("🔁 **Remplaçants possibles pour ")
            .append(cible.getPrenom()).append(" ").append(cible.getNom()).append("**\n\n");
        ChatbotResponse response = new ChatbotResponse();
        if (candidats.isEmpty()) {
            sb.append("ℹ️ Aucun collaborateur disponible avec des compétences en commun.");
            response.setType("info");
        } else {
            int total = sesComps.size();
            for (Map.Entry<Collaborateur, Integer> e : candidats) {
                Collaborateur c = e.getKey();
                int pct = total == 0 ? 0 : (int) Math.round(100.0 * e.getValue() / total);
                sb.append("• **").append(c.getPrenom()).append(" ").append(c.getNom()).append("** — ")
                  .append(c.getExperienceAnnees()).append(" ans — ")
                  .append(e.getValue()).append("/").append(total)
                  .append(" compétences en commun (").append(pct).append("%)\n");
            }
            response.setType("analyse");
        }
        response.setMessage(sb.toString());
        return response;
    }

    private ChatbotResponse rechercherProfil(String poste, Integer minExp, boolean dispoOnly) {
        List<Collaborateur> base = dispoOnly
            ? collaborateurRepository.findByDisponibleTrue()
            : collaborateurRepository.findAll();

        List<Collaborateur> filtres = base.stream()
            .filter(c -> poste == null || matchPoste(c, poste))
            .filter(c -> minExp == null || c.getExperienceAnnees() >= minExp)
            .sorted(Comparator.comparingInt(Collaborateur::getExperienceAnnees).reversed())
            .limit(5)
            .toList();

        StringBuilder sb = new StringBuilder("🔍 **Recherche**");
        if (poste != null)  sb.append(" · ").append(prettyPoste(poste));
        if (minExp != null) sb.append(" · ≥ ").append(minExp).append(" ans");
        if (dispoOnly)      sb.append(" · disponibles");
        sb.append("\n\n");

        ChatbotResponse response = new ChatbotResponse();
        if (filtres.isEmpty()) {
            sb.append("ℹ️ Aucun profil correspondant.");
            response.setType("info");
        } else {
            for (Collaborateur c : filtres) {
                sb.append("• **").append(c.getPrenom()).append(" ").append(c.getNom()).append("** — ")
                  .append(c.getExperienceAnnees()).append(" ans — ")
                  .append(c.isDisponible() ? "Disponible" : "Occupé").append(" — ")
                  .append(competencesCourtes(c)).append("\n");
            }
            response.setType("info");
        }
        response.setMessage(sb.toString());
        return response;
    }

    // ────────────────────────────────────────────────────────────────
    //  Helpers métier (postes, séniorité, parsing)
    // ────────────────────────────────────────────────────────────────
    private static final Map<String, List<String>> POSTE_KEYWORDS = Map.of(
        "frontend", List.of("frontend", "front-end", "front end", "angular", "react", "vue", "html", "css"),
        "backend",  List.of("backend", "back-end", "back end", "java", "spring", "node", "django", "api"),
        "qa",       List.of("qa", "test", "testeur", "tester", "qualité", "qualite", "selenium", "cypress"),
        "devops",   List.of("devops", "docker", "kubernetes", "ci/cd", "cicd", "jenkins"),
        "data",     List.of("data", "analyste", "analyst", "ml", "machine learning", "sql", "bi"),
        "mobile",   List.of("mobile", "android", "ios", "flutter")
    );

    private LinkedHashMap<String, Integer> parserBesoinsPostes(String q) {
        LinkedHashMap<String, Integer> besoins = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> e : POSTE_KEYWORDS.entrySet()) {
            String poste = e.getKey();
            for (String kw : e.getValue()) {
                int idx = q.indexOf(kw);
                if (idx >= 0) {
                    int nb = lireNombreAvant(q, idx);
                    besoins.merge(poste, Math.max(1, nb), Integer::max);
                    break;
                }
            }
        }
        return besoins;
    }

    private int lireNombreAvant(String q, int pos) {
        int i = pos - 1;
        while (i >= 0 && q.charAt(i) == ' ') i--;
        int end = i + 1;
        while (i >= 0 && Character.isDigit(q.charAt(i))) i--;
        int start = i + 1;
        if (start >= end) return 1;
        try {
            return Integer.parseInt(q.substring(start, end));
        } catch (NumberFormatException ex) {
            return 1;
        }
    }

    private boolean matchPoste(Collaborateur c, String poste) {
        List<String> kws = POSTE_KEYWORDS.getOrDefault(poste, List.of(poste));
        if (c.getCompetences() == null) return false;
        return c.getCompetences().stream()
            .map(Competence::getNom)
            .filter(Objects::nonNull)
            .map(s -> s.toLowerCase(Locale.ROOT))
            .anyMatch(nom -> kws.stream().anyMatch(nom::contains));
    }

    private String detecterPoste(String q) {
        for (Map.Entry<String, List<String>> e : POSTE_KEYWORDS.entrySet()) {
            for (String kw : e.getValue()) if (q.contains(kw)) return e.getKey();
        }
        return null;
    }

    private Integer detecterSeniorite(String q) {
        if (q.contains("senior"))    return 5;
        if (q.contains("confirmé") || q.contains("confirme")) return 3;
        if (q.contains("junior"))    return 0;
        return null;
    }

    private String prettyPoste(String p) {
        if (p == null) return "—";
        return switch (p) {
            case "frontend" -> "Frontend";
            case "backend"  -> "Backend";
            case "qa"       -> "QA";
            case "devops"   -> "DevOps";
            case "data"     -> "Data";
            case "mobile"   -> "Mobile";
            default         -> p.substring(0, 1).toUpperCase(Locale.ROOT) + p.substring(1);
        };
    }

    private String competencesCourtes(Collaborateur c) {
        if (c.getCompetences() == null || c.getCompetences().isEmpty()) return "—";
        return c.getCompetences().stream().limit(3).map(Competence::getNom).collect(Collectors.joining(", "));
    }

    // ────────────────────────────────────────────────────────────────
    //  UTILITAIRES
    // ────────────────────────────────────────────────────────────────
    private boolean contientUn(String texte, String... motsCles) {
        for (String m : motsCles) {
            if (texte.contains(m)) return true;
        }
        return false;
    }

    private Optional<Projet> trouverProjet(String questionOriginale) {
        List<Projet> tous = projetRepository.findAll();
        if (tous.isEmpty()) return Optional.empty();

        String qLower = questionOriginale.toLowerCase(Locale.ROOT);
        // Tentative 1 : nom complet contenu dans le message
        Optional<Projet> match = tous.stream()
                .filter(p -> qLower.contains(p.getNom().toLowerCase(Locale.ROOT)))
                .max(Comparator.comparingInt(p -> p.getNom().length()));
        if (match.isPresent()) return match;

        // Tentative 2 : mot significatif partagé (> 3 lettres)
        String[] mots = qLower.split("\\W+");
        for (String mot : mots) {
            if (mot.length() < 4) continue;
            List<Projet> hits = projetRepository.findByNomContainingIgnoreCase(mot);
            if (!hits.isEmpty()) {
                return hits.stream().max(Comparator.comparingInt(p -> p.getNom().length()));
            }
        }
        return Optional.empty();
    }

    private Optional<Collaborateur> trouverCollaborateur(String questionOriginale) {
        String qLower = questionOriginale.toLowerCase(Locale.ROOT);
        List<Collaborateur> tous = collaborateurRepository.findAll();

        // Score chaque collaborateur sur la base du nb de tokens présents dans le message
        Map<Collaborateur, Integer> scores = new HashMap<>();
        for (Collaborateur c : tous) {
            int s = 0;
            String prenom = c.getPrenom() == null ? "" : c.getPrenom().toLowerCase(Locale.ROOT);
            String nom    = c.getNom()    == null ? "" : c.getNom().toLowerCase(Locale.ROOT);
            if (prenom.length() >= 2 && qLower.contains(prenom)) s += prenom.length();
            if (nom.length()    >= 2 && qLower.contains(nom))    s += nom.length();
            if (s > 0) scores.put(c, s);
        }
        return scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey);
    }

    private String potentielLabel(double score) {
        if (score >= 85) return "Excellent profil";
        if (score >= 75) return "Très bon profil";
        if (score >= 60) return "Bon profil";
        if (score >= 40) return "Profil correct";
        return "Profil limité";
    }

    private String formatScore(double s) {
        return String.format(Locale.ROOT, "%.1f", s);
    }

    private String statutLabel(String statut) {
        if (statut == null) return "—";
        return switch (statut) {
            case "en_cours"   -> "En cours";
            case "en_attente" -> "En attente";
            case "termine"    -> "Terminé";
            default           -> statut;
        };
    }
}
