import { Component, Signal, ViewContainerRef, afterNextRender, effect, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

type ToastSeverity = 'success' | 'info' | 'error';

// Same top-right PrimeNG toast Vendor Payment raises on save
// (payment-receipt-voucher.ts), shared by every Inventory screen. Owns its
// own MessageService + <p-toast> like Vendor Payment does, so it shows up
// whether Inventory runs standalone or inside the Accounts shell.
@Component({
  selector: 'app-inventory-save-toast',
  standalone: true,
  imports: [ToastModule],
  providers: [MessageService],
  template: '<p-toast position="top-right" />'
})
export class InventorySaveToastComponent {
  private readonly messageService = inject(MessageService);

  show(severity: ToastSeverity, summary: string, detail: string, life: number): void {
    this.messageService.add({ severity, summary, detail, life });
  }
}

// saveMsg is also used for plain hints ("No rows available for this
// action.", "Expand a row first..."), so only messages that read as a
// completed action get the green success toast; the rest show as info.
function classifySaveMessage(message: string): { severity: ToastSeverity; summary: string } {
  const text = message.toLowerCase();
  if (/\bposted\b/.test(text)) return { severity: 'success', summary: 'Posted' };
  if (/\bdraft\b/.test(text) && /\bsaved\b/.test(text)) return { severity: 'success', summary: 'Saved as Draft' };
  if (/\bdeleted\b/.test(text)) return { severity: 'success', summary: 'Deleted' };
  if (/\bclosed\b/.test(text)) return { severity: 'success', summary: 'Closed' };
  if (/\bupdated\b/.test(text)) return { severity: 'success', summary: 'Updated' };
  if (/\b(saved|recorded|added|approved|generated|queued|successfully)\b/.test(text)) {
    return { severity: 'success', summary: 'Saved' };
  }
  return { severity: 'info', summary: 'Info' };
}

/**
 * Mirrors a screen's saveMsg / saveError signals into the Vendor Payment
 * style toast. The inline message strip each screen already renders stays
 * as it is. Must be called in an injection context (constructor or field
 * initializer) of the component that owns the signals.
 */
export function attachInventorySaveToast(
  saveMsg: Signal<string>,
  saveError: Signal<string>,
  skip: () => boolean = () => false
): void {
  const viewContainer = inject(ViewContainerRef);
  let toast: InventorySaveToastComponent | null = null;

  // Created after first render (inputs are bound by then, so `skip` can read
  // them) so it never interferes with the host's own view creation; p-toast
  // is position:fixed, so where it sits in the DOM doesn't matter.
  afterNextRender(() => {
    if (skip()) return;
    toast = viewContainer.createComponent(InventorySaveToastComponent).instance;
  });

  effect(() => {
    const message = (saveMsg() || '').trim();
    if (!message || !toast) return;
    const { severity, summary } = classifySaveMessage(message);
    toast.show(severity, summary, message, message.length > 120 ? 8000 : 4500);
  });

  effect(() => {
    const message = (saveError() || '').trim();
    if (!message || !toast) return;
    toast.show('error', 'Error', message, 5000);
  });
}
