import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Only used when this remote is opened directly (dev server / remoteEntry
// host). Inside OneSphere-Accounts the shell's own providers (HTTP
// interceptor, MessageService, charts, animations, ...) serve every
// Inventory screen.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
