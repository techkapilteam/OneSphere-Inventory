import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { purchaseInvoiceConfig } from '../../Inventory_Shared/inventory-screen.model';
import { PurchaseInvoiceAttachment } from '../../Inventory_Shared/inventory-transactions.service';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { InventorySerialPickerModalComponent } from '../../Inventory_Shared/inventory-serial-picker-modal/inventory-serial-picker-modal.component';

import { InventoryTransportDetailsComponent } from '../../Inventory_Shared/inventory-transport-details/inventory-transport-details.component';
import { PurchaseInvoiceAttachmentsComponent } from './purchase-invoice-attachments.component';
import { InventoryLineProductPickerComponent } from '../../Inventory_Shared/inventory-line-product-picker/inventory-line-product-picker.component';

type PendingPurchaseInvoiceAttachmentSaveContext = { existingId: number | null; beforeIds: Set<number>; payload: Record<string, any> };

@Component({
  selector: 'app-inventory-purchase-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent, InventorySerialPickerModalComponent, InventoryTransportDetailsComponent, PurchaseInvoiceAttachmentsComponent, InventoryLineProductPickerComponent],
  templateUrl: './purchase-invoice.html',
  styles: [`
    :host ::ng-deep .purchase-invoice-page .inventory-form-grid {
      align-items: start;
    }

    :host ::ng-deep .purchase-invoice-attachment-field {
      min-width: 0;
    }

    :host ::ng-deep .purchase-invoice-attachment-box--empty {
      display: flex;
      align-items: center;
      min-height: 68px;
      padding: 8px 10px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
    }

    :host .purchase-invoice-compact-check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 9px;
      border: 1px solid #dbe8f9;
      border-radius: 7px;
      background: #fff;
      color: #475569;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
    }

    :host .purchase-invoice-compact-check input {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: #a8552f;
    }

    /* Purchase Invoice used to carry ~70 of its own ::ng-deep grid rules here,
       including a blanket th/td width of 86px that squeezed every column
       to the same width. That is what made this grid look and behave unlike
       every other transaction screen. It now keeps only the one override the
       others keep -- narrowing the Product column from the shared
       .grn-grid-compact base (560px, sized for the old wide ng-select plus its
       stacked Variant/Attribute sub-selects) -- so the grid is identical to
       GRN, Sales Invoice, Purchase Return, Sales Order and the rest. */
    :host ::ng-deep .purchase-invoice-line-grid .erp-table.compact th.inventory-line-col-product,
    :host ::ng-deep .purchase-invoice-line-grid .erp-table.compact td.inventory-line-col-product {
      min-width: 190px;
      width: 190px;
    }

    :host .purchase-invoice-grid-ref-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-height: 26px;
      padding: 0 9px;
      border: 1px solid #bfdbfe;
      border-radius: 7px;
      background: #eff6ff;
      color: #1d4ed8;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
    }

    :host .purchase-invoice-grid-ref-link:disabled {
      cursor: wait;
      opacity: 0.75;
    }

    :host .purchase-invoice-grid-ref-link:hover:not(:disabled),
    :host .purchase-invoice-grid-ref-link:focus-visible {
      border-color: #93c5fd;
      background: #dbeafe;
      outline: none;
    }

    :host .purchase-invoice-reference-modal {
      width: min(680px, calc(100vw - 32px));
    }

    :host .purchase-invoice-reference-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    :host .purchase-invoice-reference-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid #dbe8f9;
      border-radius: 8px;
      background: #f8fafc;
    }

    :host .purchase-invoice-reference-name {
      min-width: 0;
      overflow: hidden;
      color: #1e293b;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host .purchase-invoice-expanded-attachment-modal {
      width: min(960px, calc(100vw - 32px));
    }

    :host .purchase-invoice-expanded-attachment-img {
      display: block;
      max-width: 100%;
      max-height: 70vh;
      margin: 0 auto;
    }

    :host .purchase-invoice-expanded-attachment-frame {
      width: 100%;
      height: 70vh;
      border: 0;
    }

    ::ng-deep body .ng-dropdown-panel.purchase-invoice-grid-select {
      width: max-content !important;
      min-width: 260px !important;
      max-width: min(620px, calc(100vw - 24px)) !important;
    }
  `]
})
export class InventoryPurchaseInvoiceComponent extends InventoryScreenShell implements OnDestroy {
  override readonly config = purchaseInvoiceConfig;
  @ViewChild(PurchaseInvoiceAttachmentsComponent) private purchaseInvoiceAttachments?: PurchaseInvoiceAttachmentsComponent;

  private readonly sanitizer = inject(DomSanitizer);
  private pendingAttachmentResolveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPostSaveAttachmentTargetId: number | null = null;
  private pendingAttachmentFallbackContext: PendingPurchaseInvoiceAttachmentSaveContext | null = null;
  readonly expandedPiAttachments = signal<Record<number, PurchaseInvoiceAttachment[]>>({});
  readonly expandedPiAttachmentLoading = signal<Record<number, boolean>>({});
  readonly expandedPiAttachmentErrors = signal<Record<number, string>>({});
  readonly purchaseInvoiceReferenceModalOpen = signal(false);
  readonly purchaseInvoiceReferenceModalRow = signal<string[] | null>(null);
  readonly expandedAttachmentPreviewOpen = signal(false);
  readonly expandedAttachmentPreviewLoading = signal(false);
  readonly expandedAttachmentPreviewError = signal('');
  readonly expandedAttachmentPreviewName = signal('');
  readonly expandedAttachmentPreviewKind = signal<'image' | 'pdf' | 'other' | null>(null);
  readonly expandedAttachmentPreviewImgUrl = signal<SafeUrl | null>(null);
  readonly expandedAttachmentPreviewFrameUrl = signal<SafeResourceUrl | null>(null);
  private expandedAttachmentPreviewObjectUrl: string | null = null;

  // Auto-opens the Posted GRNs tray once, as soon as the segment is known.
  // This used to fire on fixed 0/350/900ms timers; the 0ms one ran before the
  // segment list loaded, so its request had no segmentId and the tray listed
  // GRNs from every segment on first open.
  private grnTrayAutoOpened = false;
  private readonly autoOpenGrnTray = effect(() => {
    if (this.grnTrayAutoOpened || !this.segmentScopeReady) return;
    this.grnTrayAutoOpened = true;
    untracked(() => {
      const alreadyPicked = String(this.formValues()['grnReference'] || '').trim();
      if (!this.editingId() && !alreadyPicked && !this.refPickerOpen()) {
        this.openPurchaseReferencePicker();
      }
    });
  });

  // transactionLineDisplayColumns()/lineGridRenderColumns() used to be
  // overridden here with a local copy of the MRP/Selling + GRN-linked
  // Qty-column filtering. The base class (InventoryScreenShell) has since
  // grown the exact same purchaseInvoice-aware filtering AND unconditionally
  // strips the 'Variant'/'Attribute' placeholder columns so the shared
  // per-attribute-name sub-row under the Product cell (see purchase-invoice.html's
  // lineGridColumnIsProduct(column) branch, same pattern as GRN/Purchase
  // Return) can take over -- this override never got updated to match, so it
  // kept 'Variant'/'Attribute' as literal dedicated columns and their cell
  // fell back to a single flattened dropdown of every attribute value across
  // every attribute name, with no way to set e.g. RAM and Screen Size
  // independently on one line. Removed in favor of the base class's (now
  // equivalent-or-better) behavior; see inventory-screen-shell.ts's
  // transactionLineDisplayColumns() and lineGridRenderColumns().

  togglePurchaseInvoiceExpandedRow(row: string[]): void {
    this.toggleExpandGrn(row);
    if (!this.isExpandedGrn(row)) return;
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    if (invoiceId) this.loadExpandedPiAttachments(invoiceId);
  }

  openPurchaseInvoiceAttachmentRefs(row: string[]): void {
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    if (!invoiceId) return;
    this.purchaseInvoiceReferenceModalRow.set(row);
    this.purchaseInvoiceReferenceModalOpen.set(true);
    this.loadExpandedPiAttachments(invoiceId, true);
  }

  closePurchaseInvoiceReferenceModal(): void {
    this.purchaseInvoiceReferenceModalOpen.set(false);
    this.purchaseInvoiceReferenceModalRow.set(null);
  }

  onPurchaseInvoiceAttachmentListChange(attachments: PurchaseInvoiceAttachment[]): void {
    const invoiceId = Number(
      this.editingId()
      || attachments.find(attachment => Number(attachment.purchaseInvoiceId || 0) > 0)?.purchaseInvoiceId
      || 0
    );
    if (!invoiceId) return;
    this.expandedPiAttachmentErrors.update(state => ({ ...state, [invoiceId]: '' }));
    this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: false }));
    this.expandedPiAttachments.update(state => ({ ...state, [invoiceId]: attachments }));
  }

  onPurchaseInvoiceAttachmentSaveComplete(event: { purchaseInvoiceId: number; attachment: PurchaseInvoiceAttachment | null }): void {
    const invoiceId = Number(event.purchaseInvoiceId || 0);
    if (!invoiceId) return;

    this.expandedPiAttachmentErrors.update(state => ({ ...state, [invoiceId]: '' }));
    this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: false }));
    if (event.attachment) {
      this.expandedPiAttachments.update(state => {
        const current = state[invoiceId] || [];
        const withoutDuplicate = current.filter(attachment => Number(attachment.id) !== Number(event.attachment?.id));
        return { ...state, [invoiceId]: [event.attachment as PurchaseInvoiceAttachment, ...withoutDuplicate] };
      });
    } else {
      this.loadExpandedPiAttachments(invoiceId, true);
    }

    this.loadApiRecords();
    if (this.pendingPostSaveAttachmentTargetId === invoiceId) {
      this.pendingPostSaveAttachmentTargetId = null;
      this.pendingAttachmentFallbackContext = null;
      this.purchaseInvoiceAttachments?.resetForNewInvoice();
    }
  }

  onPurchaseInvoiceAttachmentSaveFailed(event: { purchaseInvoiceId: number; message: string }): void {
    const invoiceId = Number(event.purchaseInvoiceId || 0);
    if (invoiceId) {
      this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: false }));
      this.expandedPiAttachmentErrors.update(state => ({ ...state, [invoiceId]: event.message }));
    }
    if (!invoiceId || this.pendingPostSaveAttachmentTargetId === invoiceId) {
      this.pendingPostSaveAttachmentTargetId = null;
      this.pendingAttachmentFallbackContext = null;
    }
  }

  purchaseInvoiceIsPostedRow(row: string[]): boolean {
    const record = this.purchaseInvoiceRecordForRow(row);
    return String(record?.status || row?.[row.length - 1] || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '') === 'posted';
  }

  purchaseInvoiceAttachmentGridLabel(row: string[]): string {
    if (this.expandedPiAttachmentLoadingForRow(row)) return 'Loading';
    if (this.expandedPiAttachmentErrorForRow(row)) return 'Ref error';
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    if (!invoiceId || !this.expandedPiAttachmentCacheHas(invoiceId)) return 'View Ref';
    const count = this.expandedPiAttachmentRefs(row).length;
    return count ? `${count} Ref${count === 1 ? '' : 's'}` : 'View Ref';
  }

  purchaseInvoiceAttachmentGridTitle(row: string[]): string {
    const label = this.purchaseInvoiceAttachmentGridLabel(row);
    return label === 'View Ref' ? 'Load reference' : 'View reference';
  }

  purchaseInvoiceReferenceModalTitle(): string {
    const row = this.purchaseInvoiceReferenceModalRow();
    return row?.[0] ? `Reference - ${row[0]}` : 'Reference';
  }

  purchaseInvoiceReferenceModalRefs(): PurchaseInvoiceAttachment[] {
    const row = this.purchaseInvoiceReferenceModalRow();
    return row ? this.expandedPiAttachmentRefs(row) : [];
  }

  purchaseInvoiceReferenceModalLoading(): boolean {
    const row = this.purchaseInvoiceReferenceModalRow();
    return !!row && this.expandedPiAttachmentLoadingForRow(row);
  }

  purchaseInvoiceReferenceModalError(): string {
    const row = this.purchaseInvoiceReferenceModalRow();
    return row ? this.expandedPiAttachmentErrorForRow(row) : '';
  }

  expandedPiAttachmentRefs(row: string[]): PurchaseInvoiceAttachment[] {
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    return invoiceId ? (this.expandedPiAttachments()[invoiceId] || []) : [];
  }

  expandedPiAttachmentLoadingForRow(row: string[]): boolean {
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    return !!invoiceId && !!this.expandedPiAttachmentLoading()[invoiceId];
  }

  expandedPiAttachmentErrorForRow(row: string[]): string {
    const invoiceId = this.purchaseInvoiceIdForRow(row);
    return invoiceId ? (this.expandedPiAttachmentErrors()[invoiceId] || '') : '';
  }

  previewExpandedPiAttachment(attachment: PurchaseInvoiceAttachment): void {
    this.expandedAttachmentPreviewOpen.set(true);
    this.expandedAttachmentPreviewLoading.set(true);
    this.expandedAttachmentPreviewError.set('');
    this.expandedAttachmentPreviewName.set(attachment.fileName);
    const kind = this.classifyAttachment(attachment.fileName);
    this.expandedAttachmentPreviewKind.set(kind);

    this.txService.downloadS3File('PurchaseInvoiceAttachment', attachment.fileKey).subscribe({
      next: blob => {
        this.expandedAttachmentPreviewLoading.set(false);
        this.revokeExpandedAttachmentPreviewUrl();
        const url = URL.createObjectURL(blob);
        this.expandedAttachmentPreviewObjectUrl = url;
        if (kind === 'image') {
          this.expandedAttachmentPreviewImgUrl.set(this.sanitizer.bypassSecurityTrustUrl(url));
        } else if (kind === 'pdf') {
          this.expandedAttachmentPreviewFrameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        }
      },
      error: err => {
        this.expandedAttachmentPreviewLoading.set(false);
        this.expandedAttachmentPreviewError.set(this.apiErrorMessage(err, 'Could not load this file for preview.'));
      }
    });
  }

  closeExpandedPiAttachmentPreview(): void {
    this.expandedAttachmentPreviewOpen.set(false);
    this.expandedAttachmentPreviewLoading.set(false);
    this.expandedAttachmentPreviewError.set('');
    this.expandedAttachmentPreviewName.set('');
    this.expandedAttachmentPreviewKind.set(null);
    this.expandedAttachmentPreviewImgUrl.set(null);
    this.expandedAttachmentPreviewFrameUrl.set(null);
    this.revokeExpandedAttachmentPreviewUrl();
  }

  override ngOnDestroy(): void {
    this.closeExpandedPiAttachmentPreview();
    super.ngOnDestroy?.();
  }

  protected override afterConfigRecordSaved(savedRecord: any, payload: Record<string, any>, forceDocumentStatus?: 'draft' | 'posted' | 'sent'): void {
    super.afterConfigRecordSaved(savedRecord, payload, forceDocumentStatus);
    const savedId = this.savedPurchaseInvoiceId(savedRecord);
    this.closePurchaseInvoiceReferenceModal();
    this.closeExpandedPiAttachmentPreview();
    if (!this.purchaseInvoiceAttachments?.hasPendingAttachment()) {
      this.pendingPostSaveAttachmentTargetId = null;
      this.pendingAttachmentFallbackContext = null;
      return;
    }
    if (!savedId) {
      const fallback = this.pendingAttachmentFallbackContext;
      if (fallback) {
        this.resolvePendingAttachmentAfterSave(fallback);
      } else {
        this.purchaseInvoiceAttachments.setPendingAttachmentMessage('Invoice saved, but the saved PI id was not returned. Reopen the saved PI and attach again.');
      }
      return;
    }
    this.pendingAttachmentFallbackContext = null;
    this.pendingPostSaveAttachmentTargetId = savedId;
    this.expandedPiAttachmentErrors.update(state => ({ ...state, [savedId]: '' }));
    this.purchaseInvoiceAttachments.attachPendingToPurchaseInvoice(savedId);
  }

  override savePurchaseInvoiceDraft(): void {
    this.pendingAttachmentFallbackContext = this.preparePendingAttachmentSave();
    super.savePurchaseInvoiceDraft();
  }

  override postPurchaseInvoice(): void {
    this.pendingAttachmentFallbackContext = this.preparePendingAttachmentSave();
    super.postPurchaseInvoice();
  }

  private purchaseInvoiceRecordForRow(row: string[]): any | null {
    const piNo = String(row?.[0] || '').trim();
    if (!piNo) return null;
    return this.savedRecordObjects().find(record =>
      String(record?.pi_number ?? record?.piNumber ?? '').trim() === piNo
    ) || null;
  }

  private purchaseInvoiceIdForRow(row: string[]): number | null {
    const id = Number(this.purchaseInvoiceRecordForRow(row)?.id || 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private expandedPiAttachmentCacheHas(invoiceId: number): boolean {
    return Object.prototype.hasOwnProperty.call(this.expandedPiAttachments(), invoiceId);
  }

  private loadExpandedPiAttachments(invoiceId: number, force = false): void {
    if (this.expandedPiAttachmentLoading()[invoiceId]) return;
    if (!force && this.expandedPiAttachmentCacheHas(invoiceId)) return;
    this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: true }));
    this.expandedPiAttachmentErrors.update(state => ({ ...state, [invoiceId]: '' }));
    this.txService.getPurchaseInvoiceAttachments(invoiceId).subscribe({
      next: res => {
        this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: false }));
        this.expandedPiAttachments.update(state => ({ ...state, [invoiceId]: res.data || [] }));
      },
      error: err => {
        this.expandedPiAttachmentLoading.update(state => ({ ...state, [invoiceId]: false }));
        this.expandedPiAttachmentErrors.update(state => ({ ...state, [invoiceId]: this.apiErrorMessage(err, 'Could not load attachment PI refs.') }));
      }
    });
  }

  private classifyAttachment(fileName: string): 'image' | 'pdf' | 'other' {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'other';
  }

  private revokeExpandedAttachmentPreviewUrl(): void {
    if (!this.expandedAttachmentPreviewObjectUrl) return;
    URL.revokeObjectURL(this.expandedAttachmentPreviewObjectUrl);
    this.expandedAttachmentPreviewObjectUrl = null;
  }

  private savedPurchaseInvoiceId(savedRecord: any): number {
    const id = Number(
      savedRecord?.id
      ?? savedRecord?.purchaseInvoiceId
      ?? savedRecord?.purchase_invoice_id
      ?? savedRecord?.piId
      ?? savedRecord?.pi_id
      ?? this.editingId()
      ?? 0
    );
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private preparePendingAttachmentSave(): PendingPurchaseInvoiceAttachmentSaveContext | null {
    const attachmentPanel = this.purchaseInvoiceAttachments;
    if (!attachmentPanel?.hasPendingAttachment()) return null;
    return {
      existingId: this.editingId(),
      beforeIds: new Set(this.savedRecordObjects().map(record => Number(record?.id)).filter(id => Number.isFinite(id) && id > 0)),
      payload: this.buildPayload()
    };
  }

  private resolvePendingAttachmentAfterSave(context: PendingPurchaseInvoiceAttachmentSaveContext): void {
    if (this.pendingAttachmentResolveTimer) {
      clearTimeout(this.pendingAttachmentResolveTimer);
      this.pendingAttachmentResolveTimer = null;
    }

    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (!this.purchaseInvoiceAttachments?.hasPendingAttachment()) return;
      if (this.isSaving()) {
        this.pendingAttachmentResolveTimer = setTimeout(tick, 250);
        return;
      }
      if (this.saveError()) return;

      const existingId = Number(context.existingId || 0);
      if (existingId > 0) {
        this.pendingPostSaveAttachmentTargetId = existingId;
        this.expandedPiAttachmentErrors.update(state => ({ ...state, [existingId]: '' }));
        this.purchaseInvoiceAttachments.attachPendingToPurchaseInvoice(existingId);
        return;
      }

      const localMatch = this.findSavedPurchaseInvoiceForPendingAttachment(this.savedRecordObjects(), context);
      if (localMatch) {
        this.reopenSavedPurchaseInvoiceAndAttach(localMatch);
        return;
      }

      this.txService.getPurchaseInvoices(undefined, this.currentSegmentId).subscribe({
        next: res => {
          const records = Array.isArray(res.data) ? res.data : [];
          if (records.length) this.savedRecordObjects.set(records);
          const match = this.findSavedPurchaseInvoiceForPendingAttachment(records, context);
          if (match) {
            this.reopenSavedPurchaseInvoiceAndAttach(match);
            return;
          }
          if (attempts < 20) {
            this.pendingAttachmentResolveTimer = setTimeout(tick, 350);
          } else {
            this.purchaseInvoiceAttachments?.setPendingAttachmentMessage('Draft saved. Click Edit on the saved PI to finish attaching the selected file.');
          }
        },
        error: err => {
          if (attempts < 20) {
            this.pendingAttachmentResolveTimer = setTimeout(tick, 500);
          } else {
            this.purchaseInvoiceAttachments?.setPendingAttachmentMessage(this.apiErrorMessage(err, 'Draft saved, but the attachment could not be linked yet. Click Edit and attach again.'));
          }
        }
      });
    };

    this.pendingAttachmentResolveTimer = setTimeout(tick, 250);
  }

  private findSavedPurchaseInvoiceForPendingAttachment(records: any[], context: PendingPurchaseInvoiceAttachmentSaveContext): any | null {
    const normalize = (value: any) => String(value ?? '').trim().toLowerCase();
    const piNo = normalize(context.payload['pi_number']);
    const vendorInvoiceNo = normalize(context.payload['vendor_invoice_no']);
    const vendorId = Number(context.payload['vendor_id'] || 0);
    const piDate = normalize(context.payload['pi_date']);

    const candidates = records
      .filter(record => {
        const id = Number(record?.id);
        return Number.isFinite(id) && id > 0 && !context.beforeIds.has(id);
      })
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

    return candidates.find(record => piNo && normalize(record?.pi_number ?? record?.piNumber) === piNo)
      || candidates.find(record => vendorInvoiceNo && normalize(record?.vendor_invoice_no ?? record?.vendorInvoiceNo) === vendorInvoiceNo)
      || candidates.find(record => vendorId > 0 && Number(record?.vendor_id ?? record?.vendorId ?? 0) === vendorId && (!piDate || normalize(record?.pi_date ?? record?.piDate) === piDate))
      || candidates[0]
      || null;
  }

  private reopenSavedPurchaseInvoiceAndAttach(record: any): void {
    const savedId = Number(record?.id || 0);
    if (!savedId) return;
    this.pendingPostSaveAttachmentTargetId = savedId;
    this.expandedPiAttachmentErrors.update(state => ({ ...state, [savedId]: '' }));
    this.purchaseInvoiceAttachments?.attachPendingToPurchaseInvoice(savedId);
  }
}
