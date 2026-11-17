import { Component } from '@angular/core';

/**
 * Root component for opening this remote directly. OneSphere-Inventory is
 * served to users only through OneSphere-Accounts (the shell), which loads
 * the exposed Inventory routes; this just points anyone landing here to it.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.html'
})
export class App {}
