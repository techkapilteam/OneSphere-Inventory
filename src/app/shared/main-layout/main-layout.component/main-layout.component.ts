import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { NavigationEnd, NavigationError, Router, RouterModule } from '@angular/router';
import {
  Module,
  NavigationService,
  NavigationPath,
  SubModule,
  Screen
} from '../../../core/services/Navigation/navigation.service';
import { AuthService, LoginTenantOption } from '../../../core/services/auth.service';
import { filter, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SosHelpComponent } from '../../sos-help/sos-help.component';
import { VoiceAssistantComponent } from '../../voice-assistant/voice-assistant.component';
import { WalkthroughTourComponent } from '../../walkthrough-tour/walkthrough-tour.component';
import { WalkthroughTourService } from '../../walkthrough-tour/walkthrough-tour.service';
import { CompanyDetailsService } from '../../../core/services/Common/company-details-service';

export interface Theme {
  id: string;
  name: string;
  colors: [string, string];
}

export interface RecentForm {
  name: string;
  route: string;
  moduleId: string;
  moduleName: string;
  subModuleId: string;
  subModuleName: string;
  screenId: string;
  icon: string;
  time: Date;
}

interface FlyoutScreenGroup {
  name: string;
  screens: Screen[];
}

interface SwitchLocationOption {
  key: string;
  label: string;
  type: 'warehouse' | 'branch';
  id: number;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NgSelectModule, SosHelpComponent, VoiceAssistantComponent, WalkthroughTourComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent implements OnInit, AfterViewInit {
  @ViewChild('moduleScroller') private moduleScroller?: ElementRef<HTMLElement>;
  @ViewChild('contentArea') private contentArea?: ElementRef<HTMLElement>;

  modules: Module[] = [];
  selectedModule: Module | null = null;
  selectedSubModule: SubModule | null = null;
  selectedScreen: Screen | null = null;

  sidebarCollapsed = true;
  navbarCollapsed = false;
  username = '';
  tenantOptions: LoginTenantOption[] = [];
  selectedSwitchCompanyId: number | null = null;
  selectedSwitchBranchId: number | null = null;
  // Independent selection state for the merged control. Warehouses carry a
  // linked branchId, but are still listed from their own warehouse access list.
  selectedSwitchWarehouseId: number | null = null;
  private mergedSwitchLocationOptionsCache: SwitchLocationOption[] = [];
  private mergedSwitchLocationOptionsCacheKey = '';
  switchingContext = false;
  switchMessage = '';
  switchError = '';
  showProfilePassword = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordSaving = false;
  passwordMessage = '';
  passwordError = '';
  expandedSubModules: Set<string> = new Set<string>();
  expandedFlyoutGroups: Set<string> = new Set<string>();
  private readonly enabledManufacturingTransactionIds = new Set([
    'bom-master',
    'work-center-master',
    'production-planning',
    'material-issue-production',
    'production-entry',
    'production-return'
  ]);
  private readonly enabledManufacturingScreenCompactKeys = new Set([
    'bommaster',
    'workcentermaster',
    'productionplanning',
    'materialissueproduction',
    'productionentry',
    'productionreturn',
    'invmbom',
    'invmworkcenter'
  ]);

  // Snapshot of the path for the currently active screen
  breadcrumbPath = {
    module: null as Module | null,
    subModule: null as SubModule | null,
    screen: null as Screen | null
  };

  showMegaMenu = false;
  showAvatarMenu = false;
  showRecentForms = false;
  showFlyoutSearch = false;
  showThemeDropdown = false;
  showModuleScrollLeft = false;
  showModuleScrollRight = false;

  flyoutSearchQuery = '';
  megaMenuSearch = '';
  activeTheme = 'sky';

  recentForms: RecentForm[] = [];

  themes: Theme[] = [
    { id: 'sky', name: 'Sky', colors: ['#7fb3ff', '#4d8fff'] },
    { id: 'mist', name: 'Mist', colors: ['#b8d7ff', '#7aaeff'] },
    { id: 'royal', name: 'Royal', colors: ['#6f8cff', '#5175ff'] },
    { id: 'emerald', name: 'Emerald', colors: ['#76d5c7', '#4fb8a8'] },
    { id: 'slate', name: 'Slate', colors: ['#aab8d6', '#7d8fb3'] },
    { id: 'gold', name: 'Gold', colors: ['#f0cf6a', '#c9a227'] },
    { id: 'copper', name: 'Copper', colors: ['#d9996b', '#a85f3a'] },
    { id: 'pink', name: 'Pink', colors: ['#f7a9c4', '#e26aa5'] },
    { id: 'dark', name: 'Dark', colors: ['#2a3050', '#0d1117'] }
  ];

  constructor(
    private navigationService: NavigationService,
    private authService: AuthService,
    private router: Router,
    private destroyRef: DestroyRef,
    private tourService: WalkthroughTourService,
    private companyDetailsService: CompanyDetailsService
  ) {}

  startTour(): void {
    this.tourService.start();
  }

  ngOnInit(): void {
    this.modules = this.navigationService.getModules();
    this.username = this.authService.getUsername() || 'User';
    this.loadTenantSwitchOptions();
    this.refreshTenantOptionsFromServer();

    const savedTheme = localStorage.getItem('erp-theme');
    this.setTheme(savedTheme || this.activeTheme);

    const savedSidebarState = localStorage.getItem('sidebar-collapsed');
    if (savedSidebarState !== null) {
      this.sidebarCollapsed = JSON.parse(savedSidebarState);
    }

    this.navigationService.selectedModule$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((module: Module | null) => {
        this.selectedModule = module;
        this.queueModuleScrollStateUpdate(true);
      });

    this.navigationService.selectedSubModule$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((subModule: SubModule | null) => {
        this.selectedSubModule = subModule;
        this.initializeFlyoutGroups(subModule);
      });

    this.navigationService.selectedScreen$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((screen: Screen | null) => {
        this.selectedScreen = screen;
        
        // Only update breadcrumb when a screen is actually active
        if (screen) {
          this.breadcrumbPath = {
            module: this.selectedModule,
            subModule: this.selectedSubModule,
            screen: screen
          };
        }
      });

    this.restoreNavigationFromRoute(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        this.restoreNavigationFromRoute(event.urlAfterRedirects);
        this.contentArea?.nativeElement.scrollTo({ top: 0 });
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationError => event instanceof NavigationError),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        console.error('Navigation failed:', event.error);
        // Chunk load failure (lazy module not found on server) — navigate back to dashboard root
        if (event.error?.name === 'ChunkLoadError' || String(event.error).includes('Loading chunk')) {
          this.router.navigate(['/dashboard']);
        }
      });

    // Set General Receipt as default selection
    // this.setDefaultSelection();
  }

  ngAfterViewInit(): void {
    this.queueModuleScrollStateUpdate(true);
  }

  private setDefaultSelection(): void {
    // Find Accounts module
    const accountsModule = this.modules.find(m => m.id === 'accounts');
    if (!accountsModule) return;

    // Find Accounts Transactions sub-module
    const transactionsSubModule = accountsModule.subModules.find(
      s => s.id === 'accounts-transactions'
    );
    if (!transactionsSubModule) return;

    // Find General Receipt screen
    const generalReceiptScreen = transactionsSubModule.screens.find(
      s => s.id === 'general-receipt'
    );
    if (!generalReceiptScreen) return;

    // Select module, sub-module, and screen
    this.navigationService.selectModule(accountsModule);
    this.navigationService.selectSubModule(transactionsSubModule);
    this.navigationService.selectScreen(generalReceiptScreen);

    // Expand the sub-module in the sidebar
    this.expandedSubModules.add(transactionsSubModule.id);

    // Navigate to the General Receipt route
    this.router.navigate([generalReceiptScreen.route]);
  }

  setTheme(themeId: string): void {
    this.activeTheme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('erp-theme', themeId);
  }

  getActiveThemeName(): string {
    return this.themes.find(theme => theme.id === this.activeTheme)?.name || 'Sky';
  }

  selectModule(module: Module, event?: Event): void {
    sessionStorage.setItem('moduleName', module.id);
    this.scrollModuleTabIntoView(event);

    this.closeFlyoutSearch();

    if (this.selectedModule?.id !== module.id) {
      this.navigationService.selectModule(module);
    }

    this.openFirstPageOfModule(module);
    this.sidebarCollapsed = false;
    this.saveSidebarState();
  }

  get currentCompanyLabel(): string {
    const currentCompanyId = Number(sessionStorage.getItem('companyId') || 0);
    const option = this.tenantOptions.find(item => item.companyId === currentCompanyId);
    const storedCompany = this.readSessionJson<{ companyCode?: string; companyName?: string }>('authCompany', {});
    const companyName = option?.companyName || storedCompany.companyName || '';
    const companyCode = option?.companyCode || storedCompany.companyCode || sessionStorage.getItem('companyCode') || '';

    return this.formatContextLabel(companyName, companyCode, 'Company');
  }

  get currentBranchLabel(): string {
    const currentBranchId = Number(sessionStorage.getItem('branchId') || 0);
    const branch = this.tenantOptions
      .flatMap(option => option.branches || [])
      .find(item => item.id === currentBranchId)
      ?? this.readSessionJson<Array<{ id?: number; branchCode?: string; branchName?: string }>>('authBranches', [])
        .find(item => Number(item.id) === currentBranchId);
    const branchName = branch?.branchName || '';
    const branchCode = branch?.branchCode || sessionStorage.getItem('branchCode') || '';

    return this.formatContextLabel(branchName, branchCode, 'No branch');
  }

  get currentWarehouseLabel(): string {
    const currentWarehouseId = Number(sessionStorage.getItem('warehouseId') || 0);
    const warehouse = this.tenantOptions
      .flatMap(option => option.warehouses || [])
      .find(item => item.id === currentWarehouseId);
    const warehouseName = warehouse?.warehouseName || sessionStorage.getItem('warehouseName') || '';
    const warehouseCode = warehouse?.warehouseCode || sessionStorage.getItem('warehouseCode') || '';

    return this.formatContextLabel(warehouseName, warehouseCode, 'No warehouse');
  }

  get currentLocationLabel(): string {
    return this.currentActiveLocationKind() === 'warehouse'
      ? this.currentWarehouseLabel
      : this.currentBranchLabel;
  }

  get selectedSwitchBranches() {
    return this.tenantOptions.find(option => option.companyId === this.selectedSwitchCompanyId)?.branches ?? [];
  }

  get selectedSwitchWarehouses() {
    return this.tenantOptions.find(option => option.companyId === this.selectedSwitchCompanyId)?.warehouses ?? [];
  }

  // ── Merged Branch/Warehouse selector (Phase 3) ──────────────────────
  // Kept byte-identical in structure to the Accounts copy of this component
  // (these two files are hand-duplicated, not federation-shared — see the
  // project's documented drift history). Same pattern as
  // login.component.ts's mergedLoginLocationOptions — one combined,
  // type-tagged option list (warehouses first, then branches) so the
  // template can render the shared "WH" badge (.inventory-location-badge)
  // on warehouse entries only. The bound value is a composite `type:id` key
  // since branch ids and warehouse ids are independent numeric spaces.
  // The picker keeps one explicit active location, so choosing a branch
  // clears the selected warehouse and choosing a warehouse clears the
  // selected branch.
  get mergedSwitchLocationOptions(): SwitchLocationOption[] {
    const warehouses = this.selectedSwitchWarehouses;
    const branches = this.selectedSwitchBranches;
    const cacheKey = [
      this.selectedSwitchCompanyId ?? '',
      ...warehouses.map(w => `w:${w.id}:${w.warehouseName}:${w.warehouseCode}`),
      ...branches.map(b => `b:${b.id}:${b.branchName}:${b.branchCode}`)
    ].join('|');

    if (cacheKey === this.mergedSwitchLocationOptionsCacheKey) {
      return this.mergedSwitchLocationOptionsCache;
    }

    this.mergedSwitchLocationOptionsCacheKey = cacheKey;
    this.mergedSwitchLocationOptionsCache = [
      ...warehouses.map(w => ({
        key: `warehouse:${w.id}`,
        label: `${w.warehouseName} (${w.warehouseCode})`,
        type: 'warehouse' as const,
        id: w.id,
      })),
      ...branches.map(b => ({
        key: `branch:${b.id}`,
        label: `${b.branchName} (${b.branchCode})`,
        type: 'branch' as const,
        id: b.id,
      }))
    ];

    return this.mergedSwitchLocationOptionsCache;
  }

  // Which type was most recently explicitly picked in the merged control —
  // used to decide which active location the single control displays and
  // which context kind should be stamped after a successful switch.
  private lastPickedSwitchLocationType: 'branch' | 'warehouse' | null = null;

  get selectedSwitchLocationKey(): string | null {
    const branchId = this.selectedSwitchBranchId;
    const warehouseId = this.selectedSwitchWarehouseId;
    if (this.lastPickedSwitchLocationType === 'warehouse' && warehouseId != null) return `warehouse:${warehouseId}`;
    if (this.lastPickedSwitchLocationType === 'branch' && branchId != null) return `branch:${branchId}`;
    if (branchId != null) return `branch:${branchId}`;
    if (warehouseId != null) return `warehouse:${warehouseId}`;
    return null;
  }

  onSwitchLocationChange(key: string | number | null): void {
    if (key === null || key === undefined) return;
    const [type, idPart] = String(key).split(':');
    const id = Number(idPart) || null;
    if (type === 'warehouse') {
      this.selectedSwitchWarehouseId = id;
      this.selectedSwitchBranchId = null;
      this.lastPickedSwitchLocationType = 'warehouse';
    } else if (type === 'branch') {
      this.selectedSwitchBranchId = id;
      this.selectedSwitchWarehouseId = null;
      this.lastPickedSwitchLocationType = 'branch';
    }
  }

  onSwitchLocationPicked(item: SwitchLocationOption | string | number | null): void {
    if (item && typeof item === 'object') {
      this.onSwitchLocationChange(item.key);
      return;
    }

    this.onSwitchLocationChange(item);
  }

  get currentWarehouseIdValue(): number {
    return Number(sessionStorage.getItem('warehouseId') || 0);
  }

  get hasSwitchContextOptions(): boolean {
    if (this.tenantOptions.length > 1) return true;
    return (this.tenantOptions[0]?.branches?.length ?? 0) > 1;
  }

  get hasMultipleCompanies(): boolean {
    return this.tenantOptions.length > 1;
  }

  get currentBranchIdValue(): number {
    return Number(sessionStorage.getItem('branchId') || 0);
  }

  get currentCompanyBranches(): LoginTenantOption['branches'] {
    const companyId = Number(sessionStorage.getItem('companyId') || 0);
    return this.tenantOptions.find(o => o.companyId === companyId)?.branches ?? [];
  }

  get hasMultipleBranches(): boolean {
    return this.currentCompanyBranches.length > 1;
  }

  get isContextChanged(): boolean {
    const currentCompanyId = Number(sessionStorage.getItem('companyId') || 0);
    const currentBranchId = Number(sessionStorage.getItem('branchId') || 0);
    const currentWarehouseId = Number(sessionStorage.getItem('warehouseId') || 0);
    if (this.selectedSwitchCompanyId !== currentCompanyId) return true;

    const currentLocationKind = this.currentActiveLocationKind();
    if (this.lastPickedSwitchLocationType === 'warehouse') {
      return currentLocationKind !== 'warehouse'
        || (!!this.selectedSwitchWarehouseId && this.selectedSwitchWarehouseId !== currentWarehouseId);
    }
    if (this.lastPickedSwitchLocationType === 'branch') {
      return currentLocationKind !== 'branch'
        || (!!this.selectedSwitchBranchId && this.selectedSwitchBranchId !== currentBranchId);
    }

    return (!!this.selectedSwitchBranchId && this.selectedSwitchBranchId !== currentBranchId)
      || (!!this.selectedSwitchWarehouseId && this.selectedSwitchWarehouseId !== currentWarehouseId);
  }

  loadTenantSwitchOptions(): void {
    const currentCompanyId = Number(sessionStorage.getItem('companyId') || 0);
    const currentBranchId = Number(sessionStorage.getItem('branchId') || 0);
    const currentWarehouseId = Number(sessionStorage.getItem('warehouseId') || 0);
    const authBranches = this.readSessionJson<Array<{ id: number; branchCode: string; branchName: string; isDefault?: boolean }>>('authBranches', []);

    let options = this.normalizeTenantSwitchOptions(this.authService.getTenantOptions());

    if (!options.length) {
      // No stored tenant options — synthesize from any available session data
      const company = this.readSessionJson<{ id?: number; companyCode?: string; companyName?: string }>('authCompany', {});
      const companyDetails = this.readSessionJson<{ companyId?: number; companyCode?: string; companyName?: string }>('CompanyDetails', {});
      const companyId = company.id || companyDetails.companyId || currentCompanyId;
      if (companyId) {
        options = [{
          userId: Number(sessionStorage.getItem('userId') || 0),
          companyId,
          companyCode: company.companyCode || companyDetails.companyCode || sessionStorage.getItem('companyCode') || '',
          companyName: company.companyName || companyDetails.companyName || '',
          username: sessionStorage.getItem('username') || '',
          fullName: sessionStorage.getItem('username') || '',
          branches: authBranches.map(b => ({ ...b, isDefault: !!b.isDefault }))
        }];
      }
    } else if (authBranches.length > 0 && currentCompanyId) {
      // Tenant options exist but may only have 1 branch per company (from login selection).
      // Merge authBranches (full branch list from login) into the current company entry.
      const currentOpt = options.find(o => o.companyId === currentCompanyId);
      if (currentOpt && authBranches.length > currentOpt.branches.length) {
        currentOpt.branches = this.uniqueSwitchBranches([
          ...currentOpt.branches,
          ...authBranches.map(b => ({ ...b, isDefault: !!b.isDefault }))
        ]);
      }
    }

    this.tenantOptions = options;
    this.selectedSwitchCompanyId = currentCompanyId || (this.tenantOptions[0]?.companyId ?? null);
    const branches = this.selectedSwitchBranches;
    const currentLocationKind = this.currentActiveLocationKind();
    this.selectedSwitchBranchId = currentBranchId || branches.find(branch => branch.isDefault)?.id || branches[0]?.id || null;
    const warehouses = this.selectedSwitchWarehouses;
    const defaultWarehouseId = warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || null;
    this.selectedSwitchWarehouseId = currentLocationKind === 'warehouse'
      ? currentWarehouseId || defaultWarehouseId
      : this.selectedSwitchBranchId
        ? null
        : currentWarehouseId || defaultWarehouseId;
    this.lastPickedSwitchLocationType = currentLocationKind === 'warehouse' && this.selectedSwitchWarehouseId
      ? 'warehouse'
      : this.selectedSwitchBranchId
        ? 'branch'
        : this.selectedSwitchWarehouseId
          ? 'warehouse'
          : null;
  }

  private refreshTenantOptionsFromServer(): void {
    this.authService.me().subscribe({
      next: res => {
        const payload = res?.data;
        if (!payload) return;

        let updated = false;

        // Always use server's tenant options — they are the authoritative list
        if (payload.tenantOptions && payload.tenantOptions.length > 0) {
          sessionStorage.setItem('authTenantOptions', JSON.stringify(payload.tenantOptions));
          updated = true;
        }

        // Backfill company data for legacy/old sessions that lack authCompany or companyId
        if (payload.company?.id) {
          if (!sessionStorage.getItem('companyId') || sessionStorage.getItem('companyId') === '0') {
            sessionStorage.setItem('companyId', String(payload.company.id));
            updated = true;
          }
          const existingCompany = this.readSessionJson<{ id?: number }>('authCompany', {});
          if (!existingCompany.id) {
            sessionStorage.setItem('authCompany', JSON.stringify(payload.company));
            updated = true;
          }
        }

        // Update branches when server knows about more branches for the current company
        if (payload.branches && payload.branches.length > this.currentCompanyBranches.length) {
          sessionStorage.setItem('authBranches', JSON.stringify(payload.branches));
          updated = true;
        }

        if (updated) this.loadTenantSwitchOptions();
      },
      error: () => undefined
    });
  }

  trackTenantOption(_: number, option: LoginTenantOption): number {
    return option.companyId;
  }

  trackSwitchBranch(_: number, branch: LoginTenantOption['branches'][number]): number {
    return branch.id;
  }

  trackSwitchWarehouse(_: number, warehouse: NonNullable<LoginTenantOption['warehouses']>[number]): number {
    return warehouse.id;
  }

  trackSwitchLocation(option: SwitchLocationOption): string {
    return option.key;
  }

  toggleAvatarMenu(): void {
    this.showAvatarMenu = !this.showAvatarMenu;
    this.showMegaMenu = false;
    this.showRecentForms = false;
    if (this.showAvatarMenu) {
      this.username = this.authService.getUsername() || this.username || 'User';
      this.loadTenantSwitchOptions();
    }
  }

  toggleProfilePassword(): void {
    this.showProfilePassword = !this.showProfilePassword;
    this.passwordMessage = '';
    this.passwordError = '';
    if (!this.showProfilePassword) {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  async saveProfilePassword(): Promise<void> {
    this.passwordMessage = '';
    this.passwordError = '';
    if (this.newPassword.trim().length < 8) {
      this.passwordError = 'Password must be at least 8 characters.';
      return;
    }
    if (this.newPassword.trim() !== this.confirmPassword.trim()) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }

    this.passwordSaving = true;
    try {
      const response = await firstValueFrom(
        this.authService.setMyPassword(this.currentPassword.trim() || null, this.newPassword.trim())
      );
      this.passwordMessage = response?.message || 'Password updated.';
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: unknown) {
      const value = err as { error?: { message?: string }; message?: string };
      this.passwordError = value.error?.message ?? value.message ?? 'Unable to update password.';
    } finally {
      this.passwordSaving = false;
    }
  }

  onSwitchCompanyChange(companyId: number | string): void {
    this.selectedSwitchCompanyId = Number(companyId) || null;
    const branches = this.selectedSwitchBranches;
    const branchId = branches.find(branch => branch.isDefault)?.id || branches[0]?.id || null;
    this.selectedSwitchBranchId = branchId;
    const warehouses = this.selectedSwitchWarehouses;
    this.selectedSwitchWarehouseId = branchId ? null : warehouses.find(w => w.isDefault)?.id || warehouses[0]?.id || null;
    // Fresh company → show ITS default in the merged control, not whichever
    // type the user happened to last pick for a previous company.
    this.lastPickedSwitchLocationType = null;
  }

  onSwitchWarehouseChange(warehouseId: number | string): void {
    this.selectedSwitchWarehouseId = Number(warehouseId) || null;
    this.selectedSwitchBranchId = null;
    this.lastPickedSwitchLocationType = 'warehouse';
  }

  async applyTenantSwitch(): Promise<void> {
    if (!this.selectedSwitchCompanyId) return;
    // Only one location is explicit. Branch selection sends branchId only;
    // warehouse selection sends warehouseId only and the backend derives its
    // linked branch for legacy BranchCode lookups.
    const hasLocationOptions = this.selectedSwitchBranches.length > 0 || this.selectedSwitchWarehouses.length > 0;
    if (hasLocationOptions && !this.selectedSwitchBranchId && !this.selectedSwitchWarehouseId) {
      this.switchError = 'Please select a branch or warehouse.';
      return;
    }
    this.switchingContext = true;
    this.switchMessage = '';
    this.switchError = '';
    try {
      const currentCompanyId = Number(sessionStorage.getItem('companyId') || 0);
      const selectedLocationKind = this.selectedSwitchActiveLocationKind();
      const selectedBranchId = selectedLocationKind === 'branch' ? this.selectedSwitchBranchId || null : null;
      const selectedWarehouseId = selectedLocationKind === 'warehouse' ? this.selectedSwitchWarehouseId || null : null;
      const response = this.selectedSwitchCompanyId === currentCompanyId && selectedBranchId
        ? await firstValueFrom(this.authService.switchBranch(selectedBranchId, selectedWarehouseId))
        : await firstValueFrom(this.authService.switchCompany(this.selectedSwitchCompanyId, selectedBranchId, selectedWarehouseId));
      if (response?.data) {
        this.preserveTenantOptions(response.data);
        this.authService.setMultiTenantSession(response.data);
        // Record which of Branch/Warehouse was the user's actual merged-picker
        // pick so currentLocationLabel can show it after the reload below --
        // sessionStorage['branchId']/['warehouseId'] alone can't disambiguate
        // this once a warehouse session carries both derived branch and warehouse ids.
        sessionStorage.setItem('activeLocationKind', selectedLocationKind);
        await this.refreshLegacyCompanyDetails();
        this.modules = this.navigationService.getModules();
        this.selectedModule = null;
        this.selectedSubModule = null;
        this.selectedScreen = null;
        this.username = this.authService.getUsername() || this.username;
        this.loadTenantSwitchOptions();
        this.switchMessage = 'Company context switched.';
        this.showAvatarMenu = false;
        // Full reload, not router.navigate — navigating to the same URL the user
        // is already on (e.g. switching while sitting on /dashboard) is a no-op
        // under Angular's default route reuse strategy, so every already-mounted
        // screen (dashboard, reports, any Inventory/HRMS federated remote) would
        // keep showing data fetched under the OLD company/branch context even
        // though the token and session storage are already updated above.
        // Kept in sync with OneSphere-Accounts' copy of this method.
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      const value = err as { error?: { message?: string; title?: string }; message?: string };
      this.switchError = value.error?.message ?? value.error?.title ?? value.message ?? 'Unable to switch company context.';
    } finally {
      this.switchingContext = false;
    }
  }

  async switchBranchDirectly(branchId: number): Promise<void> {
    if (branchId === this.currentBranchIdValue || this.switchingContext) return;
    this.selectedSwitchBranchId = branchId;
    this.switchingContext = true;
    this.switchMessage = '';
    this.switchError = '';
    try {
      const response = await firstValueFrom(this.authService.switchBranch(branchId, null));
      if (response?.data) {
        this.preserveTenantOptions(response.data);
        this.authService.setMultiTenantSession(response.data);
        // This quick-switch always explicitly picks a Branch (see comment above).
        sessionStorage.setItem('activeLocationKind', 'branch');
        await this.refreshLegacyCompanyDetails();
        this.modules = this.navigationService.getModules();
        this.selectedModule = null;
        this.selectedSubModule = null;
        this.selectedScreen = null;
        this.username = this.authService.getUsername() || this.username;
        this.loadTenantSwitchOptions();
        this.showAvatarMenu = false;
        // Full reload — same route-reuse staleness reasoning as applyTenantSwitch() above.
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      const value = err as { error?: { message?: string; title?: string }; message?: string };
      this.switchError = value.error?.message ?? value.error?.title ?? value.message ?? 'Unable to switch branch.';
    } finally {
      this.switchingContext = false;
    }
  }

  private preserveTenantOptions(incomingPayload: { tenantOptions?: LoginTenantOption[] }): void {
    if (!incomingPayload.tenantOptions?.length) {
      const existing = this.authService.getTenantOptions();
      if (existing.length) incomingPayload.tenantOptions = existing;
    }
  }

  private async refreshLegacyCompanyDetails(): Promise<void> {
    try {
      const details = await firstValueFrom(this.companyDetailsService.GetCompanyData());
      if (Array.isArray(details) && details.length) {
        sessionStorage.setItem('CompanyDetails', JSON.stringify(details[0]));
      }
    } catch {
      // AuthService already wrote a minimal CompanyDetails fallback for screens that read legacy session data.
    }
  }

  private normalizeTenantSwitchOptions(options: LoginTenantOption[]): LoginTenantOption[] {
    const byCompany = new Map<number, LoginTenantOption>();

    for (const option of options || []) {
      const companyId = Number(option.companyId) || 0;
      if (!companyId) continue;

      const branches = this.uniqueSwitchBranches(option.branches || []);
      const warehouses = this.uniqueSwitchWarehouses(option.warehouses || []);
      const existing = byCompany.get(companyId);
      if (!existing) {
        byCompany.set(companyId, { ...option, companyId, branches, warehouses });
        continue;
      }

      existing.branches = this.uniqueSwitchBranches([
        ...(existing.branches || []),
        ...branches
      ]);
      existing.warehouses = this.uniqueSwitchWarehouses([
        ...(existing.warehouses || []),
        ...(warehouses || [])
      ]);
    }

    return Array.from(byCompany.values()).sort((a, b) =>
      (a.companyName || '').localeCompare(b.companyName || '')
    );
  }

  private uniqueSwitchBranches(branches: LoginTenantOption['branches']): LoginTenantOption['branches'] {
    const byBranch = new Map<number, LoginTenantOption['branches'][number]>();

    for (const branch of branches || []) {
      const branchId = Number(branch.id) || 0;
      if (!branchId || byBranch.has(branchId)) continue;
      byBranch.set(branchId, branch);
    }

    return Array.from(byBranch.values()).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return (a.branchName || '').localeCompare(b.branchName || '');
    });
  }

  private uniqueSwitchWarehouses(warehouses: LoginTenantOption['warehouses']): LoginTenantOption['warehouses'] {
    const byWarehouse = new Map<number, NonNullable<LoginTenantOption['warehouses']>[number]>();

    for (const warehouse of warehouses || []) {
      const warehouseId = Number(warehouse.id) || 0;
      if (!warehouseId || byWarehouse.has(warehouseId)) continue;
      byWarehouse.set(warehouseId, warehouse);
    }

    return Array.from(byWarehouse.values()).sort((a, b) => {
      if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
      return (a.warehouseName || '').localeCompare(b.warehouseName || '');
    });
  }

  private formatContextLabel(name: string, code: string, fallback: string): string {
    const cleanName = (name || '').trim();
    const cleanCode = (code || '').trim();
    if (cleanName && cleanCode && cleanName.toLowerCase() !== cleanCode.toLowerCase()) {
      return `${cleanName} (${cleanCode})`;
    }

    return cleanName || cleanCode || fallback;
  }

  private readSessionJson<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(sessionStorage.getItem(key) || '') as T;
    } catch {
      return fallback;
    }
  }

  private currentActiveLocationKind(): 'branch' | 'warehouse' {
    return sessionStorage.getItem('activeLocationKind') === 'warehouse' ? 'warehouse' : 'branch';
  }

  private selectedSwitchActiveLocationKind(): 'branch' | 'warehouse' {
    if (this.lastPickedSwitchLocationType === 'warehouse' && this.selectedSwitchWarehouseId) return 'warehouse';
    if (this.lastPickedSwitchLocationType === 'branch' && this.selectedSwitchBranchId) return 'branch';
    return this.selectedSwitchWarehouseId && !this.selectedSwitchBranchId ? 'warehouse' : 'branch';
  }

  private openFirstPageOfModule(module: Module): void {
    this.expandedSubModules.clear();

    const firstSubModule = module.subModules[0];
    if (!firstSubModule) {
      this.selectedSubModule = null;
      return;
    }

    if (this.hasFlyoutItems(firstSubModule)) {
      this.expandedSubModules.add(firstSubModule.id);
    }

    this.navigationService.selectSubModule(firstSubModule);

    const firstScreen = firstSubModule.screens[0];
    if (firstScreen) {
      this.selectScreen(firstScreen);
    }
  }

  toggleSubModule(subModule: SubModule): void {
    if (!this.hasFlyoutItems(subModule)) {
      this.openSingleScreenSubModule(subModule);
      return;
    }

    if (this.sidebarCollapsed) {
      this.sidebarCollapsed = false;
      this.saveSidebarState();
    }

    if (this.expandedSubModules.has(subModule.id)) {
      this.expandedSubModules.delete(subModule.id);

      this.closeFlyoutSearch();
      return;
    }

    this.expandedSubModules.clear();
    this.expandedSubModules.add(subModule.id);
    this.navigationService.selectSubModule(subModule);
    this.initializeFlyoutGroups(subModule);
    this.closeFlyoutSearch();
  }

  hasFlyoutItems(subModule?: SubModule | null): boolean {
    return (subModule?.screens?.length ?? 0) > 1;
  }

  private openSingleScreenSubModule(subModule: SubModule): void {
    if (this.sidebarCollapsed) {
      this.sidebarCollapsed = false;
      this.saveSidebarState();
    }

    this.expandedSubModules.clear();
    this.navigationService.selectSubModule(subModule);
    this.initializeFlyoutGroups(subModule);
    this.closeFlyoutSearch();

    const firstScreen = subModule.screens[0];
    if (firstScreen) {
      this.selectScreen(firstScreen);
    }
  }

  isSubModuleExpanded(subModuleId: string): boolean {
    return this.expandedSubModules.has(subModuleId);
  }

  isScreenDisabled(screen?: Screen | null): boolean {
    return !!screen?.disabled && !this.isEnabledManufacturingScreen(screen);
  }

  private isEnabledManufacturingScreen(screen?: Screen | null): boolean {
    if (!screen) return false;

    const routeTail = this.getRouteTail(screen.route);
    const identityValues = [
      screen.id,
      screen.name,
      screen.route,
      routeTail,
      ...(screen.relatedRoutes || []),
      ...(screen.relatedRoutes || []).map(route => this.getRouteTail(route))
    ];

    return identityValues.some(value => {
      const normalized = this.normalizeScreenKey(value);
      return this.enabledManufacturingTransactionIds.has(normalized)
        || this.enabledManufacturingScreenCompactKeys.has(this.compactScreenKey(normalized));
    });
  }

  private normalizeScreenKey(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private compactScreenKey(value?: string | null): string {
    return this.normalizeScreenKey(value).replace(/[^a-z0-9]/g, '');
  }

  private getRouteTail(route?: string | null): string {
    return String(route || '').split('/').filter(Boolean).pop() || '';
  }

  selectScreen(screen: Screen): void {
    this.navigationService.selectScreen(screen);
    if (this.selectedSubModule) {
      this.expandActiveFlyoutGroup(this.selectedSubModule, screen);
    }
    this.router.navigate([screen.route]);
    this.addToRecent(screen);
    this.showMegaMenu = false;
    this.showRecentForms = false;
    this.closeFlyoutSearch();
    
    // Ensure sidebar is expanded to show where we are
    this.sidebarCollapsed = false;
    this.saveSidebarState();
  }

  toggleNavbar(): void {
    if (!this.navbarCollapsed) {
      this.closeAllPanels();
    }
    this.navbarCollapsed = !this.navbarCollapsed;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.saveSidebarState();

    if (this.sidebarCollapsed) {
      this.expandedSubModules.clear();
      this.closeFlyoutSearch();
    } else if (!this.selectedModule && this.modules.length > 0) {
      this.navigationService.selectModule(this.modules[0]);
    }
  }

  private saveSidebarState(): void {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(this.sidebarCollapsed));
  }

  showSidebarFromEdge(): void {
    if (!this.canUseHoverSidebar()) return;

    if (!this.selectedModule && this.modules.length > 0) {
      this.navigationService.selectModule(this.modules[0]);
    }

    this.sidebarCollapsed = false;
  }

  hideSidebarForWorkspace(): void {
    if (!this.canUseHoverSidebar() || this.sidebarCollapsed) return;

    this.sidebarCollapsed = true;
  }

  private canUseHoverSidebar(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  private restoreNavigationFromRoute(route: string): void {
    const activePath = this.navigationService.findPathByRoute(route);

    if (activePath) {
      this.applyNavigationPath(activePath);
      return;
    }

    if (this.isStandaloneShellRoute(route)) {
      this.applyStandalonePageState();
      return;
    }

    if (this.isDashboardHome(route)) {
      this.redirectFromDashboardHome();
    }
  }

  private redirectFromDashboardHome(): void {
    const setupRoute = this.getInitialSettingsRoute();
    if (setupRoute) {
      void this.router.navigateByUrl(setupRoute, { replaceUrl: true });
      return;
    }

    const firstDashboardRoute = this.getFirstModuleDashboardRoute();
    if (firstDashboardRoute) {
      void this.router.navigateByUrl(firstDashboardRoute, { replaceUrl: true });
      return;
    }

    this.applyDefaultMenuState();
  }

  private getInitialSettingsRoute(): string | null {
    const branchId = Number(sessionStorage.getItem('branchId') || 0);
    const branches = this.readSessionJson<Array<{ id?: number }>>('authBranches', []);
    const setupPending = sessionStorage.getItem('postRegistrationSetupPending') === 'true';

    return setupPending || (!branchId && branches.length === 0)
      ? '/dashboard/settings/branch-management/manage-branches'
      : null;
  }

  private getFirstModuleDashboardRoute(): string | null {
    const firstModule = this.modules[0] ?? this.navigationService.getModules()[0];
    if (!firstModule) return null;

    const dashboardSubModule = firstModule.subModules.find(subModule =>
      subModule.id.toLowerCase().includes('dashboard') ||
      subModule.name.toLowerCase() === 'dashboard'
    );
    const firstScreen = dashboardSubModule?.screens[0] ??
      firstModule.subModules.find(subModule => subModule.screens.length > 0)?.screens[0];

    return firstScreen?.route ?? null;
  }

  private applyNavigationPath(path: NavigationPath): void {
    if (this.selectedModule?.id !== path.module.id) {
      this.navigationService.selectModule(path.module);
    }

    this.expandedSubModules.clear();

    if (this.hasFlyoutItems(path.subModule)) {
      this.expandedSubModules.add(path.subModule.id);
    }

    if (this.selectedSubModule?.id !== path.subModule.id) {
      this.navigationService.selectSubModule(path.subModule);
    }

    if (this.selectedScreen?.id !== path.screen.id) {
      this.navigationService.selectScreen(path.screen);
    }

    this.expandActiveFlyoutGroup(path.subModule, path.screen);

    this.breadcrumbPath = {
      module: path.module,
      subModule: path.subModule,
      screen: path.screen
    };

    this.sidebarCollapsed = false;
    this.saveSidebarState();
  }

  private scrollModuleTabIntoView(event?: Event): void {
    const element = event?.currentTarget as HTMLElement | null;

    element?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });

    this.queueModuleScrollStateUpdate();
  }

  scrollModuleTabs(direction: 'left' | 'right'): void {
    const scroller = this.moduleScroller?.nativeElement;
    if (!scroller) return;

    const distance = Math.max(180, Math.round(scroller.clientWidth * 0.72));
    scroller.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });

    this.queueModuleScrollStateUpdate();
  }

  onModuleTabsScroll(): void {
    this.updateModuleScrollState();
  }

  private queueModuleScrollStateUpdate(scrollSelected = false): void {
    window.requestAnimationFrame(() => {
      if (scrollSelected) {
        this.scrollActiveModuleTabIntoView();
      }

      this.updateModuleScrollState();
    });
  }

  private scrollActiveModuleTabIntoView(): void {
    const activeTab = this.moduleScroller?.nativeElement.querySelector('.module-tab.active') as HTMLElement | null;
    activeTab?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }

  private updateModuleScrollState(): void {
    const scroller = this.moduleScroller?.nativeElement;
    if (!scroller) return;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const hasOverflow = maxScrollLeft > 2;

    this.showModuleScrollLeft = hasOverflow && scroller.scrollLeft > 2;
    this.showModuleScrollRight = hasOverflow && scroller.scrollLeft < maxScrollLeft - 2;
  }

  private applyDefaultMenuState(): void {
    if (this.selectedModule || this.modules.length === 0) {
      return;
    }

    const module = this.modules[0];
    const subModule = module.subModules[0];

    this.navigationService.selectModule(module);
    this.sidebarCollapsed = false;
    this.saveSidebarState();

    if (subModule) {
      if (this.hasFlyoutItems(subModule)) {
        this.expandedSubModules.add(subModule.id);
      }

      this.navigationService.selectSubModule(subModule);
    }
  }

  private isDashboardHome(route: string): boolean {
    return this.normalizeRoute(route) === '/dashboard';
  }

  private isStandaloneShellRoute(route: string): boolean {
    const normalized = this.normalizeRoute(route);
    return normalized === '/dashboard/contacts' || normalized === '/dashboard/sos-dashboard';
  }

  private applyStandalonePageState(): void {
    this.selectedModule = null;
    this.selectedSubModule = null;
    this.selectedScreen = null;
    this.expandedSubModules.clear();
    this.breadcrumbPath = {
      module: null,
      subModule: null,
      screen: null
    };
    this.closeAllPanels();
    this.closeFlyoutSearch();
    this.sidebarCollapsed = true;
    this.saveSidebarState();
  }

  openContacts(): void {
    this.applyStandalonePageState();
  }

  openSosDashboard(): void {
    this.showAvatarMenu = false;
    this.showMegaMenu = false;
    this.showRecentForms = false;
    this.applyStandalonePageState();
    this.router.navigate(['/dashboard/sos-dashboard']);
  }

  private normalizeRoute(route: string): string {
    const pathOnly = (route || '/').split(/[?#]/)[0] || '/';
    const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    return withLeadingSlash.replace(/\/+$/, '') || '/';
  }

  closeFlyout(): void {
    this.expandedSubModules.clear();
    this.closeFlyoutSearch();
  }

  toggleFlyoutSearch(): void {
    this.showFlyoutSearch = !this.showFlyoutSearch;

    if (!this.showFlyoutSearch) {
      this.flyoutSearchQuery = '';
    }
  }

  closeFlyoutSearch(): void {
    this.showFlyoutSearch = false;
    this.flyoutSearchQuery = '';
  }

  toggleThemeDropdown(): void {
    this.showThemeDropdown = !this.showThemeDropdown;
  }

  get filteredFlyoutScreens(): any[] {
    const q = this.flyoutSearchQuery.trim().toLowerCase();
    
    if (!q) {
      return this.selectedSubModule?.screens || [];
    }

    const allResults: any[] = [];
    this.selectedModule?.subModules.forEach(sub => {
      const matches = sub.screens.filter(s => s.name.toLowerCase().includes(q));
      matches.forEach(m => {
        allResults.push({
          ...m,
          subModule: sub,
          isFromOtherSubModule: sub.id !== this.selectedSubModule?.id
        });
      });
    });

    return allResults;
  }

  get hasGroupedFlyoutScreens(): boolean {
    return !this.flyoutSearchQuery.trim() && !!this.selectedSubModule?.screens?.some(screen => !!screen.group);
  }

  get groupedFlyoutScreens(): FlyoutScreenGroup[] {
    const groups = new Map<string, Screen[]>();

    for (const screen of this.selectedSubModule?.screens || []) {
      const groupName = screen.group || 'Other';
      groups.set(groupName, [...(groups.get(groupName) || []), screen]);
    }

    return Array.from(groups.entries()).map(([name, screens]) => ({ name, screens }));
  }

  toggleFlyoutGroup(groupName: string): void {
    if (this.expandedFlyoutGroups.has(groupName)) {
      this.expandedFlyoutGroups.delete(groupName);
      return;
    }

    this.expandedFlyoutGroups.clear();
    this.expandedFlyoutGroups.add(groupName);
  }

  isFlyoutGroupExpanded(groupName: string): boolean {
    return this.expandedFlyoutGroups.has(groupName);
  }

  isFlyoutGroupActive(group: FlyoutScreenGroup): boolean {
    return !!this.selectedScreen && group.screens.some(screen => screen.id === this.selectedScreen?.id);
  }

  private initializeFlyoutGroups(subModule: SubModule | null): void {
    this.expandedFlyoutGroups.clear();
    if (!subModule) return;

    const activeGroupName = this.flyoutGroupNameForScreen(subModule, this.selectedScreen);
    const firstGroupName = this.firstFlyoutGroupName(subModule);
    const groupName = activeGroupName || firstGroupName;
    if (groupName) this.expandedFlyoutGroups.add(groupName);
  }

  private expandActiveFlyoutGroup(subModule: SubModule, screen: Screen): void {
    this.expandedFlyoutGroups.clear();
    const groupName = this.flyoutGroupNameForScreen(subModule, screen) || this.firstFlyoutGroupName(subModule);
    if (groupName) this.expandedFlyoutGroups.add(groupName);
  }

  private flyoutGroupNameForScreen(subModule: SubModule, screen?: Screen | null): string | null {
    if (!screen?.group) return null;
    return subModule.screens.some(item => item.id === screen.id && item.group === screen.group)
      ? screen.group
      : null;
  }

  private firstFlyoutGroupName(subModule: SubModule): string | null {
    const grouped = subModule.screens.find(screen => !!screen.group);
    return grouped?.group || null;
  }

  navigateToScreen(item: any): void {
    if (this.isScreenDisabled(item)) return;
    if (item.subModule) {
      this.navigationService.selectSubModule(item.subModule);
      this.expandedSubModules.clear();

      if (this.hasFlyoutItems(item.subModule)) {
        this.expandedSubModules.add(item.subModule.id);
      }

      this.initializeFlyoutGroups(item.subModule);
    }

    this.selectScreen(item);
  }

  get filteredMegaModules(): Module[] {
    if (!this.megaMenuSearch.trim()) {
      return this.modules;
    }

    const q = this.megaMenuSearch.toLowerCase();

    return this.modules
      .map((mod: Module) => ({
        ...mod,
        subModules: mod.subModules
          .map((sub: SubModule) => ({
            ...sub,
            screens: (sub.screens || []).filter((sc: Screen) =>
              sc.name.toLowerCase().includes(q) ||
              sub.name.toLowerCase().includes(q) ||
              mod.name.toLowerCase().includes(q)
            )
          }))
          .filter((sub: SubModule) =>
            sub.screens.length > 0 ||
            sub.name.toLowerCase().includes(q) ||
            mod.name.toLowerCase().includes(q)
          )
      }))
      .filter((mod: Module) =>
        mod.subModules.length > 0 || mod.name.toLowerCase().includes(q)
      );
  }

  navigateFromMega(mod: Module, sub: SubModule, screen: Screen): void {
    if (this.isScreenDisabled(screen)) return;
    const fullModule = this.modules.find(item => item.id === mod.id) || mod;
    const fullSubModule = fullModule.subModules.find(item => item.id === sub.id) || sub;
    const fullScreen =
      fullSubModule.screens.find(item => item.id === screen.id) ||
      fullSubModule.screens.find(item => item.route === screen.route) ||
      screen;

    this.navigationService.selectModule(fullModule);
    this.sidebarCollapsed = false;
    this.saveSidebarState();
    this.expandedSubModules.clear();

    if (this.hasFlyoutItems(fullSubModule)) {
      this.expandedSubModules.add(fullSubModule.id);
    }

    this.navigationService.selectSubModule(fullSubModule);
    this.selectScreen(fullScreen);
    this.megaMenuSearch = '';
    this.showMegaMenu = false;
  }

  addToRecent(screen: Screen): void {
    const existingIndex = this.recentForms.findIndex(item => item.route === screen.route);

    if (existingIndex > -1) {
      this.recentForms.splice(existingIndex, 1);
    }

    this.recentForms.unshift({
      name: screen.name,
      route: screen.route,
      moduleId: this.selectedModule?.id || '',
      moduleName: this.selectedModule?.name || '',
      subModuleId: this.selectedSubModule?.id || '',
      subModuleName: this.selectedSubModule?.name || '',
      screenId: screen.id,
      icon: this.getScreenIcon(screen.name),
      time: new Date()
    });

    if (this.recentForms.length > 8) {
      this.recentForms.pop();
    }
  }

  navigateRecent(form: RecentForm): void {
    const module =
      this.modules.find(item => item.id === form.moduleId) ||
      this.modules.find(item => item.name === form.moduleName);

    if (module) {
      this.navigationService.selectModule(module);
      this.sidebarCollapsed = false;
      this.saveSidebarState();

      const subModule =
        module.subModules.find(item => item.id === form.subModuleId) ||
        module.subModules.find(item => item.name === form.subModuleName);

      if (subModule) {
        this.expandedSubModules.clear();

        if (this.hasFlyoutItems(subModule)) {
          this.expandedSubModules.add(subModule.id);
        }

        this.navigationService.selectSubModule(subModule);

        const screen =
          subModule.screens.find(item => item.id === form.screenId) ||
          subModule.screens.find(item => item.route === form.route);

        if (screen) {
          this.selectScreen(screen);
        }
      }
    }

    this.router.navigate([form.route]);
    this.showRecentForms = false;
  }

  clearRecent(): void {
    this.recentForms = [];
  }

  getRecentTimeLabel(date: Date): string {
    const diffMinutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  }

  closeAllPanels(): void {
    this.showMegaMenu = false;
    this.showAvatarMenu = false;
    this.showRecentForms = false;
    this.showThemeDropdown = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAllPanels();
    this.closeFlyoutSearch();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.queueModuleScrollStateUpdate();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getModuleIcon(name?: string): string {
    const value = (name || '').toLowerCase();

    if (value.includes('account')) return 'pi pi-briefcase';
    if (value.includes('inventory')) return 'pi pi-box';
    if (value.includes('hr')) return 'pi pi-users';
    if (value.includes('setting')) return 'pi pi-cog';
    if (value.includes('payroll')) return 'pi pi-wallet';
    if (value.includes('report')) return 'pi pi-chart-bar';
    if (value.includes('admin')) return 'pi pi-shield';

    return 'pi pi-th-large';
  }

  getSubModuleIcon(name?: string): string {
    const value = (name || '').toLowerCase();

    if (value.includes('dashboard')) return 'pi pi-chart-bar';
    if (value.includes('config')) return 'pi pi-wrench';
    if (value.includes('transactions')) return 'pi pi-indian-rupee';
    if (value.includes('withdraw')) return 'pi pi-folder-open';
    if (value.includes('transfer')) return 'pi pi-arrow-right-arrow-left';
    if (value.includes('report')) return 'pi pi-chart-line';
    if (value.includes('payroll')) return 'pi pi-wallet';
    if (value.includes('customer')) return 'pi pi-users';
    if (value.includes('employee')) return 'pi pi-id-card';
    if (value.includes('leave')) return 'pi pi-calendar';
    if (value.includes('setting')) return 'pi pi-sliders-h';
    if (value.includes('master')) return 'pi pi-database';
    if (value.includes('verification')) return 'pi pi-check-square';

    return 'pi pi-wrench';
  }

  getScreenIcon(name?: string): string {
    const value = (name || '').toLowerCase();

    if (value.includes('dashboard')) return 'pi pi-chart-bar';
    if (value.includes('salary')) return 'pi pi-wallet';
    if (value.includes('esi')) return 'pi pi-shield';
    if (value.includes('pf')) return 'pi pi-building-columns';
    if (value.includes('tax')) return 'pi pi-percentage';
    if (value.includes('bonus')) return 'pi pi-gift';
    if (value.includes('leave')) return 'pi pi-calendar';
    if (value.includes('loyalty')) return 'pi pi-star';
    if (value.includes('payslip')) return 'pi pi-file';
    if (value.includes('statement')) return 'pi pi-file-edit';
    if (value.includes('attendance')) return 'pi pi-clock';
    if (value.includes('withdrawal')) return 'pi pi-angle-right';
    if (value.includes('transfer')) return 'pi pi-angle-right';
    if (value.includes('cheque')) return 'pi pi-angle-right';
    if (value.includes('receipt')) return 'pi pi-angle-right';
    if (value.includes('voucher')) return 'pi pi-angle-right';

    return 'pi pi-angle-right';
  }
}
