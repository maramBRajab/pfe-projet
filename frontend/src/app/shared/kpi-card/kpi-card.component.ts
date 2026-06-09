import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type KpiCardTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() subtitle = '';
  @Input() badge: string | number = '';
  @Input() icon = '';
  @Input() tone: KpiCardTone = 'neutral';
  @Input() valueTone: KpiCardTone | '' = '';
  @Input() link: string | unknown[] | null = null;
  @Input() queryParams: Record<string, unknown> | null = null;

  get resolvedValueTone(): KpiCardTone {
    return (this.valueTone || this.tone || 'neutral') as KpiCardTone;
  }
}
