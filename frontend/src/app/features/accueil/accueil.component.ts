import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardService, type DashboardStats } from '../../services/admin';
import { ChatbotService, type ChatbotResult } from '../../services/manager/chatbot.service';

interface FeatureCard {
  iconBg: string;
  iconColor: string;
  icon: string;
  title: string;
  desc: string;
}

interface StepCard {
  badgeBg: string;
  num: number;
  title: string;
  desc: string;
}

interface StatResult {
  value: string;
  unit: string;
  color: string;
  label: string;
  percent: number;
}

@Component({
  selector: 'app-accueil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './accueil.component.html',
  styleUrl: './accueil.component.scss'
})
export class AccueilComponent implements OnInit {
  kpis: DashboardStats | null = null;
  loading = true;
  error = '';
  iaScore: number | null = null;
  recommandations: ChatbotResult[] = [];

  constructor(private dashboardService: AdminDashboardService, private chatbotService: ChatbotService) {}

  scrollTo(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }

  readonly steps: StepCard[] = [
    {
      badgeBg: '#3b82f6',
      num: 1,
      title: 'Créer le projet',
      desc: 'Le Manager définit les informations du projet : nom, description, compétences requises, durée et dates clés.'
    },
    {
      badgeBg: '#10b981',
      num: 2,
      title: 'Analyser les profils',
      desc: 'L’IA analyse les compétences, disponibilités et historiques de tous les collaborateurs du catalogue.'
    },
    {
      badgeBg: '#8b5cf6',
      num: 3,
      title: 'Consulter les scores',
      desc: 'Les profils sont classés par score de compatibilité avec potentiel (Excellent, Bon, À confirmer).'
    },
    {
      badgeBg: '#f59e0b',
      num: 4,
      title: 'Affecter en 1 clic',
      desc: 'Le Manager confirme l’affectation. Le collaborateur est notifié et son planning mis à jour automatiquement.'
    }
  ];

  readonly features: FeatureCard[] = [
    {
      iconBg: '#dbeafe', iconColor: '#3b82f6', icon: 'ti-robot',
      title: 'Matching IA intelligent',
      desc: 'Le moteur IA calcule un score de compatibilité précis en analysant compétences, expérience et disponibilité de chaque profil.'
    },
    {
      iconBg: '#dcfce7', iconColor: '#10b981', icon: 'ti-users',
      title: 'Gestion des collaborateurs',
      desc: 'Centralisez tous vos profils avec compétences, niveaux, disponibilités et historiques d’affectation en un seul endroit.'
    },
    {
      iconBg: '#ede9fe', iconColor: '#8b5cf6', icon: 'ti-folder',
      title: 'Pilotage des projets',
      desc: 'Créez et suivez vos projets avec statuts, deadlines, taux de complétion et alertes de vigilance en temps réel.'
    },
    {
      iconBg: '#fef9c3', iconColor: '#f59e0b', icon: 'ti-chart-bar',
      title: 'Supervision globale',
      desc: 'L’administrateur supervise l’ensemble de la plateforme avec des KPIs précis, tableaux de bord et journal d’audit complet.'
    },
    {
      iconBg: '#cffafe', iconColor: '#06b6d4', icon: 'ti-calendar',
      title: 'Planning collaborateur',
      desc: 'Chaque collaborateur visualise son calendrier, ses tâches, ses jalons et sa charge de travail hebdomadaire.'
    },
    {
      iconBg: '#fee2e2', iconColor: '#ef4444', icon: 'ti-bell',
      title: 'Alertes & notifications',
      desc: 'Système d’alertes multi-niveaux : critique, vigilance, information — pour chaque rôle avec historique complet.'
    }
  ];

  results: StatResult[] = [];

  ngOnInit(): void {
    this.loading = true;
    this.dashboardService.getStats().subscribe({
      next: (stats) => {
        this.kpis = stats;
        this.results = [
          {
            value: stats.tauxAffectation?.toString() ?? '-',
            unit: '%',
            color: '#3b82f6',
            label: 'Taux d’affectation moyen',
            percent: stats.tauxAffectation ?? 0
          },
          {
            value: stats.totalCollaborateurs?.toString() ?? '-',
            unit: '',
            color: '#10b981',
            label: 'Collaborateurs gérés',
            percent: 100 // à adapter si besoin
          },
          {
            value: stats.projetsActifs?.toString() ?? '-',
            unit: '',
            color: '#8b5cf6',
            label: 'Projets actifs',
            percent: 100 // à adapter si besoin
          },
          {
            value: stats.managersActifs?.toString() ?? '-',
            unit: '',
            color: '#f59e0b',
            label: 'Managers actifs',
            percent: 100 // à adapter si besoin
          }
        ];
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des statistiques.';
        this.loading = false;
      }
    });

    // Recommandations IA (à brancher sur un vrai endpoint si besoin)
    this.chatbotService.envoyerMessage('recommandations').subscribe({
      next: (res) => {
        this.recommandations = res.resultats ?? [];
        this.iaScore = this.recommandations.length ? Number(this.recommandations[0].score) : null;
      },
      error: () => {
        this.recommandations = [];
      }
    });
  }
}
