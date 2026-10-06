import {
  Component, OnInit, OnDestroy, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../envir/environment.prod';
import { resolveApiUrlForHost } from '../../../envir/api-host';
import { AuthPayload, AuthService, LoginTenantOption, OtpIssueResponse } from '../../core/services/auth.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { SubscriptionService, ModulePricingItem } from '../../core/services/subscription/subscription.service';
import { CompanyDetailsService } from '../../core/services/Common/company-details-service';
import { CompanyCode, BranchCode, LoginResponse } from './login.models';
import { BiometricAuthService } from '../../core/services/biometric-auth.service';

type AuthMode = 'password' | 'otp' | 'register' | 'userid';
type RegisterStep = 1 | 2;

interface CompanySetupDraft {
  companyName: string;
  legalName: string;
  companyCode: string;
  defaultBranchName: string;
  gstin: string;
  cinNumber: string;
  panNumber: string;
  email: string;
  contactNo: string;
  registrationAddress: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  financialYear: string;
  adminPassword: string;
  confirmAdminPassword: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule, ButtonModule, InputTextModule, ToastModule, PasswordModule, NgSelectModule
  ],
  providers: [MessageService],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {

  // ── DI via inject() ──────────────────────────────────────────────
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly companyService = inject(CompanyDetailsService);
  private readonly biometric = inject(BiometricAuthService);

  private _codeDebounce: ReturnType<typeof setTimeout> | null = null;
  private apiConfigPromise: Promise<boolean> | null = null;

  // ── Legacy Password Variables ──────────────────────────────────────
  legacyStep = signal<1 | 2>(1);
  companyCodes = signal<CompanyCode[]>([]);
  companyOptions = signal<{ label: string; value: number }[]>([]);
  branchOptions = signal<{ label: string; value: string }[]>([]);
  selectedCompanyId = signal<number | null>(null);
  selectedBranchCode = signal<string | null>(null);
  selectedCompanyCode = signal('');
  username = signal('');
  password = signal('');

  noBranches = computed(() =>
    !!this.selectedCompanyId() &&
    this.branchOptions().length === 0 &&
    !this.loading()
  );

  // ── Subscription / module signals ────────────────────────────────
  availableModules = signal<ModulePricingItem[]>([]);
  selectedModuleIds = signal<Set<number>>(new Set());
  maxBranches = signal(5);
  maxUsers = signal(10);
  modulesLoading = signal(false);

  // ── Signals ──────────────────────────────────────────────────────
  authMode = signal<AuthMode>('otp');
  registerStep = signal<RegisterStep>(1);
  loading = signal(false);
  apiReady = signal(false);
  errorMessage = signal('');

  companyCodeChecking = signal(false);
  companyCodeAvailable = signal<boolean | null>(null);
  companyCodeError = signal('');

  loginOtpIdentifier = signal('');
  readonly loginIdentifierChannel = computed(() => {
    const id = this.loginOtpIdentifier().trim();
    if (id.includes('@')) return 'email';
    if (/^\+?\d[\d\s\-]{7,}$/.test(id)) return 'mobile';
    return 'username';
  });
  loginOtpCompanyCode = signal('');
  loginOtp = signal('');
  loginOtpSent = signal(false);
  loginOtpDeliveryMessage = signal('');
  loginOtpDeliveryFailed = signal(false);
  loginRequiresSelection = signal(false);
  loginTenantOptions = signal<LoginTenantOption[]>([]);
  selectedLoginCompanyId = signal<number | null>(null);
  selectedLoginBranchId = signal<number | null>(null);
  // Independent selection state for the merged control. Warehouses carry a
  // linked branchId, but are still listed from their own warehouse access list.
  selectedLoginWarehouseId = signal<number | null>(null);

  // ── Login with User ID (direct password, no company pre-select) ───
  useridIdentifier = signal('');
  useridPassword = signal('');
  useridRequiresSelection = signal(false);
  useridTenantOptions = signal<LoginTenantOption[]>([]);
  selectedUseridCompanyId = signal<number | null>(null);
  selectedUseridBranchId = signal<number | null>(null);
  selectedUseridWarehouseId = signal<number | null>(null);

  registrationIdentity = signal('');
  readonly registrationIdentifierChannel = computed(() => {
    const id = this.registrationIdentity().trim();
    if (id.includes('@')) return 'email';
    if (/^\+?\d[\d\s\-]{7,}$/.test(id)) return 'mobile';
    return 'username';
  });
  registrationOtp = signal('');
  registrationOtpSent = signal(false);
  registrationOtpDeliveryMessage = signal('');
  registrationOtpDeliveryFailed = signal(false);
  registrationOtpVerified = signal(false);

  companySetup = signal<CompanySetupDraft>({
    companyName: '',
    legalName: '',
    companyCode: '',
    defaultBranchName: 'Head Office',
    gstin: '',
    cinNumber: '',
    panNumber: '',
    email: '',
    contactNo: '',
    registrationAddress: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    financialYear: '',
    adminPassword: '',
    confirmAdminPassword: '',
  });

  // ── Biometric signals (login verification) ──────────────────────
  biometricStep         = signal(false);
  biometricLoading      = signal(false);
  biometricError        = signal('');
  biometricAvailable    = signal(false);
  biometricNotEnrolled  = signal(false);   // required but not enrolled on this device
  private pendingPayload: AuthPayload | null = null;
  private pendingLoginLocationKind: 'branch' | 'warehouse' | null = null;

  // ── Biometric signals (company setup enrollment) ─────────────────
  setupBioStep      = signal(false);
  setupBioEnrolling = signal(false);
  setupBioMessage   = signal('');
  setupBioSuccess   = signal(false);
  private setupBioUserId: number | null = null;
  private setupBioRoute = '/dashboard';

  // ── Computed ─────────────────────────────────────────────────────
  registerProgress = computed(() => {
    const step = this.registerStep();
    return [
      { no: 1, label: 'Verify', active: step === 1, done: step > 1 },
      { no: 2, label: 'Company & Plan', active: step === 2, done: false },
    ];
  });

  selectedLoginTenant = computed(() =>
    this.loginTenantOptions().find(option => option.companyId === this.selectedLoginCompanyId()) ?? null
  );

  selectedLoginBranches = computed(() => this.selectedLoginTenant()?.branches ?? []);
  selectedLoginWarehouses = computed(() => this.selectedLoginTenant()?.warehouses ?? []);

  selectedUseridTenant = computed(() =>
    this.useridTenantOptions().find(option => option.companyId === this.selectedUseridCompanyId()) ?? null
  );

  selectedUseridBranches = computed(() => this.selectedUseridTenant()?.branches ?? []);
  selectedUseridWarehouses = computed(() => this.selectedUseridTenant()?.warehouses ?? []);

  ngOnDestroy(): void {
    if (this._codeDebounce) clearTimeout(this._codeDebounce);
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.ensureApiConfig();
    } finally {
      this.loading.set(false);
    }
  }

  private async ensureApiConfig(): Promise<boolean> {
    if (sessionStorage.getItem('apiURL')) {
      this.apiReady.set(true);
      return true;
    }

    if (!this.apiConfigPromise) {
      this.apiConfigPromise = this.loadApiConfig();
    }

    const loaded = await this.apiConfigPromise;
    // Guarantee the invariant callers rely on: never report success unless apiURL is
    // actually present in sessionStorage right now. (Symptom this closes: request-otp
    // firing against a relative path like http://localhost:4200/auth/request-otp — a 404
    // from the dev server itself — because something reported config as "ready" without
    // apiURL actually being set at call time.)
    const ready = loaded && !!sessionStorage.getItem('apiURL');
    if (!ready) {
      this.apiConfigPromise = null;
    }
    this.apiReady.set(ready);
    return ready;
  }

  private async loadApiConfig(): Promise<boolean> {
    const urldata = (environment as any).apiURL || (environment as any).apiUrl;
    if (!urldata) {
      return false;
    }

    // 20s, not 10s: on a cold ng-serve start the first request can be slow
    // to compile/respond, and a timeout here surfaces as a confusing
    // "API config failed" error that then disappears on the next refresh
    // once the dev server has warmed up.
    const res = await firstValueFrom(
      this.http.get<{ apiURL: string; morphoRdUrl?: string }[]>(urldata).pipe(timeout(20000))
    ).catch(() => undefined);

    if (!res?.length || !res[0].apiURL) {
      return false;
    }

    try {
      const url = new URL(resolveApiUrlForHost() ?? res[0].apiURL);
      const apiURL = url.origin + '/api';
      sessionStorage.setItem('apiURL', apiURL);
    } catch {
      return false;
    }

    if (res[0].morphoRdUrl) {
      sessionStorage.setItem('morphoRdUrl', res[0].morphoRdUrl);
    }

    return true;
  }

  // ── Load companies ───────────────────────────────────────────────
  private async loadCompanyCodes(): Promise<void> {
    if (!await this.ensureApiConfig()) {
      this.errorMessage.set('Unable to load API configuration. Please refresh and try again.');
      return;
    }

    const api = sessionStorage.getItem('apiURL') ?? '';
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<CompanyCode[]>(`${api}/Accounts/GetUsersCompanyCodes`).pipe(timeout(10000))
      );
      this.companyCodes.set(data);
      this.companyOptions.set(
        data.map(c => ({
          label: c.company_name,
          value: c.tbl_mst_chit_company_configuration_id,
        }))
      );
    } catch {
      this.showToast('error', 'Error', 'Failed to load company codes');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Company change → load branches ───────────────────────────────
  async onCompanyChange(): Promise<void> {
    const id = this.selectedCompanyId();
    const api = sessionStorage.getItem('apiURL') ?? '';

    this.branchOptions.set([]);
    this.selectedBranchCode.set(null);
    this.errorMessage.set('');
    if (!id) return;

    const found = this.companyCodes().find(
      c => c.tbl_mst_chit_company_configuration_id === id
    );
    this.selectedCompanyCode.set(found?.company_code ?? '');
    this.loading.set(true);

    try {
      const data = await firstValueFrom(
        this.http.get<BranchCode[]>(
          `${api}/Accounts/GetUsersBranchCodes?companyConfigurationId=${id}`
        ).pipe(timeout(10000))
      );
      this.branchOptions.set(
        data.map(b => ({ label: b.branch_name, value: b.branch_code }))
      );
    } catch {
      this.showToast('error', 'Error', 'Failed to load branch codes');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Legacy Login Methods ─────────────────────────────────────────
  onLegacyStep1Next(): void {
    this.errorMessage.set('');
    if (!this.selectedCompanyId()) {
      this.errorMessage.set('Please select a company.'); return;
    }
    if (!this.selectedBranchCode()) {
      this.errorMessage.set('Please select a branch.'); return;
    }
    this.loginTenantOptions.set([]);
    this.selectedLoginCompanyId.set(null);
    this.selectedLoginBranchId.set(null);
    this.selectedLoginWarehouseId.set(null);
    this.legacyStep.set(2);
  }

  goBackLegacy(): void {
    this.selectedBranchCode.set(null);
    this.selectedCompanyCode.set('');
    this.selectedCompanyId.set(null);
    this.legacyStep.set(1);
  }

  async onLegacyLogin(): Promise<void> {
    this.errorMessage.set('');
    if (!await this.ensureApiConfig()) {
      this.errorMessage.set('Unable to load API configuration. Please refresh and try again.');
      return;
    }
    if (!this.selectedCompanyCode() || !this.selectedBranchCode()) {
      this.errorMessage.set('Please select company and branch before password login.');
      this.legacyStep.set(1);
      return;
    }
    if (!this.username().trim()) {
      this.errorMessage.set('Please enter your username.'); return;
    }
    if (!this.password().trim()) {
      this.errorMessage.set('Please enter your password.'); return;
    }

    this.loading.set(true);

    try {
      const api = sessionStorage.getItem('apiURL') ?? '';
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${api}/Accounts/login`, {
          user_name: this.username().trim(),
          password: this.password().trim(),
          companyCode: this.selectedCompanyCode(),
          branchCode: this.selectedBranchCode(),
        }).pipe(timeout(10000))
      );

      const resolvedUsername =
        (response as any).user_name ?? response.username ?? this.username().trim();

      this.authService.setSession(
        response.token || '',
        resolvedUsername,
        this.selectedCompanyCode(),
        this.selectedBranchCode() || '',
        response.userId,
        response.branchId,
        (response as any).ipAddress ?? (response as any).IPAddress ?? '',
      );
      sessionStorage.setItem('moduleName','accounts')
      // store company details (fire-and-forget, non-blocking)
      this.companyService.GetCompanyData().subscribe({
        next: (d: any) => {
          if (d?.length) sessionStorage.setItem('CompanyDetails', JSON.stringify(d[0]));
        },
      });

      this.showToast('success', 'Login successful', `Welcome back, ${resolvedUsername}!`);
      setTimeout(() => this.router.navigate(['/dashboard']), 400);

    } catch (err: any) {
      if (err?.status === 401) {
        this.errorMessage.set('Invalid username or password.');
        this.showToast('error', 'Login failed', 'Invalid credentials. Please try again.');
      } else {
        this.errorMessage.set(err?.error?.message || 'Login failed. Please try again.');
        this.showToast('error', 'Error', this.errorMessage());
      }
    } finally {
      this.loading.set(false);
    }
  }

  setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.errorMessage.set('');
    if (mode === 'password') {
      this.legacyStep.set(1);
      this.selectedCompanyCode.set('');
      this.selectedCompanyId.set(null);
      this.selectedBranchCode.set(null);
      this.loginTenantOptions.set([]);
      this.selectedLoginCompanyId.set(null);
      this.selectedLoginBranchId.set(null);
      this.selectedLoginWarehouseId.set(null);
      this.loginOtpDeliveryMessage.set('');
      this.loadCompanyCodes();
    }
    if (mode === 'userid') {
      this.useridIdentifier.set('');
      this.useridPassword.set('');
      this.useridRequiresSelection.set(false);
      this.useridTenantOptions.set([]);
      this.selectedUseridCompanyId.set(null);
      this.selectedUseridBranchId.set(null);
      this.selectedUseridWarehouseId.set(null);
    }
    if (mode === 'register') {
      this.registerStep.set(1);
      this.registrationOtp.set('');
      this.registrationOtpSent.set(false);
      this.registrationOtpDeliveryFailed.set(false);
      this.registrationOtpVerified.set(false);
      this.registrationOtpDeliveryMessage.set('');
      this.companyCodeAvailable.set(null);
      this.companyCodeError.set('');
      this.companySetup.set({
        companyName: '', legalName: '', companyCode: '', defaultBranchName: 'Head Office',
        gstin: '', cinNumber: '', panNumber: '', email: '', contactNo: '',
        registrationAddress: '', city: '', state: '', country: 'India', pincode: '',
        financialYear: '', adminPassword: '', confirmAdminPassword: '',
      });
      this.selectedModuleIds.set(new Set());
      this.maxBranches.set(5);
      this.maxUsers.set(10);
      this.loadAvailableModules();
    }
  }

  private async loadAvailableModules(): Promise<void> {
    this.modulesLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.subscriptionService.getAvailableModules().pipe(timeout(8000))
      );
      if (res?.data) {
        this.availableModules.set(res.data);
        // Pre-select core modules
        const coreIds = new Set(res.data.filter(m => m.isCore).map(m => m.id));
        this.selectedModuleIds.set(coreIds);
      }
    } catch {
      // silent - user can proceed without module list
    } finally {
      this.modulesLoading.set(false);
    }
  }

  isModuleSelected(moduleId: number): boolean {
    return this.selectedModuleIds().has(moduleId);
  }

  toggleModule(module: ModulePricingItem): void {
    if (module.isCore) return; // core modules cannot be deselected
    const current = new Set(this.selectedModuleIds());
    if (current.has(module.id)) {
      current.delete(module.id);
    } else {
      current.add(module.id);
    }
    this.selectedModuleIds.set(current);
  }

  get totalModuleCost(): number {
    return this.availableModules()
      .filter(m => this.selectedModuleIds().has(m.id))
      .reduce((sum, m) => sum + m.monthlyPrice, 0);
  }

  // A 404 here means the request went out before apiBaseUrl() actually had the real API
  // host applied (it fell back to a relative path and hit the Angular dev server itself,
  // e.g. http://localhost:4200/auth/request-otp instead of http://<api-host>/api/auth/request-otp).
  // Force a fresh config load and retry exactly once instead of surfacing a confusing 404
  // that previously only cleared up once the user manually refreshed the page.
  private async requestOtpWithRetry(id: string, companyCode?: string): Promise<OtpIssueResponse> {
    try {
      return await firstValueFrom(this.authService.requestOtp(id, companyCode).pipe(timeout(45000)));
    } catch (err: any) {
      if (err?.status === 404 && !sessionStorage.getItem('apiURL')) {
        this.apiConfigPromise = null;
        if (await this.ensureApiConfig()) {
          return await firstValueFrom(this.authService.requestOtp(id, companyCode).pipe(timeout(45000)));
        }
      }
      throw err;
    }
  }

  async sendLoginOtp(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');
    if (!await this.ensureApiConfig()) {
      this.errorMessage.set('Unable to load API configuration. Please refresh and try again.');
      return;
    }
    const id = this.loginOtpIdentifier().trim();
    if (!id) {
      this.errorMessage.set('Please enter your email, mobile or username.');
      return;
    }
    const companyCode = this.loginOtpCompanyCode().trim() || undefined;
    this.loginTenantOptions.set([]);
    this.selectedLoginCompanyId.set(null);
    this.selectedLoginBranchId.set(null);
    this.selectedLoginWarehouseId.set(null);
    this.loginOtpDeliveryMessage.set('');
    this.loading.set(true);
    try {
      const response = await this.requestOtpWithRetry(id, companyCode);
      const exposedOtp = this.getExposedOtp(response);
      if (!this.isOtpDeliveryConfirmed(response) && exposedOtp) {
        const msg = 'Development OTP generated. Delivery was not acknowledged by SMS or email, so use the auto-filled OTP to continue.';
        this.loginOtpSent.set(true);
        this.loginOtpDeliveryFailed.set(false);
        this.loginOtp.set(exposedOtp);
        this.loginOtpDeliveryMessage.set(msg);
        this.showToast('info', 'OTP ready', msg);
        return;
      }
      if (!this.isOtpDeliveryConfirmed(response)) {
        const msg = this.otpDeliveryFailureMessage(
          response,
          'OTP delivery could not be confirmed by the configured SMS or email channel. If you received the OTP from your administrator, you may still enter it below.'
        );
        this.loginOtpSent.set(true);
        this.loginOtpDeliveryFailed.set(true);
        const fallbackOtp = (response.data as any)?.otp || '';
        this.loginOtp.set(fallbackOtp);
        this.loginOtpDeliveryMessage.set(msg);
        this.showToast('warn', 'Delivery not confirmed', msg);
        return;
      }
      this.loginOtpDeliveryFailed.set(false);
      const deliveryMessage = this.otpDeliverySuccessMessage(response);
      this.loginOtpSent.set(true);
      this.loginOtp.set(exposedOtp || '');
      const message = exposedOtp
        ? `${deliveryMessage} Development OTP is auto-filled below.`
        : deliveryMessage;
      this.loginOtpDeliveryMessage.set(message);
      this.showToast('success', 'OTP sent', message);
    } catch (err: any) {
      const msg = err?.status === 0
        ? 'Cannot connect to the server. Please check your connection and try again.'
        : err?.error?.message || 'Unable to send OTP. Please try again.';
      this.errorMessage.set(msg);
      this.showToast('error', 'OTP error', msg);
    } finally {
      this.loading.set(false);
    }
  }

  async verifyLoginOtp(): Promise<void> {
    this.errorMessage.set('');
    if (!this.loginOtpSent()) {
      this.errorMessage.set('Please request an OTP first.');
      return;
    }
    if (!/^\d{6}$/.test(this.loginOtp().trim())) {
      this.errorMessage.set('Please enter a valid 6-digit OTP.');
      return;
    }
    if (this.loginRequiresSelection()) {
      if (!this.selectedLoginCompanyId()) {
        this.errorMessage.set('Please select a company.');
        return;
      }
      const hasLocationOptions = this.selectedLoginBranches().length > 0 || this.selectedLoginWarehouses().length > 0;
      if (hasLocationOptions && !this.selectedLoginBranchId() && !this.selectedLoginWarehouseId()) {
        this.errorMessage.set('Please select a branch or warehouse.');
        return;
      }
    }
    const selectedLocationKind = this.selectedLoginActiveLocationKind();
    const selectedBranchId = selectedLocationKind === 'branch' ? this.selectedLoginBranchId() : null;
    const selectedWarehouseId = selectedLocationKind === 'warehouse' ? this.selectedLoginWarehouseId() : null;
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.authService.verifyOtp(
          this.loginOtpIdentifier().trim(),
          this.loginOtp().trim(),
          this.loginOtpCompanyCode().trim() || undefined,
          this.selectedLoginCompanyId(),
          selectedBranchId,
          selectedWarehouseId
        ).pipe(timeout(10000))
      );

      if (!response?.data) {
        throw new Error(response?.message || 'Invalid OTP response.');
      }

      if (response.data.requiresSelection) {
        const options = response.data.tenantOptions ?? [];
        // Store immediately so the switcher works even if the final login response omits tenantOptions
        if (options.length) sessionStorage.setItem('authTenantOptions', JSON.stringify(options));
        this.prepareTenantSelection(options);
        this.loginRequiresSelection.set(true);

        this.showToast('success', 'OTP verified', 'Select company and branch or warehouse to continue.');
        return;
      }

      this.loginRequiresSelection.set(false);
      // Preserve the full tenant list so the company switcher works after login
      if (!response.data.tenantOptions?.length && this.loginTenantOptions().length) {
        response.data = { ...response.data, tenantOptions: this.loginTenantOptions() };
      }
      this.completeLogin(response.data, selectedLocationKind);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || err?.message || 'Invalid or expired OTP.');
    } finally {
      this.loading.set(false);
    }
  }

  selectLoginCompany(companyId: number | string): void {
    const resolvedCompanyId = Number(companyId) || null;
    this.selectedLoginCompanyId.set(resolvedCompanyId);
    const option = this.loginTenantOptions().find(o => o.companyId === resolvedCompanyId);
    const branch = option?.branches?.find(item => item.isDefault) ?? option?.branches?.[0] ?? null;
    this.selectedLoginBranchId.set(branch?.id ?? null);
    const warehouse = option?.warehouses?.find(item => item.isDefault) ?? option?.warehouses?.[0] ?? null;
    this.selectedLoginWarehouseId.set(branch?.id ? null : warehouse?.id ?? null);
  }

  selectLoginBranch(branchId: number | string): void {
    this.selectedLoginBranchId.set(Number(branchId) || null);
    this.selectedLoginWarehouseId.set(null);
  }

  selectLoginWarehouse(warehouseId: number | string): void {
    this.selectedLoginWarehouseId.set(Number(warehouseId) || null);
    this.selectedLoginBranchId.set(null);
  }

  // ── Login with User ID ────────────────────────────────────────────
  async onUserIdLogin(): Promise<void> {
    this.errorMessage.set('');
    if (!await this.ensureApiConfig()) {
      this.errorMessage.set('Unable to load API configuration. Please refresh and try again.');
      return;
    }
    const id = this.useridIdentifier().trim();
    const pw = this.useridPassword().trim();
    if (!id) { this.errorMessage.set('Please enter your email or user ID.'); return; }
    if (!pw) { this.errorMessage.set('Please enter your password.'); return; }

    // This path previously had NO pre-submit selection validation at all (unlike
    // verifyLoginOtp above) — a missing company/branch/warehouse just silently
    // rode through to the backend. Mirror the OTP path's gate exactly so the
    // password path can't regress silently again.
    if (this.useridRequiresSelection()) {
      if (!this.selectedUseridCompanyId()) {
        this.errorMessage.set('Please select a company.');
        return;
      }
      const hasLocationOptions = this.selectedUseridBranches().length > 0 || this.selectedUseridWarehouses().length > 0;
      if (hasLocationOptions && !this.selectedUseridBranchId() && !this.selectedUseridWarehouseId()) {
        this.errorMessage.set('Please select a branch or warehouse.');
        return;
      }
    }

    const selectedLocationKind = this.selectedUseridActiveLocationKind();
    const selectedBranchId = selectedLocationKind === 'branch' ? this.selectedUseridBranchId() : null;
    const selectedWarehouseId = selectedLocationKind === 'warehouse' ? this.selectedUseridWarehouseId() : null;
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.authService.passwordLogin(
          id,
          pw,
          undefined,
          this.useridRequiresSelection() ? this.selectedUseridCompanyId() : null,
          this.useridRequiresSelection() ? selectedBranchId : null,
          this.useridRequiresSelection() ? selectedWarehouseId : null
        ).pipe(timeout(10000))
      );

      if (!response?.data) {
        throw new Error(response?.message || 'Login failed.');
      }

      if (response.data.requiresSelection) {
        const options = response.data.tenantOptions ?? [];
        // Store immediately so the switcher works even if the final login response omits tenantOptions
        if (options.length) sessionStorage.setItem('authTenantOptions', JSON.stringify(options));
        this.useridTenantOptions.set(options);
        const first = options[0] ?? null;
        const branch = first?.branches?.find(item => item.isDefault) ?? first?.branches?.[0] ?? null;
        const warehouse = first?.warehouses?.find(item => item.isDefault) ?? first?.warehouses?.[0] ?? null;
        this.selectedUseridCompanyId.set(first?.companyId ?? null);
        this.selectedUseridBranchId.set(branch?.id ?? null);
        this.selectedUseridWarehouseId.set(branch?.id ? null : warehouse?.id ?? null);
        this.useridRequiresSelection.set(true);
        this.showToast('info', 'Select company', 'Your credentials are linked to multiple companies. Pick one to continue.');
        return;
      }

      this.useridRequiresSelection.set(false);
      // Preserve the full tenant list so the company switcher works after login
      if (!response.data.tenantOptions?.length && this.useridTenantOptions().length) {
        response.data = { ...response.data, tenantOptions: this.useridTenantOptions() };
      }
      this.completeLogin(response.data, selectedLocationKind);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || err?.message || 'Invalid credentials or account not found.');
    } finally {
      this.loading.set(false);
    }
  }

  selectUseridCompany(companyId: number | string): void {
    const id = Number(companyId) || null;
    this.selectedUseridCompanyId.set(id);
    const option = this.useridTenantOptions().find(o => o.companyId === id);
    const branch = option?.branches?.find(b => b.isDefault) ?? option?.branches?.[0] ?? null;
    this.selectedUseridBranchId.set(branch?.id ?? null);
    const warehouse = option?.warehouses?.find(w => w.isDefault) ?? option?.warehouses?.[0] ?? null;
    this.selectedUseridWarehouseId.set(branch?.id ? null : warehouse?.id ?? null);
  }

  selectUseridBranch(branchId: number | string): void {
    this.selectedUseridBranchId.set(Number(branchId) || null);
    this.selectedUseridWarehouseId.set(null);
  }

  selectUseridWarehouse(warehouseId: number | string): void {
    this.selectedUseridWarehouseId.set(Number(warehouseId) || null);
    this.selectedUseridBranchId.set(null);
  }

  private selectedLoginActiveLocationKind(): 'branch' | 'warehouse' {
    return this.selectedLoginWarehouseId() && !this.selectedLoginBranchId() ? 'warehouse' : 'branch';
  }

  private selectedUseridActiveLocationKind(): 'branch' | 'warehouse' {
    return this.selectedUseridWarehouseId() && !this.selectedUseridBranchId() ? 'warehouse' : 'branch';
  }

  private prepareTenantSelection(options: LoginTenantOption[]): void {
    this.loginTenantOptions.set(options);
    const first = options[0] ?? null;
    this.selectedLoginCompanyId.set(first?.companyId ?? null);
    const branch = first?.branches?.find(item => item.isDefault) ?? first?.branches?.[0] ?? null;
    const warehouse = first?.warehouses?.find(item => item.isDefault) ?? first?.warehouses?.[0] ?? null;
    this.selectedLoginBranchId.set(branch?.id ?? null);
    this.selectedLoginWarehouseId.set(branch?.id ? null : warehouse?.id ?? null);
  }

  // ── Login completion (biometric gate) ───────────────────────────
  private completeLogin(payload: AuthPayload, activeLocationKind: 'branch' | 'warehouse' = 'branch'): void {
    const userId = payload.user?.id;
    if (userId) {
      const enrolled = this.biometric.hasCredential(userId);
      const required = this.biometric.isRequired(userId);
      if (enrolled || required) {
        this.pendingPayload = payload;
        this.pendingLoginLocationKind = activeLocationKind;
        this.biometricNotEnrolled.set(!enrolled);
        this.biometricStep.set(true);
        this.biometricError.set('');
        return;
      }
    }

    this.finishLogin(payload, activeLocationKind);
  }

  async onBiometricVerify(): Promise<void> {
    if (!this.pendingPayload) return;
    const userId = this.pendingPayload.user?.id;
    if (!userId) {
      const payload = this.pendingPayload;
      const activeLocationKind = this.pendingLoginLocationKind ?? 'branch';
      this.pendingPayload = null;
      this.pendingLoginLocationKind = null;
      this.finishLogin(payload!, activeLocationKind);
      return;
    }

    // Required but not enrolled on this device — warn and proceed
    if (this.biometricNotEnrolled()) {
      const payload = this.pendingPayload;
      const activeLocationKind = this.pendingLoginLocationKind ?? 'branch';
      this.pendingPayload = null;
      this.pendingLoginLocationKind = null;
      this.biometricStep.set(false);
      this.biometricNotEnrolled.set(false);
      this.showToast('warn', 'Fingerprint not enrolled',
        'Ask your admin to enroll fingerprint on this device for secure login.');
      this.finishLogin(payload!, activeLocationKind);
      return;
    }

    this.biometricLoading.set(true);
    this.biometricError.set('');
    const result = await this.biometric.authenticateCredential(userId);
    this.biometricLoading.set(false);

    if (result === 'success') {
      const payload = this.pendingPayload;
      const activeLocationKind = this.pendingLoginLocationKind ?? 'branch';
      this.pendingPayload = null;
      this.pendingLoginLocationKind = null;
      this.biometricStep.set(false);
      this.biometricNotEnrolled.set(false);
      this.finishLogin(payload!, activeLocationKind);
    } else if (result === 'cancelled') {
      this.biometricError.set('Scan cancelled or timed out. Place your finger on the sensor and try again.');
    } else if (result === 'unsupported') {
      this.biometricError.set(
        'Fingerprint device not reachable. Ensure the Morpho RD Service is installed and running on this PC, then try again.'
      );
    } else if (result === 'no_credential') {
      this.biometricError.set('No fingerprint enrolled for this account on this device. Ask your admin to enroll it.');
    } else {
      this.biometricError.set('Fingerprint verification failed. Please try again or contact your administrator.');
    }
  }

  onBiometricCancel(): void {
    this.biometricStep.set(false);
    this.biometricNotEnrolled.set(false);
    this.pendingPayload = null;
    this.pendingLoginLocationKind = null;
    this.biometricError.set('');
    this.errorMessage.set('Login cancelled. Please sign in again.');
  }

  private async finishLogin(payload: AuthPayload, activeLocationKind: 'branch' | 'warehouse' = 'branch'): Promise<void> {
    this.authService.setMultiTenantSession(payload);
    sessionStorage.setItem('activeLocationKind', activeLocationKind);
    await this.refreshLegacyCompanyDetails();
    this.showToast('success', 'Welcome!', `Signed in as ${payload.user?.fullName || payload.user?.username}.`);

    const isPostReg = sessionStorage.getItem('postRegistrationSetupPending') === 'true';
    const shouldOpenSettings = (payload.branches?.length ?? 0) === 0 || isPostReg;
    sessionStorage.removeItem('postRegistrationSetupPending');

    const route = shouldOpenSettings
      ? '/dashboard/settings/branch-management/manage-branches'
      : '/dashboard';

    // After company registration: offer fingerprint enrollment for the new admin
    const userId = payload.user?.id;
    if (isPostReg && userId && await this.biometric.isPlatformAuthenticatorAvailable()) {
      this.setupBioUserId = userId;
      this.setupBioRoute  = route;
      this.setupBioStep.set(true);
      this.setupBioMessage.set('');
      this.setupBioSuccess.set(false);
      return;
    }

    setTimeout(() => this.router.navigate([route]), 400);
  }

  private async refreshLegacyCompanyDetails(): Promise<void> {
    try {
      const details = await firstValueFrom(this.companyService.GetCompanyData().pipe(timeout(8000)));
      if (Array.isArray(details) && details.length) {
        sessionStorage.setItem('CompanyDetails', JSON.stringify(details[0]));
      }
    } catch {
      // AuthService stores a minimal CompanyDetails fallback for multi-tenant sessions.
    }
  }

  // ── Company-setup biometric enrollment ───────────────────────────
  async onSetupBioEnroll(): Promise<void> {
    if (!this.setupBioUserId) { this.onSetupBioDone(); return; }
    this.setupBioEnrolling.set(true);
    this.setupBioMessage.set('');

    const u = JSON.parse(sessionStorage.getItem('authUser') || '{}');
    const result = await this.biometric.registerCredential(
      this.setupBioUserId,
      u.username ?? String(this.setupBioUserId),
      u.fullName  ?? u.username ?? 'Admin'
    );
    this.setupBioEnrolling.set(false);

    if (result === 'success') {
      this.biometric.setRequired(this.setupBioUserId, true);
      this.setupBioSuccess.set(true);
      this.setupBioMessage.set('Fingerprint enrolled! You will be prompted to verify it on every login.');
    } else if (result === 'cancelled') {
      this.setupBioMessage.set('Scan cancelled. You can enroll later from Settings → Manage Users.');
    } else if (result === 'unsupported') {
      this.setupBioMessage.set('This device does not support fingerprint authentication.');
    } else {
      this.setupBioMessage.set('Enrollment failed. Try again from Settings → Manage Users.');
    }
  }

  onSetupBioDone(): void {
    this.setupBioStep.set(false);
    this.setupBioSuccess.set(false);
    this.setupBioMessage.set('');
    const route = this.setupBioRoute;
    this.setupBioUserId = null;
    this.setupBioRoute  = '/dashboard';
    setTimeout(() => this.router.navigate([route]), 200);
  }

  async sendRegistrationOtp(): Promise<void> {
    this.errorMessage.set('');
    if (!await this.ensureApiConfig()) {
      this.errorMessage.set('Unable to load API configuration. Please refresh and try again.');
      return;
    }
    if (!this.registrationIdentity().trim()) {
      this.errorMessage.set('Please enter your email or mobile number.');
      return;
    }
    if (!this.isEmailOrMobile(this.registrationIdentity())) {
      this.errorMessage.set('Please use a valid email address or 10-digit mobile number for registration.');
      return;
    }
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.authService.requestRegistrationOtp(this.registrationIdentity().trim()).pipe(timeout(45000))
      );
      const exposedOtp = this.getExposedOtp(response);
      if (!this.isOtpDeliveryConfirmed(response) && exposedOtp) {
        const msg = 'Development OTP generated. Delivery was not acknowledged by SMS or email, so use the auto-filled OTP to continue.';
        this.registrationOtp.set(exposedOtp);
        this.registrationOtpSent.set(true);
        this.registrationOtpDeliveryFailed.set(false);
        this.registrationOtpDeliveryMessage.set(msg);
        this.showToast('info', 'OTP ready', msg);
        return;
      }
      if (!this.isOtpDeliveryConfirmed(response)) {
        const msg = this.otpDeliveryFailureMessage(
          response,
          'OTP delivery could not be confirmed. If you received the OTP, enter it below, or try a different contact.'
        );
        this.registrationOtp.set('');
        this.registrationOtpSent.set(true);
        this.registrationOtpDeliveryFailed.set(true);
        this.registrationOtpDeliveryMessage.set(msg);
        this.showToast('warn', 'Delivery not confirmed', msg);
        return;
      }
      const deliveryMessage = this.otpDeliverySuccessMessage(response);
      this.registrationOtp.set(exposedOtp || '');
      this.registrationOtpSent.set(true);
      this.registrationOtpDeliveryFailed.set(false);
      const message = exposedOtp
        ? `${deliveryMessage} Development OTP is auto-filled below.`
        : deliveryMessage;
      this.registrationOtpDeliveryMessage.set(message);
      this.showToast('success', 'OTP sent', message);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || 'Unable to request OTP.');
      this.showToast('error', 'OTP failed', this.errorMessage());
    } finally {
      this.loading.set(false);
    }
  }

  updateRegistrationIdentity(value: string): void {
    this.registrationIdentity.set(value);
    this.registrationOtp.set('');
    this.registrationOtpSent.set(false);
    this.registrationOtpDeliveryFailed.set(false);
    this.registrationOtpVerified.set(false);
    this.registrationOtpDeliveryMessage.set('');
    this.errorMessage.set('');
  }

  updateLoginOtpIdentifier(value: string): void {
    this.loginOtpIdentifier.set(value);
    this.loginOtpCompanyCode.set('');
    this.loginOtp.set('');
    this.loginOtpSent.set(false);
    this.loginOtpDeliveryFailed.set(false);
    this.loginOtpDeliveryMessage.set('');
    this.loginRequiresSelection.set(false);
    this.loginTenantOptions.set([]);
    this.selectedLoginCompanyId.set(null);
    this.selectedLoginBranchId.set(null);
    this.selectedLoginWarehouseId.set(null);
    this.errorMessage.set('');
  }

  changeLoginId(): void {
    this.loginOtpSent.set(false);
    this.loginOtp.set('');
    this.loginOtpCompanyCode.set('');
    this.loginOtpDeliveryFailed.set(false);
    this.loginOtpDeliveryMessage.set('');
    this.loginRequiresSelection.set(false);
    this.loginTenantOptions.set([]);
    this.selectedLoginCompanyId.set(null);
    this.selectedLoginBranchId.set(null);
    this.selectedLoginWarehouseId.set(null);
    this.errorMessage.set('');
  }

  async confirmRegistrationOtp(): Promise<void> {
    this.errorMessage.set('');
    if (!this.registrationOtpSent()) {
      this.errorMessage.set('Please send OTP first.');
      return;
    }
    if (!/^\d{6}$/.test(this.registrationOtp().trim())) {
      this.errorMessage.set('Please enter a valid 6 digit OTP.');
      return;
    }
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.authService.verifyRegistrationOtp(this.registrationIdentity().trim(), this.registrationOtp().trim()).pipe(timeout(10000))
      );
      this.registrationOtpVerified.set(true);
      this.prefillRegistrationContactFromVerifiedIdentity();
      this.registerStep.set(2);
      this.showToast('success', 'OTP verified', 'Continue company registration.');
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || 'Invalid or expired OTP.');
      this.showToast('error', 'OTP failed', this.errorMessage());
    } finally {
      this.loading.set(false);
    }
  }

  updateCompanySetup(field: keyof CompanySetupDraft, value: string): void {
    this.companySetup.update(current => ({ ...current, [field]: value }));

    if (field === 'companyName') {
      this.companyCodeAvailable.set(null);
      this.companyCodeError.set('');
      if (this._codeDebounce) clearTimeout(this._codeDebounce);
      if (!value.trim()) return;
      this._codeDebounce = setTimeout(() => this.fetchSuggestedCode(value), 600);
    }

    if (field === 'companyCode') {
      this.companyCodeAvailable.set(null);
      this.companyCodeError.set('');
    }
  }

  private async fetchSuggestedCode(name: string): Promise<void> {
    if (this.companySetup().companyCode.trim()) return;
    const code = this.generateCompanyCode(name);
    if (!code) return;
    this.companySetup.update(c => ({ ...c, companyCode: code }));
    this.companyCodeAvailable.set(null);
    this.companyCodeError.set('');
    this.companyCodeChecking.set(true);
    try {
      const res = await firstValueFrom(
        this.authService.checkCompanyCode(code).pipe(timeout(6000))
      );
      if (this.companySetup().companyCode === code) {
        this.companyCodeAvailable.set(res?.available ?? null);
        if (res?.available === false) {
          this.companyCodeError.set('This company code is already taken. Please use a different one.');
        }
      }
    } catch {
      // silent - user can type manually
    } finally {
      this.companyCodeChecking.set(false);
    }
  }

  private generateCompanyCode(name: string): string {
    const words = name.trim().toUpperCase().split(/\s+/)
      .map(word => word.replace(/[^A-Z0-9]/g, ''))
      .filter(Boolean);
    if (!words.length) return '';
    const prefix = (words.length >= 2
      ? words[0].slice(0, 2) + words[1].slice(0, 2)
      : words[0].slice(0, 4)).padEnd(4, 'X').slice(0, 4);
    return `${prefix}0001`;
  }

  // First branch is always the Head Office — code from initials + 'BC' + '0001'
  // (e.g. "Head Office" -> "HOBC0001"), matching the format used everywhere else
  // branch codes are generated. It's always the very first branch for a brand-new
  // company, so the sequence number is always 0001 here.
  private generateDefaultBranchCode(name: string): string {
    const words = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (!words.length) return 'HOBC0001';
    const initials = words
      .map(w => w[0])
      .join('')
      .padEnd(2, 'X')
      .slice(0, 2);
    return `${initials}BC0001`;
  }

  async onCompanyCodeBlur(): Promise<void> {
    const code = this.companySetup().companyCode.trim();
    if (!code) { this.companyCodeAvailable.set(null); this.companyCodeError.set(''); return; }
    this.companyCodeChecking.set(true);
    this.companyCodeAvailable.set(null);
    this.companyCodeError.set('');
    try {
      const res = await firstValueFrom(
        this.authService.checkCompanyCode(code).pipe(timeout(6000))
      );
      if (res?.available) {
        this.companyCodeAvailable.set(true);
        this.companyCodeError.set('');
      } else {
        this.companyCodeAvailable.set(false);
        this.companyCodeError.set('This company code is already taken. Please use a different one.');
      }
    } catch {
      this.companyCodeAvailable.set(null);
    } finally {
      this.companyCodeChecking.set(false);
    }
  }

  onCompanyCodeChange(value: string): void {
    this.updateCompanySetup('companyCode', value);
    this.companyCodeAvailable.set(null);
    this.companyCodeError.set('');
  }

  async finishRegistrationSetup(): Promise<void> {
    const company = this.companySetup();
    this.errorMessage.set('');
    if (!company.companyName.trim() || !company.companyCode.trim() || !company.email.trim() || !company.contactNo.trim()) {
      this.errorMessage.set('Please fill company name, code, mail ID and contact number.');
      return;
    }
    if (this.companyCodeAvailable() === false) {
      this.errorMessage.set('The company code is already in use. Please choose a different one.');
      return;
    }
    if (this.companyCodeChecking()) {
      this.errorMessage.set('Please wait while the company code is being verified.');
      return;
    }
    // PAN is optional, but when given it must be in PAN format.
    const companyPan = (company.panNumber || '').trim().toUpperCase();
    if (companyPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(companyPan)) {
      this.errorMessage.set('Enter a valid PAN (e.g. ABCDE1234F).');
      return;
    }
    const adminPassword = company.adminPassword.trim();
    const confirmAdminPassword = company.confirmAdminPassword.trim();
    if (adminPassword || confirmAdminPassword) {
      if (adminPassword.length < 8) {
        this.errorMessage.set('Admin password must be at least 8 characters.');
        return;
      }
      if (adminPassword !== confirmAdminPassword) {
        this.errorMessage.set('Admin password and confirmation do not match.');
        return;
      }
    }

    const api = sessionStorage.getItem('apiURL') ?? '';
    this.loading.set(true);
    try {
      const optionalText = (value: string | null | undefined): string | null => {
        const trimmed = value?.trim() ?? '';
        return trimmed ? trimmed : null;
      };
      const branchName = (company.defaultBranchName || 'Head Office').trim();
      await firstValueFrom(
        this.http.post(`${api}/companies`, {
          companyCode: company.companyCode.trim(),
          companyName: company.companyName.trim(),
          legalName: optionalText(company.legalName),
          email: company.email.trim(),
          mobile: company.contactNo.trim(),
          gstNo: optionalText(company.gstin),
          panNo: optionalText(company.panNumber),
          address: optionalText(company.registrationAddress),
          city: optionalText(company.city),
          state: optionalText(company.state),
          country: optionalText(company.country),
          pincode: optionalText(company.pincode),
          status: 'active',
          registrationIdentifier: this.registrationIdentity().trim(),
          adminPassword: optionalText(company.adminPassword),
          // Nested object matching the API's BranchUpsertRequest shape — a flat
          // defaultBranchName string here is silently dropped by model binding,
          // which meant no company ever actually got a Head Office branch created.
          defaultBranch: {
            branchCode: this.generateDefaultBranchCode(branchName),
            branchName,
            email: optionalText(company.email),
            mobile: optionalText(company.contactNo),
            address: optionalText(company.registrationAddress),
            city: optionalText(company.city),
            state: optionalText(company.state),
            country: optionalText(company.country),
            pincode: optionalText(company.pincode),
            isHeadOffice: true,
            status: 'active'
          },
          // Subscription plan fields
          subscribedModuleIds: Array.from(this.selectedModuleIds()),
          maxBranches: this.maxBranches(),
          maxUsers: this.maxUsers()
        }).pipe(timeout(15000))
      );

      this.showToast('success', 'Registration complete', 'Company created. Sign in to finish branch and user setup.');
      sessionStorage.setItem('postRegistrationSetupPending', 'true');
      this.setAuthMode('otp');
      this.loginOtpIdentifier.set(this.getPostRegistrationLoginIdentifier(company));
      this.loginOtpCompanyCode.set('');
      this.loginOtp.set('');
      this.loginOtpSent.set(false);
      this.loginOtpDeliveryMessage.set('');
      this.loginTenantOptions.set([]);
      this.selectedLoginCompanyId.set(null);
      this.selectedLoginBranchId.set(null);
      this.selectedLoginWarehouseId.set(null);
    } catch (err: any) {
      this.errorMessage.set(err?.error?.message || 'Registration failed.');
      this.showToast('error', 'Registration failed', this.errorMessage());
    } finally {
      this.loading.set(false);
    }
  }

  // ── Toast helper ─────────────────────────────────────────────────
  private isEmailOrMobile(value: string): boolean {
    const trimmed = value.trim();
    if (trimmed.includes('@')) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }

    const digits = trimmed.replace(/\D/g, '');
    const mobile = digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
    return /^\d{10}$/.test(mobile);
  }

  private prefillRegistrationContactFromVerifiedIdentity(): void {
    const identity = this.registrationIdentity().trim();
    if (!identity) return;

    this.companySetup.update(current => {
      if (identity.includes('@') && !current.email.trim()) {
        return { ...current, email: identity };
      }

      if (!identity.includes('@') && !current.contactNo.trim()) {
        return { ...current, contactNo: this.normalizeMobileForDisplay(identity) ?? identity };
      }

      return current;
    });
  }

  private getPostRegistrationLoginIdentifier(company: CompanySetupDraft): string {
    const verified = this.registrationIdentity().trim();
    if (verified.includes('@')) {
      return verified;
    }

    return this.normalizeMobileForDisplay(verified) || company.contactNo.trim() || company.email.trim() || verified;
  }

  private normalizeMobileForDisplay(value: string): string | null {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    return digits.length === 10 ? digits : null;
  }

  private isOtpDeliveryConfirmed(response: OtpIssueResponse | undefined): boolean {
    if (!response) {
      return false;
    }

    // If the server explicitly says success=false, always treat as failure.
    if (response.success !== true) {
      return false;
    }

    // Check for any explicit delivery-acknowledged flag in the response data.
    const acknowledged = this.readOtpFlag(
      response.data,
      'deliveryConfirmed',
      'DeliveryConfirmed',
      'deliveryAcknowledged',
      'DeliveryAcknowledged',
      'acknowledged',
      'Acknowledged',
      'otpSent',
      'OtpSent'
    );

    if (acknowledged !== undefined) {
      return acknowledged;
    }

    // Check channel-specific flags.
    const smsSent = this.readOtpFlag(response.data, 'smsSent', 'SmsSent');
    const emailSent = this.readOtpFlag(response.data, 'emailSent', 'EmailSent');

    // If channel flags are explicitly present, at least one must be true.
    if (smsSent !== undefined || emailSent !== undefined) {
      return smsSent === true || emailSent === true;
    }

    // No channel-specific flags at all — the API returned success=true without
    // delivery detail (e.g. username-only login). Trust the server's success flag.
    return true;
  }

  private otpDeliverySuccessMessage(response: OtpIssueResponse | undefined): string {
    const data = response?.data;
    const smsSent = this.readOtpFlag(data, 'smsSent', 'SmsSent') === true;
    const emailSent = this.readOtpFlag(data, 'emailSent', 'EmailSent') === true;
    const requestedChannel = this.loginIdentifierChannel();

    if (requestedChannel === 'email' && smsSent && !emailSent) {
      return 'Email OTP could not be sent. OTP was submitted by SMS to your registered mobile.';
    }
    if (requestedChannel === 'mobile' && emailSent && !smsSent) {
      return 'SMS OTP could not be sent. OTP was submitted by email to your registered email.';
    }

    if (smsSent && emailSent) {
      return 'OTP submitted by SMS and email.';
    }
    if (smsSent) {
      return 'OTP submitted by SMS.';
    }
    if (emailSent) {
      return 'OTP submitted by email.';
    }

    return 'OTP submitted.';
  }

  private otpDeliveryFailureMessage(response: OtpIssueResponse | undefined, fallback: string): string {
    const acknowledged = this.readOtpFlag(
      response?.data,
      'deliveryConfirmed',
      'DeliveryConfirmed',
      'deliveryAcknowledged',
      'DeliveryAcknowledged',
      'acknowledged',
      'Acknowledged',
      'otpSent',
      'OtpSent'
    );

    if (acknowledged === false) {
      return fallback;
    }

    return response?.message || fallback;
  }

  private getExposedOtp(response: OtpIssueResponse | undefined): string {
    const data = response?.data as Record<string, unknown> | undefined;
    const otp = String(data?.['otp'] ?? data?.['Otp'] ?? '').trim();
    return /^\d{6}$/.test(otp) ? otp : '';
  }

  private readOtpFlag(data: OtpIssueResponse['data'] | undefined, ...keys: string[]): boolean | undefined {
    if (!data) return undefined;
    const raw = data as Record<string, unknown>;
    for (const key of keys) {
      if (typeof raw[key] === 'boolean') {
        return raw[key] as boolean;
      }
    }
    return undefined;
  }

  showToast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail, life: 3000 });
  }
}
