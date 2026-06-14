import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DATE_PIPE_DEFAULT_TIMEZONE } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimations(),
    provideNativeDateAdapter(),
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'hr'],
        defaultLang: localStorage.getItem('preferredLang') || 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: DATE_PIPE_DEFAULT_TIMEZONE, useValue: 'UTC' }
  ]
};
