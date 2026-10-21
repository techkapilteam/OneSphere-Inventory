import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-inventory-serial-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './inventory-serial-picker-modal.component.html'
})
export class InventorySerialPickerModalComponent {
  @Input({ required: true }) host!: any;

  captureDraft = '';

  rangeFrom = '';
  rangeTo = '';
  rangeError = '';

    // Phase 2 (2.6h): paste from Excel
  pasteOpen = false;
  pasteText = '';
  pasteSkipped: string[] = [];

  addCaptureValue(input?: HTMLInputElement): void {
    const value = this.captureDraft.trim();
    if (!value) return;
    this.host.addSerialPickerCaptureValue(value);
    this.captureDraft = '';
    if (input) setTimeout(() => input.focus());
  }

  // Bulk-generates every serial number between rangeFrom and rangeTo
  // (inclusive) alongside the existing one-at-a-time capture above — this
  // never replaces it, only adds a faster path for sequential runs.
  addSerialRange(): void {
    this.rangeError = '';
    const from = this.rangeFrom.trim();
    const to = this.rangeTo.trim();
    if (!from || !to) {
      this.rangeError = 'Enter both a From and To serial number.';
      return;
    }

    const generated = this.generateSerialRange(from, to);
    if (typeof generated === 'string') {
      this.rangeError = generated;
      return;
    }

    const added = this.host.addSerialPickerRangeValues(generated);
    if (added === 0) {
      this.rangeError = 'All serial numbers in that range are already entered or not needed.';
    } else {
      this.rangeFrom = '';
      this.rangeTo = '';
    }
  }


    togglePaste(): void {
    this.pasteOpen = !this.pasteOpen;
    this.pasteSkipped = [];
    if (!this.pasteOpen) this.pasteText = '';
  }

  applyPaste(): void {
    if (!this.pasteText.trim()) return;
    const result = this.host.applySerialPickerPaste(this.pasteText);
    // Keep the box open only when lines were skipped, so the user can read why
    this.pasteSkipped = result?.skipped || [];
    if (!this.pasteSkipped.length) {
      this.pasteText = '';
      this.pasteOpen = false;
    }
  }

  // Splits each value into a leading prefix + trailing numeric run (e.g.
  // "SN0042" -> prefix "SN", digits "0042"), requires both ends to share the
  // same prefix, and zero-pads generated numbers to the From value's width.
  private generateSerialRange(from: string, to: string): string[] | string {
    const pattern = /^(.*?)(\d+)$/;
    const fromMatch = pattern.exec(from);
    const toMatch = pattern.exec(to);
    if (!fromMatch || !toMatch) {
      return 'Both values must end with a number to generate a range (e.g. SN0001 to SN0010).';
    }

    const [, fromPrefix, fromDigits] = fromMatch;
    const [, toPrefix, toDigits] = toMatch;
    if (fromPrefix !== toPrefix) {
      return 'The From and To serial numbers must share the same prefix.';
    }

    const start = parseInt(fromDigits, 10);
    const end = parseInt(toDigits, 10);
    if (end < start) {
      return 'The To serial number must not be less than the From serial number.';
    }

    const count = end - start + 1;
    if (count > 5000) {
      return `That range has ${count} serial numbers — please narrow it down.`;
    }

    const width = fromDigits.length;
    const result: string[] = [];
    for (let n = start; n <= end; n++) {
      result.push(fromPrefix + String(n).padStart(width, '0'));
    }
    return result;
  }
}
