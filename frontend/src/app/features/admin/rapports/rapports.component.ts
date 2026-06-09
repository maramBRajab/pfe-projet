import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminTopbarComponent } from '../shared/admin-topbar.component';
import {
  AdminReportsService,
  EvolutionMoisReport,
  RepartitionDept,
  SystemReport,
} from '../../../services/admin/reports.service';
import { AuthService } from '../../../services/auth';

import { KpiCardComponent } from '../../../shared/kpi-card/kpi-card.component';
@Component({
  selector: 'app-admin-rapports',
  standalone: true,
  imports: [CommonModule, DecimalPipe, KpiCardComponent, AdminSidebarComponent, AdminTopbarComponent],
  templateUrl: './rapports.component.html',
  styleUrl: './rapports.component.scss',
})
export class AdminRapportsComponent implements OnInit {
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  adminPhoto: string | null = null;
  loading = true;
  error = false;
  report: SystemReport | null = null;

  constructor(
    private readonly reportsService: AdminReportsService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.adminPhoto = this.authService.currentUser?.photoUrl ?? null;
    this.reportsService.getSystemReport().subscribe({
      next: (data) => {
        this.report = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  // ── Graphique évolution ───────────────────────────────────────────────

  get chartMaxCount(): number {
    if (!this.report?.evolutionComptes?.length) return 1;
    return Math.max(...this.report.evolutionComptes.map((m) => m.count), 1);
  }

  /** Hauteur SVG de la barre (max = 140px chart height - 20px margin) */
  barHeight(entry: EvolutionMoisReport): number {
    const max = this.chartMaxCount;
    return max === 0 ? 4 : Math.max(4, Math.round((entry.count / max) * 120));
  }

  barY(entry: EvolutionMoisReport): number {
    return 160 - this.barHeight(entry);
  }

  barValueY(entry: EvolutionMoisReport): number {
    return Math.max(10, this.barY(entry) - 6);
  }

  /** X positions for 6 bars in a 360-wide SVG */
  barX(index: number): number {
    return 20 + index * 60;
  }

  // ── Département ───────────────────────────────────────────────────────

  get maxDeptCount(): number {
    if (!this.report?.repartitionDepartement?.length) return 1;
    return Math.max(...this.report.repartitionDepartement.map((d) => d.count), 1);
  }

  deptBarWidth(dept: RepartitionDept): string {
    return ((dept.count / this.maxDeptCount) * 100).toFixed(1) + '%';
  }

  deptColor(index: number): string {
    return this.deptColorByRank(index);
  }

  // ── KPI helpers ───────────────────────────────────────────────────────


  get connexionEvolutionLabel(): string {
    if (!this.report) return '';
    const evo = this.report.connexions.evolution;
    return (evo >= 0 ? '+' : '') + evo.toFixed(0) + '%';
  }


  // ── Évolution % comptes vs mois dernier ─────────────────────────
  get comptesEvolutionPct(): number {
    if (!this.report) return 0;
    const ce = this.report.comptesCrees.ceMois;
    const md = this.report.comptesCrees.moisDernier || 0;
    if (md === 0) return ce > 0 ? 100 : 0;
    return Math.round(((ce - md) / md) * 100);
  }

  get comptesEvolutionPositive(): boolean {
    return this.comptesEvolutionPct >= 0;
  }

  // ── Couleur barre du mois (bleu, mois courant rouge) ──
  monthBarColor(index: number): string {
    if (!this.report?.evolutionComptes?.length) return '#E5E7EB';
    const last = this.report.evolutionComptes.length - 1;
    if (index === last) return '#D50032';
    return '#0066B3';
  }

  // ── Départements (rouge avec opacité décroissante par rang) ──
  deptColorByRank(index: number): string {
    const opacity = Math.max(0.2, 1 - (index * 0.2));
    return `rgba(213, 0, 50, ${opacity.toFixed(1)})`;
  }

  // ── Exports ───────────────────────────────────────────────────────────

  exporterCSV(): void {
    if (!this.report) return;
    const rows: string[][] = [
      ['Métrique', 'Valeur'],
      ['Total comptes', String(this.report.comptesCrees.total)],
      ['Comptes créés ce mois', String(this.report.comptesCrees.ceMois)],
      ['Comptes créés mois dernier', String(this.report.comptesCrees.moisDernier)],
      ['Comptes suspendus', String(this.report.comptesCrees.suspendus)],
      ['Connexions actives', String(this.report.connexions.actives)],
      ['Taux affectation global', this.report.affectation.tauxGlobal + '%'],
      ['Cible affectation', this.report.affectation.cible + '%'],
      ['Total projets', String(this.report.projets.total)],
      ['Projets en cours', String(this.report.projets.enCours)],
      ['Projets en attente', String(this.report.projets.enAttente)],
      ['Projets terminés', String(this.report.projets.termines)],
      ['Uptime plateforme', this.report.santeSysteme.uptimePlateforme + '%'],
      ['Projets en cours', this.report.santeSysteme.tauxProjetsActifs.toFixed(0) + '%'],
      ['Comptes avec compétences', this.report.santeSysteme.comptesAvecCompetences + '%'],
    ];
    const csv = rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapport-systeme.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  exporterPDF(): void {
    window.print();
  }

  exporterChartSVG(): void {
    const svg = document.querySelector('.sp-bar-chart svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphique-utilisateurs.svg';
    a.click();
    URL.revokeObjectURL(url);
  }
}
