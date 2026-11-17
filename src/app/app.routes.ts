import { Routes } from '@angular/router';

// OneSphere-Inventory runs only inside OneSphere-Accounts (the shell): the
// shell loads ./InventoryRoutes and ./InventoryDashboard through native
// federation (see federation.config.js). This app has no login, layout,
// settings or permission logic of its own — opening it directly just shows
// the notice in app.html.
export const routes: Routes = [];
