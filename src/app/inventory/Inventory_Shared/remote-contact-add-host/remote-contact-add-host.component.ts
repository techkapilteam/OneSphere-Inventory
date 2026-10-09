import {
  Component,
  ComponentRef,
  EnvironmentInjector,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef,
  inject,
  runInInjectionContext
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/native-federation';

/**
 * Dynamically loads the real "Add New Contact" form from the Accounts app
 * (federation remote `global-erp`, exposed module `./ContactAdd`) instead of
 * re-implementing it here. Falls back gracefully via `loadFailed` if the
 * Accounts host is unreachable.
 */
@Component({
  selector: 'app-remote-contact-add-host',
  standalone: true,
  template: `<ng-container #anchor></ng-container>`
})
export class RemoteContactAddHostComponent implements OnInit, OnDestroy {
  @ViewChild('anchor', { read: ViewContainerRef, static: true }) private anchor!: ViewContainerRef;

  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() loadFailed = new EventEmitter<void>();

  private readonly injector = inject(EnvironmentInjector);
  private componentRef?: ComponentRef<any>;

  ngOnInit(): void {
    runInInjectionContext(this.injector, () => loadRemoteModule('global-erp', './ContactAdd'))
      .then((m: any) => {
        this.componentRef = this.anchor.createComponent(m.ContactAddComponent);
        this.componentRef.setInput('contact', null);
        this.componentRef.setInput('activeTab', 'Contacts');
        this.componentRef.instance.onSave.subscribe((saved: any) => this.saved.emit(saved));
        this.componentRef.instance.onClose.subscribe(() => this.cancelled.emit());
      })
      .catch(() => this.loadFailed.emit());
  }

  ngOnDestroy(): void {
    this.componentRef?.destroy();
  }
}
