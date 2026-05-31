import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';

import { AdminSidebarComponent } from '../shared/admin-sidebar.component';
import { AdminProjetService, Projet } from '../../../services/admin';
import { AffectationService, Affectation } from '../../../services/manager';

@Component({
  selector: 'app-admin-rapports',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './rapports.component.html',
  styleUrl: './rapports.component.scss'
})
export class AdminRapportsComponent implements OnInit {
  currentDate = new Date();
  loading = true;
  adminPhoto: string | null = null;

  projets: Projet[] = [];
  affectations: Affectation[] = [];

  constructor(
    private readonly projetService: AdminProjetService,
    private readonly affectationService: AffectationService
  ) {}

  ngOnInit(): void {
    this.adminPhoto = localStorage.getItem('smartassign_admin_photo');
    forkJoin({
      projets:      this.projetService.getAll().pipe(catchError(() => of([]))),
      affectations: this.affectationService.getAll().pipe(catchError(() => of([])))
    }).subscribe(({ projets, affectations }) => {
      this.projets      = projets;
      this.affectations = affectations;
      this.loading      = false;
    });
  }

  get scoreMoyen(): number {
    if (!this.affectations.length) return 0;
    return Math.round(
      this.affectations.reduce((s, a) => s + a.score, 0) / this.affectations.length
    );
  }

  statutLabel(statut: string): string {
    switch (statut.toLowerCase()) {
      case 'en_cours':   return 'En cours';
      case 'en_attente': return 'En attente';
      case 'termine':    return 'Terminé';
      default:           return statut;
    }
  }

  statutTone(statut: string): string {
    switch (statut.toLowerCase()) {
      case 'en_cours':   return 'success';
      case 'en_attente': return 'warning';
      case 'termine':    return 'neutral';
      default:           return 'neutral';
    }
  }

  taux(p: Projet): number {
    if (!p.dateDebut || !p.dateFin) return 0;
    const start = new Date(p.dateDebut).getTime();
    const end   = new Date(p.dateFin).getTime();
    const now   = Date.now();
    if (now >= end)   return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  exporterCSV(): void {
    const headers = ['Projet', 'Statut', 'Date début', 'Date fin', 'Avancement'];
    const rows = this.projets.map(p => [
      p.nom,
      this.statutLabel(p.statut),
      p.dateDebut ?? '',
      p.dateFin ?? '',
      this.taux(p) + '%'
    ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rapports.csv'; a.click();
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
    a.href = url; a.download = 'graphique-utilisateurs.svg'; a.click();
    URL.revokeObjectURL(url);
  }
}
