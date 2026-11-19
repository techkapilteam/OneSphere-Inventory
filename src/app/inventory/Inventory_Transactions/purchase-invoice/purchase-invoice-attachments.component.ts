import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { InventoryTransactionsService, PurchaseInvoiceAttachment } from '../../Inventory_Shared/inventory-transactions.service';

// Item 11 — Purchase Invoice attachments upload + preview. Deliberately
// bespoke to this one screen (not a generic Inventory_Shared component like
// Transport Details / Bank Details) per the task's explicit scope: attach
// only to Purchase Invoice, don't touch any other transaction screen.
//
// Reuses the already-existing S3 plumbing server-side through a PI-specific
// endpoint:
//   - upload + metadata save:
//              POST /inventory/transactions/purchase-invoices/{id}/attachments/upload
//   - preview: InventoryTransactionsService.downloadS3File(...)
//              -> generic GET /api/Accounts/DownloadImage/{formName}/{fileName}
//   - list/delete metadata: purchase-invoices/{id}/
//     attachments endpoints added for this item (147_purchase_invoice_
//     attachments.sql + InventoryTransactionsController).
//
// The host renders this beside Remarks even before a Purchase Invoice has an
// id. In that new-record state the picked file is kept as a local pending
// selection, then the Purchase Invoice host calls attachPendingToPurchaseInvoice
// after Save Draft/Post returns a saved PI id.
@Component({
  selector: 'app-purchase-invoice-attachments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-invoice-attachments.component.html',
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .purchase-invoice-attachment-field {
      min-width: 0;
    }

    .purchase-invoice-attachment-box {
      min-height: 68px;
      padding: 6px;
      border: 1px solid #dbe8f9;
      border-radius: 8px;
      background: #fff;
    }

    .purchase-invoice-attachment-box.is-required-missing {
      border-color: #dc2626;
      box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
    }

    .purchase-invoice-attachment-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }

    .purchase-invoice-file-picker {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      height: 28px;
      min-width: 74px;
      padding: 0 9px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
    }

    .purchase-invoice-file-picker input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .purchase-invoice-file-picker.is-disabled {
      opacity: 0.65;
      cursor: wait;
    }

    .purchase-invoice-file-picker.is-disabled input {
      cursor: wait;
    }

    .purchase-invoice-attachment-state {
      overflow: hidden;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .purchase-invoice-attachment-refs {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      min-height: 24px;
      margin-top: 6px;
    }

    .purchase-invoice-attachment-empty {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      color: #94a3b8;
      font-size: 11px;
    }

    .purchase-invoice-attachment-ref-row {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      padding: 2px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      background: #f8fafc;
    }

    .purchase-invoice-attachment-ref-row--pending {
      max-width: 100%;
      border-color: #fed7aa;
      background: #fff7ed;
    }

    .purchase-invoice-attachment-pending {
      display: inline-block;
      max-width: 170px;
      overflow: hidden;
      padding: 0 6px;
      color: #8b451f;
      font-size: 11px;
      font-weight: 700;
      line-height: 22px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .purchase-invoice-attachment-ref-link {
      display: inline-flex;
      align-items: center;
      height: 22px;
      max-width: 74px;
      padding: 0 7px;
      border: 0;
      border-radius: 5px;
      background: #fff;
      color: #8b451f;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      text-decoration: underline;
      text-underline-offset: 2px;
      white-space: nowrap;
    }

    .purchase-invoice-attachment-ref-link:hover,
    .purchase-invoice-attachment-ref-link:focus-visible {
      color: #a8552f;
      outline: none;
      box-shadow: 0 0 0 2px rgba(168, 85, 47, 0.18);
    }

    .purchase-invoice-attachment-icon {
      width: 22px;
      height: 22px;
      min-width: 22px;
      padding: 0;
      border-radius: 5px;
      font-size: 10px;
    }

    .purchase-invoice-attachment-error {
      margin: 6px 0 0;
      padding: 5px 7px;
      font-size: 11px;
    }

    .purchase-invoice-attachment-modal {
      width: min(960px, calc(100vw - 32px));
    }

    .purchase-invoice-attachment-preview-img {
      display: block;
      max-width: 100%;
      max-height: 70vh;
      margin: 0 auto;
    }

    .purchase-invoice-attachment-preview-frame {
      width: 100%;
      height: 70vh;
      border: 0;
    }
  `]
})
export class PurchaseInvoiceAttachmentsComponent implements OnChanges {
  @Input() purchaseInvoiceId = 0;
  @Output() readonly attachmentListChange = new EventEmitter<PurchaseInvoiceAttachment[]>();
  @Output() readonly attachmentSaveComplete = new EventEmitter<{ purchaseInvoiceId: number; attachment: PurchaseInvoiceAttachment | null }>();
  @Output() readonly attachmentSaveFailed = new EventEmitter<{ purchaseInvoiceId: number; message: string }>();

  private readonly txService = inject(InventoryTransactionsService);
  private readonly sanitizer = inject(DomSanitizer);

  private static readonly ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx', 'csv'];
  private static readonly MAX_SIZE_BYTES = 25 * 1024 * 1024;
  readonly acceptAttr = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv';

  readonly attachments = signal<PurchaseInvoiceAttachment[]>([]);
  readonly loading = signal(false);
  readonly listError = signal('');
  readonly uploadPending = signal(false);
  readonly uploadError = signal('');
  readonly deletingId = signal<number | null>(null);
  readonly pendingFileName = signal('');
  // Attachment PI Ref is mandatory: set when Save Draft / Post is attempted
  // with no file picked and none already saved on the PI.
  readonly requiredError = signal(false);

  readonly previewOpen = signal(false);
  readonly previewLoading = signal(false);
  readonly previewError = signal('');
  readonly previewName = signal('');
  readonly previewKind = signal<'image' | 'pdf' | 'other' | null>(null);
  readonly previewImgUrl = signal<SafeUrl | null>(null);
  readonly previewFrameUrl = signal<SafeResourceUrl | null>(null);

  private previewObjectUrl: string | null = null;
  private pendingFile: File | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['purchaseInvoiceId']) return;
    this.requiredError.set(false);
    const invoiceId = Number(this.purchaseInvoiceId || 0);
    if (invoiceId) {
      this.loadAttachments();
      if (this.pendingFile) this.attachPendingToPurchaseInvoice(invoiceId);
      return;
    }
    if (!this.uploadPending() && !this.pendingFile) {
      this.clearCurrentAttachmentView();
    }
  }

  loadAttachments(): void {
    if (!this.purchaseInvoiceId) return;
    this.loading.set(true);
    this.listError.set('');
    this.txService.getPurchaseInvoiceAttachments(this.purchaseInvoiceId).subscribe({
      next: res => {
        this.loading.set(false);
        this.attachments.set(res.data || []);
        this.attachmentListChange.emit(this.attachments());
      },
      error: err => {
        this.loading.set(false);
        this.listError.set(this.errorMessage(err, 'Could not load attachments.'));
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!this.validateFile(file)) {
      input.value = '';
      return;
    }

    this.uploadError.set('');
    this.listError.set('');
    this.requiredError.set(false);
    if (!this.purchaseInvoiceId) {
      this.pendingFile = file;
      this.pendingFileName.set(file.name);
      input.value = '';
      return;
    }

    this.uploadFile(file, input);
  }

  hasPendingAttachment(): boolean {
    return !!this.pendingFile;
  }

  /** True when a file is picked (new PI) or at least one ref is already saved on this PI. */
  hasAnyAttachment(): boolean {
    return !!this.pendingFile || this.attachments().length > 0;
  }

  isBusy(): boolean {
    return this.loading() || this.uploadPending();
  }

  showRequiredError(show: boolean): void {
    this.requiredError.set(show);
  }

  attachPendingToPurchaseInvoice(purchaseInvoiceId: number): void {
    if (!this.pendingFile || !purchaseInvoiceId || this.uploadPending()) return;
    this.purchaseInvoiceId = purchaseInvoiceId;
    this.uploadFile(this.pendingFile);
  }

  clearPendingAttachment(): void {
    this.pendingFile = null;
    this.pendingFileName.set('');
    this.uploadError.set('');
  }

  resetForNewInvoice(): void {
    this.purchaseInvoiceId = 0;
    this.requiredError.set(false);
    this.clearPendingAttachment();
    this.clearCurrentAttachmentView();
    this.closePreview();
  }

  setPendingAttachmentMessage(message: string): void {
    this.uploadError.set(message);
  }

  private validateFile(file: File): boolean {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!PurchaseInvoiceAttachmentsComponent.ALLOWED_EXTENSIONS.includes(ext)) {
      this.uploadError.set(`".${ext}" files aren't allowed. Allowed types: PDF, JPG, PNG, DOCX, XLSX, CSV.`);
      return false;
    }
    if (file.size > PurchaseInvoiceAttachmentsComponent.MAX_SIZE_BYTES) {
      this.uploadError.set('File exceeds the 25 MB upload limit.');
      return false;
    }
    return true;
  }

  private uploadFile(file: File, input?: HTMLInputElement): void {
    const targetPurchaseInvoiceId = Number(this.purchaseInvoiceId || 0);
    if (!targetPurchaseInvoiceId) {
      this.pendingFile = file;
      this.pendingFileName.set(file.name);
      if (input) input.value = '';
      return;
    }

    this.uploadError.set('');
    this.uploadPending.set(true);

    this.txService.uploadPurchaseInvoiceAttachment(targetPurchaseInvoiceId, file).subscribe({
      next: res => {
        this.uploadPending.set(false);
        if (input) input.value = '';
        this.clearPendingAttachment();
        const savedAttachment = res.data ? res.data as PurchaseInvoiceAttachment : null;
        if (res.data) {
          this.attachments.update(list => [savedAttachment as PurchaseInvoiceAttachment, ...list]);
          this.attachmentListChange.emit(this.attachments());
        } else {
          this.loadAttachments();
        }
        this.attachmentSaveComplete.emit({ purchaseInvoiceId: targetPurchaseInvoiceId, attachment: savedAttachment });
      },
      error: err => {
        this.uploadPending.set(false);
        if (input) input.value = '';
        const message = this.errorMessage(err, 'Attachment upload failed - try again.');
        this.uploadError.set(message);
        this.attachmentSaveFailed.emit({ purchaseInvoiceId: targetPurchaseInvoiceId, message });
      }
    });
  }

  preview(attachment: PurchaseInvoiceAttachment): void {
    this.previewOpen.set(true);
    this.previewLoading.set(true);
    this.previewError.set('');
    this.previewName.set(attachment.fileName);
    const kind = this.classify(attachment.fileName);
    this.previewKind.set(kind);

    this.txService.downloadS3File('PurchaseInvoiceAttachment', attachment.fileKey).subscribe({
      next: blob => {
        this.previewLoading.set(false);
        this.revokePreviewUrl();
        const url = URL.createObjectURL(blob);
        this.previewObjectUrl = url;
        if (kind === 'image') {
          this.previewImgUrl.set(this.sanitizer.bypassSecurityTrustUrl(url));
        } else if (kind === 'pdf') {
          this.previewFrameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        }
      },
      error: err => {
        this.previewLoading.set(false);
        this.previewError.set(this.errorMessage(err, 'Could not load this file for preview.'));
      }
    });
  }

  closePreview(): void {
    this.previewOpen.set(false);
    this.previewLoading.set(false);
    this.previewError.set('');
    this.previewName.set('');
    this.previewKind.set(null);
    this.previewImgUrl.set(null);
    this.previewFrameUrl.set(null);
    this.revokePreviewUrl();
  }

  download(attachment: PurchaseInvoiceAttachment): void {
    this.txService.downloadS3File('PurchaseInvoiceAttachment', attachment.fileKey).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: err => this.listError.set(this.errorMessage(err, 'Download failed — try again.'))
    });
  }

  remove(attachment: PurchaseInvoiceAttachment): void {
    if (!confirm(`Remove "${attachment.fileName}"? This cannot be undone.`)) return;
    this.deletingId.set(attachment.id);
    this.txService.deletePurchaseInvoiceAttachment(this.purchaseInvoiceId, attachment.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.attachments.update(list => list.filter(a => a.id !== attachment.id));
        this.attachmentListChange.emit(this.attachments());
      },
      error: err => {
        this.deletingId.set(null);
        this.listError.set(this.errorMessage(err, 'Delete failed — try again.'));
      }
    });
  }

  formatSize(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '';
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
  }

  private classify(fileName: string): 'image' | 'pdf' | 'other' {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return 'other';
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  private clearCurrentAttachmentView(): void {
    this.attachments.set([]);
    this.loading.set(false);
    this.listError.set('');
    this.uploadError.set('');
    this.deletingId.set(null);
    this.attachmentListChange.emit([]);
  }

  private errorMessage(err: any, fallback: string): string {
    const body = err?.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body?.message) return String(body.message);
    if (err?.message) return String(err.message);
    return fallback;
  }
}
