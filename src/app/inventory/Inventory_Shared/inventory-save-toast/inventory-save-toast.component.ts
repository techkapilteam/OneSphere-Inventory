import { Component, Signal, ViewContainerRef, afterNextRender, computed, effect, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { StickyFooterOffsetService } from '../../../core/services/Common/sticky-footer-offset.service';

type ToastSeverity = 'success' | 'info' | 'error';

// The one PrimeNG toast every Inventory screen uses for notifications, errors and confirmations:
// bottom-right, timed, with an X to close. It sits above a page's own sticky action bar
// (StickyFooterOffsetService) so it never covers the Save buttons. Owns its own MessageService +
// <p-toast>, so it shows up whether Inventory runs standalone or inside the Accounts shell.
@Component({
  selector: 'app-inventory-save-toast',
  standalone: true,
  imports: [ToastModule],
  providers: [MessageService],
  template: '<p-toast position="bottom-right" [style]="{ bottom: toastBottom() }" />'
})
export class InventorySaveToastComponent {
  private readonly messageService = inject(MessageService);
  private readonly footerOffset = inject(StickyFooterOffsetService);
  readonly toastBottom = computed(() => (this.footerOffset.offsetPx() + 24) + 'px');

  show(severity: ToastSeverity, summary: string, detail: string, life: number): void {
    this.messageService.add({ severity, summary, detail, life, closable: true });
  }
}

/**
 * Direct toast for screens that raise messages from their own code (every call shows, even when the
 * text repeats). Call in an injection context (a field initializer). Messages shown before the first
 * render are held and shown once the toast exists.
 */
export function createInventoryToast(): { success(m: string): void; error(m: string): void; info(m: string): void } {
  const viewContainer = inject(ViewContainerRef);
  let toast: InventorySaveToastComponent | null = null;
  const pending: { severity: ToastSeverity; summary: string; detail: string; life: number }[] = [];
  afterNextRender(() => {
    toast = viewContainer.createComponent(InventorySaveToastComponent).instance;
    pending.splice(0).forEach(p => toast!.show(p.severity, p.summary, p.detail, p.life));
  });
  const raise = (severity: ToastSeverity, summary: string, detail: string, life: number) => {
    if (!detail.trim()) return;
    if (toast) toast.show(severity, summary, detail, life); else pending.push({ severity, summary, detail, life });
  };
  const life = (m: string, base: number) => (m.length > 120 ? base + 3500 : base);
  return {
    success: m => raise('success', 'Done', m, life(m, 4500)),
    error: m => raise('error', 'Error', m, life(m, 7000)),
    info: m => raise('info', 'Info', m, life(m, 5000))
  };
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
    toast.show('error', 'Error', message, message.length > 120 ? 10000 : 7000);
  });
}

// ── Page message bars: bring them into view, zoom once, always give them an X ─────────────────────
// Every Inventory screen shows its save / error messages as a bar (.inventory-save-msg / -error).
// On a long form the bar can sit above the fold, so when one appears (or its text changes) the page
// scrolls to it and it zooms in and out once. A bar without its own close button gets an X; the X
// hides the bar until its next message. Installed once, for all screens, when this module loads.
const MESSAGE_BAR = '.inventory-save-msg, .inventory-save-error';

function ensureBarCloseButton(bar: HTMLElement): void {
  if (bar.querySelector('.inventory-alert-close')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'inventory-alert-close';
  button.setAttribute('aria-label', 'Dismiss');
  button.innerHTML = '<i class="pi pi-times"></i>';
  button.addEventListener('click', () => { bar.style.display = 'none'; });
  bar.appendChild(button);
}

function revealMessageBar(bar: HTMLElement): void {
  bar.style.display = '';
  ensureBarCloseButton(bar);
  try {
    bar.animate(
      [{ transform: 'scale(0.94)', opacity: 0.4 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 480, easing: 'ease-out' });
  } catch { /* no Web Animations support: the bar simply appears */ }
  const box = bar.getBoundingClientRect();
  const fullyVisible = box.top >= 64 && box.bottom <= window.innerHeight - 24;
  if (!fullyVisible) bar.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function installMessageBarFocus(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const flag = '__inventoryMessageBarFocus';
  if ((window as any)[flag]) return;
  (window as any)[flag] = true;

  let queued = new Set<HTMLElement>();
  let scheduled = false;
  const barOf = (node: Node | null): HTMLElement | null => {
    const el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
    return el?.closest?.(MESSAGE_BAR) as HTMLElement | null;
  };
  const flush = () => {
    scheduled = false;
    const bars = queued; queued = new Set();
    bars.forEach(revealMessageBar);
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        const bar = barOf(record.target);
        if (bar) queued.add(bar);
        continue;
      }
      record.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) { const bar = barOf(node); if (bar) queued.add(bar); return; }
        if (node.classList.contains('inventory-alert-close')) return;   // our own X
        if (node.matches(MESSAGE_BAR)) queued.add(node);
        else { const bar = barOf(node); if (bar) queued.add(bar); else node.querySelectorAll?.(MESSAGE_BAR).forEach(b => queued.add(b as HTMLElement)); }
      });
    }
    if (queued.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

installMessageBarFocus();
