import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { catchError, forkJoin, of } from 'rxjs';
import {
  AccessControlService, BranchResponse
} from '../../../core/services/Settings/access-control.service';
import {
  SubscriptionPlan, SubscriptionService
} from '../../../core/services/subscription/subscription.service';
import {
  BranchInvItem, InventoryConfigService, SegmentItem
} from '../../Inventory_Shared/inventory-config.service';
import { applyInventoryTextCase, toInventoryTitleCase } from '../../Inventory_Shared/inventory-text-case.util';
import { branchMasterConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { attachInventorySaveToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';

@Component({
  selector: 'app-inventory-branch-master',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, InventoryScreenShell],
  templateUrl: './branch-master.html'
})
export class InventoryBranchMasterComponent implements OnInit {
  private svc          = inject(InventoryConfigService);
  private access       = inject(AccessControlService);
  private subSvc       = inject(SubscriptionService);

  // ── Form state ────────────────────────────────────────────────────────
  selectedSettingsBranchId = signal<number | null>(null);
  segmentId                = signal<number | null>(null);
  status                   = signal('active');
  editingId                = signal<number | null>(null);

  // ── Quick-add new branch ──────────────────────────────────────────────
  showQuickAdd       = signal(false);
  quickBranchName    = signal('');
  quickBranchCode    = signal('');
  quickBranchSaving  = signal(false);
  quickBranchError   = signal('');

  // ── Reference lists / grids ───────────────────────────────────────────
  settingsBranches = signal<BranchResponse[]>([]);
  segments         = signal<SegmentItem[]>([]);
  savedBranches    = signal<BranchInvItem[]>([]);
  pendingBranches  = signal<any[]>([]);

  readonly selectedSettingsBranch = computed(() =>
    this.settingsBranches().find(b => Number(b.id) === Number(this.selectedSettingsBranchId())) ?? null
  );

  readonly alreadyConfigured = computed(() => {
    const id = this.selectedSettingsBranchId();
    if (!id || this.editingId()) return null;
    const branch = this.savedBranchForOption(id);
    return branch?.id ? branch : null;
  });

  readonly visibleSavedBranches = computed(() => {
    const selectedSegmentId = this.segmentId();
    return selectedSegmentId
      ? this.savedBranches().filter(branch => branch.segment_id === selectedSegmentId)
      : this.savedBranches();
  });

  readonly segmentOptions = computed(() =>
    this.segments().map(item => item.segment_name).filter(Boolean)
  );
  readonly segmentCount = computed(() => this.segmentOptions().length);
  readonly selectedSegment = computed(() =>
    this.segments().find(item => item.id === this.segmentId())?.segment_name ?? ''
  );

  // ── Subscription quota ────────────────────────────────────────────────
  subscription = signal<SubscriptionPlan | null>(null);

  readonly branchLimitReached = computed(() => {
    const s = this.subscription();
    return !!s && s.currentBranchCount >= s.maxBranches;
  });

  readonly userLimitReached = computed(() => {
    const s = this.subscription();
    return !!s && s.currentUserCount >= s.maxUsers;
  });

  // ── Page state ────────────────────────────────────────────────────────
  loading   = signal(true);
  saving    = signal(false);
  saveMsg   = signal('');
  saveError = signal('');

  constructor() {
    attachInventorySaveToast(this.saveMsg, this.saveError);
  }

  readonly upgradeRoute    = '/dashboard/admin/subscription';
  readonly branchMasterConfig = branchMasterConfig;

  ngOnInit(): void {
    forkJoin({
      segments:     this.svc.getSegments(true).pipe(catchError(() => of({ success: false, message: '', data: [] as SegmentItem[] }))),
      branches:     this.svc.getBranchesInv(true).pipe(catchError(() => of({ success: false, message: '', data: [] as BranchInvItem[] }))),
      settings:     this.access.getBranches().pipe(catchError(() => of({ success: false, message: '', data: [] as BranchResponse[] }))),
      subscription: this.subSvc.getSubscription().pipe(catchError(() => of({ success: false, data: null as SubscriptionPlan | null })))
    }).subscribe({
      next: ({ segments, branches, settings, subscription }) => {
        this.segments.set(segments.data       ?? []);
        this.savedBranches.set(branches.data  ?? []);
        this.settingsBranches.set(this.mergeSettingsBranches(
          settings.data ?? [],
          this.registrationBranches(),
          this.inventoryBranchesAsSettings(branches.data ?? [])
        ));
        this.subscription.set(subscription.data ?? null);
        this.applyDefaultSegment();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openQuickAddPopup(): void {
    this.quickBranchName.set('');
    this.quickBranchCode.set('');
    this.quickBranchError.set('');
    this.showQuickAdd.set(true);
  }

  refreshSettingsBranches(): void {
    forkJoin({
      settings: this.access.getBranches().pipe(catchError(() => of({ success: false, message: '', data: [] as BranchResponse[] }))),
      branches: this.svc.getBranchesInv(true).pipe(catchError(() => of({ success: false, message: '', data: [] as BranchInvItem[] })))
    }).subscribe({
      next: ({ settings, branches }) => {
        const inventoryBranches = branches.data ?? [];
        this.savedBranches.set(inventoryBranches);
        this.settingsBranches.set(this.mergeSettingsBranches(
          settings.data ?? [],
          this.registrationBranches(),
          this.inventoryBranchesAsSettings(inventoryBranches)
        ));
      },
      error: () => this.settingsBranches.set(this.mergeSettingsBranches(
        this.settingsBranches(),
        this.registrationBranches(),
        this.inventoryBranchesAsSettings(this.savedBranches())
      ))
    });
  }

  onSegmentChangedByUser(segmentName: string): void {
    const segment = this.segments().find(item => item.segment_name === segmentName);
    this.segmentId.set(segment?.id ?? null);
  }

  onSettingsBranchSelected(id: number | null): void {
    const branchId = Number(id) || null;
    this.selectedSettingsBranchId.set(branchId);
    const configured = this.savedBranchForOption(branchId);
    if (configured?.segment_id || configured?.segment_name) {
      this.segmentId.set(this.resolveSegmentId(configured.segment_id, configured.segment_name));
    }
  }

  // ── Quick-add branch ──────────────────────────────────────────────────
  onQuickNameChange(name: string): void {
    const normalizedName = toInventoryTitleCase(name ?? '');
    this.quickBranchName.set(normalizedName);
    if (!normalizedName.trim()) { this.quickBranchCode.set(''); return; }
    const words = normalizedName.trim().replace(/[^A-Za-z0-9\s]/g, '').split(/\s+/).filter(w => w);
    let base: string;
    if (words.length >= 2) {
      base = words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
    } else if (words.length === 1) {
      base = words[0].substring(0, 3).toUpperCase();
    } else { base = ''; }
    if (!base) { this.quickBranchCode.set(''); return; }
    const seq = String(this.settingsBranches().length + 1).padStart(3, '0');
    this.quickBranchCode.set(`${base}-${seq}`);
  }

  onQuickCodeChange(code: string): void {
    this.quickBranchCode.set(String(applyInventoryTextCase(code ?? '', 'upper')));
  }

  saveQuickBranch(): void {
    const name = this.quickBranchName().trim();
    const code = this.quickBranchCode().trim();
    if (!name) { this.quickBranchError.set('Branch name is required'); return; }
    if (!code) { this.quickBranchError.set('Branch code is required'); return; }
    if (this.branchLimitReached()) {
      this.quickBranchError.set('Branch limit reached. Upgrade your plan to add more branches.');
      return;
    }

    this.quickBranchSaving.set(true);
    this.quickBranchError.set('');
    this.access.createBranch({
      branchName: name,
      branchCode: code,
      isHeadOffice: false,
      status: 'active'
    }).subscribe({
      next: res => {
        const created = res.data;
        this.settingsBranches.set(this.mergeSettingsBranches(this.settingsBranches(), [created]));
        this.selectedSettingsBranchId.set(created.id);
        this.subscription.update(s => s
          ? { ...s, currentBranchCount: s.currentBranchCount + 1 }
          : s
        );
        this.quickBranchSaving.set(false);
        this.quickBranchName.set('');
        this.quickBranchCode.set('');
        this.showQuickAdd.set(false);
      },
      error: err => {
        this.quickBranchSaving.set(false);
        this.quickBranchError.set(err?.error?.message ?? err?.error?.title ?? 'Could not create branch');
      }
    });
  }

  cancelQuickAdd(): void {
    this.showQuickAdd.set(false);
    this.quickBranchName.set('');
    this.quickBranchCode.set('');
    this.quickBranchError.set('');
  }

  segmentName(id: number | null | undefined): string {
    if (!id) return '—';
    return this.segments().find(s => s.id === id)?.segment_name ?? '—';
  }

  // ── Pending / save ────────────────────────────────────────────────────
  addToPending(): void {
    const sb = this.selectedSettingsBranch();
    if (!sb) {
      this.saveError.set('Please select a branch');
      return;
    }
    if (this.segments().length && !this.segmentId()) {
      this.saveError.set('Please select a Business Segment');
      return;
    }
    this.saveError.set('');

    this.pendingBranches.update(rows => [...rows, {
      _key:             Date.now(),
      _editId:          this.editingId(),
      branch_id:        sb.id,
      branch_name:      sb.branchName,
      branch_code:      sb.branchCode,
      segment_id:       this.segmentId(),
      _segment_name:    this.segmentName(this.segmentId()),
      status:           this.status()
    }]);
    this.clearForm();
  }

  removePending(key: number): void {
    this.pendingBranches.update(rows => rows.filter(r => r._key !== key));
  }

  clearForm(): void {
    this.selectedSettingsBranchId.set(null);
    this.status.set('active');
    this.editingId.set(null);
    this.saveError.set('');
    this.cancelQuickAdd();
    this.applyDefaultSegment();
  }

  saveAll(): void {
    if (!this.pendingBranches().length) return;
    this.saving.set(true); this.saveMsg.set(''); this.saveError.set('');

    const batch = this.pendingBranches().map(r => ({
      ...(r._editId ? { id: r._editId } : {}),
      branch_id:      r.branch_id,
      branch_name:    r.branch_name,
      branch_code:    r.branch_code || undefined,
      segment_id:     r.segment_id  ?? undefined,
      status:         r.status
    }));

    this.svc.batchSaveBranchesInv(batch).subscribe({
      next: res => {
        this.pendingBranches.set([]);
        const saved = res.data ?? [];
        this.savedBranches.set(saved);
        this.settingsBranches.set(this.mergeSettingsBranches(
          this.settingsBranches(),
          this.registrationBranches(),
          this.inventoryBranchesAsSettings(saved)
        ));
        this.saving.set(false);
        this.saveMsg.set(`${batch.length} branch configuration(s) saved`);
        setTimeout(() => this.saveMsg.set(''), 4000);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.title ?? err?.error?.message ?? 'Save failed');
      }
    });
  }

  editBranch(br: BranchInvItem): void {
    // Rows sourced only from Settings (not yet configured for inventory) have no id yet —
    // treat as a new inventory config entry rather than an edit.
    const option = this.branchOptionForSavedBranch(br);
    this.editingId.set(br.id ?? null);
    this.selectedSettingsBranchId.set(option?.id ?? br.branch_id ?? null);
    this.segmentId.set(this.resolveSegmentId(br.segment_id, br.segment_name));
    this.status.set((br.status || 'active').toLowerCase());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applyDefaultSegment(): void {
    if (this.segmentId() || !this.segments().length) return;
    this.segmentId.set(this.segments()[0].id);
  }

  private inventoryBranchesAsSettings(branches: BranchInvItem[]): BranchResponse[] {
    const companyId = Number(sessionStorage.getItem('companyId') || 0);
    return branches
      .map((branch): BranchResponse | null => {
        const matched = this.branchOptionForSavedBranch(branch);
        const id = Number(branch.branch_id ?? matched?.id) || 0;
        if (!id) return null;
        return {
          id,
          companyId: branch.company_id || companyId,
          branchCode: branch.branch_code || matched?.branchCode || '',
          branchName: branch.branch_name || matched?.branchName || '',
          email: null,
          mobile: null,
          address: branch.address ?? null,
          city: branch.city ?? null,
          state: branch.state ?? null,
          country: null,
          pincode: branch.pincode ?? null,
          isHeadOffice: !!branch.is_head_office || this.looseKey(branch.branch_code) === 'ho',
          isDefault: !!branch.is_head_office || this.looseKey(branch.branch_code) === 'ho',
          status: branch.status || 'active'
        };
      })
      .filter((branch): branch is BranchResponse => !!branch && !!branch.branchName);
  }

  private savedBranchForOption(branchId: number | null): BranchInvItem | null {
    if (!branchId) return null;
    const option = this.settingsBranches().find(branch => Number(branch.id) === Number(branchId)) ?? null;
    return this.savedBranches().find(branch => Number(branch.branch_id) === Number(branchId))
      ?? (option ? this.savedBranches().find(branch => this.sameBranchIdentity(branch, option)) ?? null : null);
  }

  private branchOptionForSavedBranch(branch: BranchInvItem): BranchResponse | null {
    const directId = Number(branch.branch_id) || 0;
    return this.settingsBranches().find(option => Number(option.id) === directId)
      ?? this.settingsBranches().find(option => this.sameBranchIdentity(branch, option))
      ?? null;
  }

  private sameBranchIdentity(branch: BranchInvItem, option: BranchResponse): boolean {
    const branchCode = this.looseKey(branch.branch_code);
    const optionCode = this.looseKey(option.branchCode);
    if (branchCode && optionCode && branchCode === optionCode) return true;
    const branchName = this.looseKey(branch.branch_name);
    const optionName = this.looseKey(option.branchName);
    return !!branchName && !!optionName && branchName === optionName;
  }

  private resolveSegmentId(segmentId: number | null | undefined, segmentName?: string | null): number | null {
    const directId = Number(segmentId) || 0;
    if (directId && this.segments().some(segment => Number(segment.id) === directId)) return directId;
    const key = this.looseKey(segmentName);
    if (key) {
      const matched = this.segments().find(segment => this.looseKey(segment.segment_name) === key);
      if (matched) return matched.id;
    }
    return this.segmentId() ?? this.segments()[0]?.id ?? null;
  }

  private looseKey(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private registrationBranches(): BranchResponse[] {
    const branches: BranchResponse[] = [];
    try {
      const raw = JSON.parse(sessionStorage.getItem('authBranches') || '[]') as Array<Partial<BranchResponse>>;
      const companyId = Number(sessionStorage.getItem('companyId') || 0);
      branches.push(...raw
        .filter(item => !!item?.id && !!item?.branchName)
        .map(item => ({
          id: Number(item.id),
          companyId,
          branchCode: String(item.branchCode || ''),
          branchName: String(item.branchName || ''),
          email: item.email ?? null,
          mobile: item.mobile ?? null,
          address: item.address ?? null,
          city: item.city ?? null,
          state: item.state ?? null,
          country: item.country ?? null,
          pincode: item.pincode ?? null,
          isHeadOffice: !!item.isHeadOffice,
          isDefault: !!item.isDefault,
          status: item.status || 'active'
        })));
    } catch {}

    branches.push(...this.tenantOptionBranches());
    const current = this.currentSessionBranch();
    if (current) branches.push(current);
    return this.mergeSettingsBranches(branches);
  }

  private mergeSettingsBranches(...groups: BranchResponse[][]): BranchResponse[] {
    const byId = new Set<number>();
    const byCode = new Set<string>();
    const byName = new Set<string>();
    const branches: BranchResponse[] = [];
    for (const branch of groups.flat()) {
      if (!branch || String(branch.status || 'active').toLowerCase() !== 'active') continue;
      const id = Number(branch.id) || 0;
      const code = String(branch.branchCode || '').trim().toLowerCase();
      const name = String(branch.branchName || '').trim().toLowerCase();
      if (id && byId.has(id)) continue;
      if (code && byCode.has(code)) continue;
      if (name && byName.has(name)) continue;
      if (id) byId.add(id);
      if (code) byCode.add(code);
      if (name) byName.add(name);
      branches.push(branch);
    }
    return branches.sort((a, b) =>
      String(a.branchName || '').localeCompare(String(b.branchName || ''))
    );
  }

  private tenantOptionBranches(): BranchResponse[] {
    try {
      const companyId = Number(sessionStorage.getItem('companyId') || 0);
      const raw = JSON.parse(sessionStorage.getItem('authTenantOptions') || '[]') as Array<{
        companyId?: number;
        branches?: Array<Partial<BranchResponse>>;
      }>;
      return raw
        .filter(option => !companyId || Number(option.companyId) === companyId)
        .flatMap(option => option.branches ?? [])
        .filter(item => !!item?.id && !!item?.branchName)
        .map(item => ({
          id: Number(item.id),
          companyId,
          branchCode: String(item.branchCode || ''),
          branchName: String(item.branchName || ''),
          email: item.email ?? null,
          mobile: item.mobile ?? null,
          address: item.address ?? null,
          city: item.city ?? null,
          state: item.state ?? null,
          country: item.country ?? null,
          pincode: item.pincode ?? null,
          isHeadOffice: !!item.isHeadOffice,
          isDefault: !!item.isDefault,
          status: item.status || 'active'
        }));
    } catch {
      return [];
    }
  }

  private currentSessionBranch(): BranchResponse | null {
    try {
      const details = JSON.parse(sessionStorage.getItem('CompanyDetails') || '{}') as Partial<BranchResponse> & {
        branchId?: number;
        branchCode?: string;
        branchName?: string;
      };
      const id = Number(details.branchId || sessionStorage.getItem('branchId') || 0);
      if (!id) return null;

      const rawName = String(details.branchName || '').trim();
      const rawCode = String(details.branchCode || sessionStorage.getItem('branchCode') || '').trim();
      const branchName = rawName || (rawCode.toUpperCase() === 'HO' ? 'Head Office' : '');
      const branchCode = rawCode || (branchName.toLowerCase() === 'head office' ? 'HO' : '');
      if (!branchName) return null;

      return {
        id,
        companyId: Number(sessionStorage.getItem('companyId') || 0),
        branchCode,
        branchName,
        email: null,
        mobile: null,
        address: null,
        city: null,
        state: null,
        country: null,
        pincode: null,
        isHeadOffice: branchName.toLowerCase() === 'head office' || branchCode.toUpperCase() === 'HO',
        isDefault: true,
        status: 'active'
      };
    } catch {
      return null;
    }
  }
}
