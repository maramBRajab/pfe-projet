import { AfterViewInit, Directive, HostListener } from '@angular/core';
import { activateRevealElements } from './reveal.utils';

@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true
})
export class RevealOnScrollDirective implements AfterViewInit {
  ngAfterViewInit(): void {
    setTimeout(() => activateRevealElements());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    activateRevealElements();
  }
}