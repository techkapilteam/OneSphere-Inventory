import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { categoryMasterConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';

@Component({
  selector: 'app-inventory-category-master',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent],
  templateUrl: './category-master.html'
})
export class InventoryCategoryMasterComponent extends InventoryScreenShell {
  // Not readonly: unlike the other single-purpose master screens, this one is also
  // embedded (via its selector) inside Business Segment configuration, which requires
  // Angular to be able to bind the required `config` input explicitly at that call site.
  override config = categoryMasterConfig;

  readonly uinGuideVisible = signal(false);
}
