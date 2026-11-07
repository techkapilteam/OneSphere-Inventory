import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  CategoryItem,
  InventoryConfigService,
  SegmentItem
} from '../../Inventory_Shared/inventory-config.service';
import { applyInventoryTextCase, toInventoryTitleCase } from '../../Inventory_Shared/inventory-text-case.util';
import { businessSegmentsConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { QuickAddCategoryComponent } from '../../Inventory_Shared/quick-add-category/quick-add-category.component';
import { attachInventorySaveToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';

@Component({
  selector: 'app-inventory-business-segments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, InventoryScreenShell, QuickAddCategoryComponent],
  templateUrl: './business-segments.html'
})
export class InventoryBusinessSegmentsComponent implements OnInit {
  private svc = inject(InventoryConfigService);

  segmentName = signal('');
  segmentCode = signal('');
  usageNote = signal('');
  categoryIds = signal<number[]>([]);
  editingId = signal<number | null>(null);

  categories = signal<CategoryItem[]>([]);
  savedSegments = signal<SegmentItem[]>([]);

  readonly existingMatches = computed(() => {
    const q = this.segmentName().trim().toLowerCase();
    if (q.length < 2) return [];
    return this.savedSegments().filter(s =>
      s.segment_name.toLowerCase().includes(q) && s.id !== this.editingId()
    );
  });

  loading = signal(true);
  saving = signal(false);
  saveMsg = signal('');
  saveError = signal('');

  constructor() {
    attachInventorySaveToast(this.saveMsg, this.saveError);
  }

  showCategoryMasterDialog = signal(false);
  pendingCategories = signal<CategoryItem[]>([]);
  savingPendingCategories = signal(false);
  categoryPopupError = signal('');
  readonly businessSegmentsConfig = businessSegmentsConfig;
  readonly categoryNameOptions = computed(() =>
    this.categories().map(item => item.category_name).filter(Boolean)
  );
  readonly categoryCodeOptions = computed(() =>
    this.categories().map(item => item.category_code).filter(Boolean)
  );
  readonly categoryDialogNameOptions = computed(() => [
    ...this.categoryNameOptions(),
    ...this.pendingCategories().map(item => item.category_name).filter(Boolean)
  ]);
  readonly categoryDialogCodeOptions = computed(() => [
    ...this.categoryCodeOptions(),
    ...this.pendingCategories().map(item => item.category_code).filter(Boolean)
  ]);

  ngOnInit(): void {
    this.loadPageData();
  }

  loadPageData(): void {
    this.loading.set(true);
    forkJoin({
      categories: this.svc.getCategories(),
      segments: this.svc.getSegments(true)
    }).subscribe({
      next: ({ categories, segments }) => {
        this.categories.set(this.dedupeByName(categories.data ?? [], item => item.category_name));
        this.savedSegments.set(segments.data ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.saveError.set(err?.error?.message ?? 'Unable to load inventory setup data.');
      }
    });
  }

  saveSegment(): void {
    const name = this.segmentName().trim();
    if (!name) {
      this.saveError.set('Business segment is required.');
      return;
    }
    if (this.savedSegments().some(seg => this.normalizeKey(seg.segment_name) === this.normalizeKey(name) && seg.id !== this.editingId())) {
      this.saveError.set('Business segment already exists. Edit the existing segment instead of adding duplicate.');
      return;
    }

    this.saving.set(true);
    this.saveMsg.set('');
    this.saveError.set('');

    const payload = {
      segment_name: name,
      segment_code: this.segmentCode().trim() || undefined,
      usage_note: this.usageNote().trim() || undefined,
      category_ids: this.categoryIds(),
      hsn_sac_ids: [],
      uom_ids: [],
      status: 'active'
    };

    this.svc.saveSegment(payload, this.editingId()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveMsg.set(this.editingId() ? 'Business segment updated.' : 'Business segment saved.');
        this.clearForm();
        this.refreshSegments();
        setTimeout(() => this.saveMsg.set(''), 4000);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.title ?? err?.error?.message ?? 'Save failed.');
      }
    });
  }

  refreshSegments(): void {
    this.svc.getSegments(true).subscribe({
      next: res => this.savedSegments.set(res.data ?? []),
      error: () => undefined
    });
  }

  onSegmentNameChange(name: string): void {
    const normalizedName = toInventoryTitleCase(name ?? '');
    this.segmentName.set(normalizedName);
    if (!normalizedName.trim()) {
      if (this.editingId() !== null) {
        // Editing a saved segment — name cleared means user wants a fresh form.
        this.clearForm();
      } else {
        // Fresh entry — only clear the auto-generated code.
        this.segmentCode.set('');
      }
      return;
    }
    if (this.editingId() !== null) return;
    this.segmentCode.set(this.autoCode(normalizedName));
  }

  onSegmentCodeChange(code: string): void {
    this.segmentCode.set(String(applyInventoryTextCase(code ?? '', 'upper')));
  }

  onUsageNoteChange(note: string): void {
    this.usageNote.set(String(applyInventoryTextCase(note ?? '', 'sentence')));
  }

  // Global standard code format: PREFIX (first 3 alnum chars of name) - YY - 5-digit sequence.
  // Matches generateCodeFromName() in inventory-screen-shell.ts, used across the other master screens.
  private autoCode(name: string): string {
    const prefix = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (!prefix) return '';
    const yy = new Date().getFullYear().toString().slice(-2);
    const seq = String(this.savedSegments().length + 1).padStart(5, '0');
    return `${prefix}-${yy}-${seq}`;
  }

  private normalizeKey(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private dedupeByName<T>(items: T[], picker: (item: T) => string | undefined): T[] {
    const seen = new Set<string>();
    return [...items]
      .sort((a, b) => String(picker(a) || '').localeCompare(String(picker(b) || '')))
      .filter(item => {
        const key = this.normalizeKey(picker(item));
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  clearForm(): void {
    this.segmentName.set('');
    this.segmentCode.set('');
    this.usageNote.set('');
    this.categoryIds.set([]);
    this.editingId.set(null);
    this.saveError.set('');
  }

  editSegment(seg: SegmentItem): void {
    this.editingId.set(seg.id);
    this.segmentName.set(seg.segment_name);
    this.segmentCode.set(seg.segment_code ?? '');
    this.usageNote.set(seg.usage_note ?? '');
    this.categoryIds.set((seg.categories ?? []).map(c => c.id));
    this.saveError.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  categoryNames(seg: SegmentItem): string {
    return (seg.categories ?? []).map(c => c.category_name).filter(Boolean).join(', ') || '-';
  }

  selectedCategoryCount(): number {
    return this.categoryIds().length;
  }

  openCategoryMasterDialog(): void {
    this.categoryPopupError.set('');
    this.showCategoryMasterDialog.set(true);
  }

  closeCategoryMasterDialog(): void {
    if (this.savingPendingCategories()) return;
    this.showCategoryMasterDialog.set(false);
    this.pendingCategories.set([]);
    this.categoryPopupError.set('');
    this.refreshCategories();
  }

  onQuickCategorySaved(category: CategoryItem): void {
    this.categories.update(list => this.dedupeByName([
      ...list.filter(item => item.id !== category.id),
      category
    ], item => item.category_name));
    if (category.id) {
      this.categoryIds.update(ids => [...new Set([...ids, category.id])]);
    }
    this.showCategoryMasterDialog.set(false);
    this.saveMsg.set('Category added and selected.');
    this.refreshCategories(category);
    setTimeout(() => this.saveMsg.set(''), 4000);
  }

  @ViewChild('stagedCategories') private stagedCategoriesEl?: ElementRef<HTMLElement>;

  /** The add form can be taller than the dialog, so bring the staging grid back
   *  into view after each add — otherwise the only feedback is a count the user
   *  has to go hunting for. */
  private revealStagedCategories(): void {
    setTimeout(() => this.stagedCategoriesEl?.nativeElement
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  onQuickCategoryStaged(category: CategoryItem): void {
    const hasDuplicate = this.pendingCategories().some(item =>
      this.normalizeKey(item.category_name) === this.normalizeKey(category.category_name)
      || this.normalizeKey(item.category_code) === this.normalizeKey(category.category_code)
    );
    if (hasDuplicate) {
      this.categoryPopupError.set('Category already added to temp grid.');
      return;
    }
    this.pendingCategories.update(rows => [...rows, category]);
    this.categoryPopupError.set('');
    this.revealStagedCategories();
  }

  removePendingCategory(index: number): void {
    this.pendingCategories.update(rows => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  savePendingCategories(): void {
    const rows = this.pendingCategories();
    if (!rows.length) {
      this.categoryPopupError.set('Add at least one category to temp grid.');
      return;
    }

    this.savingPendingCategories.set(true);
    this.categoryPopupError.set('');
    const requests = rows.map(row => this.svc.saveCategory(this.categoryPayload(row)).pipe(
      map(res => ({ row, res, error: null as any })),
      catchError(error => of({ row, res: null, error }))
    ));

    forkJoin(requests).subscribe({
      next: results => {
        const savedCategories = results
          .filter(result => result.res?.success && result.res.data)
          .map(result => result.res!.data!);
        const failedRows = results
          .filter(result => !(result.res?.success && result.res.data))
          .map(result => result.row);

        if (savedCategories.length) {
          this.categories.update(list => this.dedupeByName([...list, ...savedCategories], item => item.category_name));
          const savedIds = savedCategories.map(item => item.id).filter(Boolean);
          this.categoryIds.update(ids => [...new Set([...ids, ...savedIds])]);
        }

        this.pendingCategories.set(failedRows);
        this.savingPendingCategories.set(false);

        if (failedRows.length) {
          const firstFailure = results.find(result => !(result.res?.success && result.res.data));
          const message = firstFailure?.res?.message
            ?? firstFailure?.error?.error?.title
            ?? firstFailure?.error?.error?.message
            ?? 'Some categories failed to save.';
          this.categoryPopupError.set(savedCategories.length
            ? `${savedCategories.length} saved. ${failedRows.length} failed. ${message}`
            : message);
          return;
        }

        this.showCategoryMasterDialog.set(false);
        this.saveMsg.set(savedCategories.length === 1 ? 'Category added and selected.' : `${savedCategories.length} categories added and selected.`);
        this.refreshCategories();
        setTimeout(() => this.saveMsg.set(''), 4000);
      },
      error: err => {
        this.savingPendingCategories.set(false);
        this.categoryPopupError.set(err?.error?.title ?? err?.error?.message ?? 'Failed to save categories.');
      }
    });
  }

  private categoryPayload(category: CategoryItem): Record<string, any> {
    return {
      category_code: category.category_code,
      category_name: category.category_name,
      description: category.description ?? '',
      serial_applicable: !!category.serial_applicable,
      serial_policy_id: category.serial_applicable ? category.serial_policy_id ?? null : null,
      serial_policy_name: category.serial_policy_name ?? null,
      batch_applicable: !!category.batch_applicable,
      batch_policy_id: category.batch_applicable ? category.batch_policy_id ?? null : null,
      batch_policy_name: category.batch_policy_name ?? null,
      status: category.status || 'active'
    };
  }

  private refreshCategories(selectCategory?: CategoryItem): void {
    this.svc.getCategories().subscribe({
      next: res => {
        const categories = this.dedupeByName(res.data ?? [], item => item.category_name);
        this.categories.set(categories);
        const categoryId = selectCategory?.id || categories.find(item =>
          this.normalizeKey(item.category_name) === this.normalizeKey(selectCategory?.category_name)
          || this.normalizeKey(item.category_code) === this.normalizeKey(selectCategory?.category_code)
        )?.id;
        if (categoryId) {
          this.categoryIds.update(ids => [...new Set([...ids, categoryId])]);
        }
      },
      error: () => undefined
    });
  }
}
