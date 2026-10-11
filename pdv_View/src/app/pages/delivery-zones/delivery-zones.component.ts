import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DeliveryZoneService } from '../../core/services/delivery-zone.service';
import { ToastService } from '../../core/services/toast.service';
import { DeliveryZone } from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-delivery-zones',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './delivery-zones.html',
  styleUrl: './delivery-zones.scss',
})
export class DeliveryZonesComponent implements OnInit {
  zones = signal<DeliveryZone[]>([]);
  isLoading = signal<boolean>(false);
  showInactive = signal(false);

  columns: TableColumn[] = [
    { key: 'name', label: 'Nome' },
    { key: 'fee', label: 'Taxa', width: '140px', align: 'right' },
    { key: 'is_active', label: 'Status', width: '110px', align: 'center' },
    { key: 'actions', label: '', width: '220px', align: 'center' },
  ];

  // ─── Modal ────────────────────────────────────────────────────────────────
  showModal = signal(false);
  isSaving = signal(false);
  editingZone = signal<DeliveryZone | null>(null);
  form: { name: string; fee: number | null } = { name: '', fee: 0 };
  formError = signal<string | null>(null);

  constructor(
    private zoneService: DeliveryZoneService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadZones();
  }

  loadZones(): void {
    this.isLoading.set(true);
    this.zoneService.list(!this.showInactive()).subscribe({
      next: (list) => {
        this.zones.set(list);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  toggleShowInactive(value: boolean): void {
    this.showInactive.set(value);
    this.loadZones();
  }

  openModal(): void {
    this.editingZone.set(null);
    this.form = { name: '', fee: 0 };
    this.formError.set(null);
    this.showModal.set(true);
  }

  editZone(zone: DeliveryZone): void {
    this.editingZone.set(zone);
    this.form = { name: zone.name, fee: zone.fee };
    this.formError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingZone.set(null);
  }

  saveZone(): void {
    const name = this.form.name.trim();
    const fee = this.form.fee === null || this.form.fee === undefined ? NaN : Number(this.form.fee);
    if (name.length < 2 || name.length > 100) {
      this.formError.set('Informe o nome da zona (2 a 100 caracteres).');
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      this.formError.set('Informe uma taxa maior ou igual a zero.');
      return;
    }
    this.formError.set(null);
    this.isSaving.set(true);

    const payload = { name, fee: Math.round(fee * 100) / 100 };
    const editing = this.editingZone();
    const request$ = editing
      ? this.zoneService.update(editing.id, payload)
      : this.zoneService.create(payload);

    request$.subscribe({
      next: () => {
        this.toastService.success(editing ? 'Zona atualizada!' : 'Zona cadastrada!');
        this.isSaving.set(false);
        this.closeModal();
        this.loadZones();
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.formError.set(this._errorMessage(err));
      },
    });
  }

  toggleActive(zone: DeliveryZone): void {
    if (zone.is_active) {
      if (!confirm(`Desativar a zona "${zone.name}"? Ela não será mais oferecida no checkout.`)) {
        return;
      }
      this.zoneService.deactivate(zone.id).subscribe({
        next: (updated) => {
          this.toastService.success('Zona desativada');
          this._replaceOrDrop(updated);
        },
      });
    } else {
      this.zoneService.update(zone.id, { is_active: true }).subscribe({
        next: (updated) => {
          this.toastService.success('Zona reativada');
          this._replaceOrDrop(updated);
        },
      });
    }
  }

  private _replaceOrDrop(updated: DeliveryZone): void {
    this.zones.update((list) => {
      if (!updated.is_active && !this.showInactive()) {
        return list.filter((z) => z.id !== updated.id);
      }
      return list.map((z) => (z.id === updated.id ? updated : z));
    });
  }

  /** 409 (nome duplicado) chega como string; 422 do FastAPI como lista */
  private _errorMessage(err: HttpErrorResponse): string {
    const detail = err?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msg = detail
        .map((d: any) => String(d?.msg ?? '').replace(/^Value error, /, ''))
        .filter(Boolean)
        .join(' · ');
      if (msg) return msg;
    }
    return 'Não foi possível salvar a zona.';
  }
}
