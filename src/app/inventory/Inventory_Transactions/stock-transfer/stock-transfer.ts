import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { stockTransferConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { InventorySerialPickerModalComponent } from '../../Inventory_Shared/inventory-serial-picker-modal/inventory-serial-picker-modal.component';

import { InventoryTransportDetailsComponent } from '../../Inventory_Shared/inventory-transport-details/inventory-transport-details.component';
import { InventoryLineProductPickerComponent } from '../../Inventory_Shared/inventory-line-product-picker/inventory-line-product-picker.component';

@Component({
  selector: 'app-inventory-stock-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent, InventorySerialPickerModalComponent, InventoryTransportDetailsComponent, InventoryLineProductPickerComponent],
  templateUrl: './stock-transfer.html',
  styles: [`
    // Product Picker popup pilot: Stock Transfer's grid was migrated from its
    // own bespoke per-cell rendering onto the same lineGridRenderColumns()/
    // entryLineRowViews() skeleton Sales/Purchase Invoice already use, so
    // Variant/Attribute fold into the Product cell (2 fewer rendered columns)
    // and the Product cell itself is now the compact
    // <app-inventory-line-product-picker> trigger instead of a wide
    // ng-select + stacked sub-selects. Scoped to .stock-transfer-line-grid
    // only (added alongside .inventory-line-items in stock-transfer.html) --
    // mirrors Purchase Invoice's own proven per-screen compaction pattern
    // instead of editing either repo's shared styles.scss, which every
    // other (non-pilot) screen's still-wide dropdown still relies on.
    :host ::ng-deep .stock-transfer-line-grid .erp-table.compact th.inventory-line-col-product,
    :host ::ng-deep .stock-transfer-line-grid .erp-table.compact td.inventory-line-col-product {
      min-width: 200px;
      width: 200px;
    }

    :host ::ng-deep .stock-transfer-line-grid .erp-table.compact td.inventory-line-col-product {
      padding: 5px 4px !important;
      vertical-align: top;
    }

    :host ::ng-deep .stock-transfer-line-grid .inventory-line-product-trigger {
      min-height: 30px;
      padding: 0 8px;
      border-radius: 6px;
      font-size: 12px;
    }
  `]
})
export class InventoryStockTransferComponent extends InventoryScreenShell {
  override readonly config = stockTransferConfig;
}
