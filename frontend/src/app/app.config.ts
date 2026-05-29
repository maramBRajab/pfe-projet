import { ApplicationConfig } from '@angular/core';
import { PreloadAllModules, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { LOCALE_ID } from '@angular/core';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { csrfInterceptor } from './interceptors/csrf.interceptor';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled'
      })
    ),
    provideHttpClient(withInterceptors([csrfInterceptor, authInterceptor])),
    provideNoopAnimations(),
    { provide: LOCALE_ID, useValue: 'fr' }
  ]
};