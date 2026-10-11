import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgxMaskDirective } from 'ngx-mask';
import { CustomerService } from '../../core/services/customer.service';
import { DeliveryZoneService } from '../../core/services/delivery-zone.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Customer,
  CustomerAddress,
  CustomerAddressCreate,
  DeliveryZone,
  DeliveryZoneBrief,
  formatAddress,
  suggestZoneForNeighborhood,
  formatPhone,
} from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

/** Endereço em edição no modal (id ausente = ainda não salvo) */
interface AddressDraft extends CustomerAddressCreate {
  id?: number;
  is_default: boolean;
  delivery_zone_id: number | null;
  /** Zona resumida (exibição; pode estar inativa) */
  delivery_zone?: DeliveryZoneBrief | null;
}

const emptyAddress = (): AddressDraft => ({
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  reference: '',
  is_default: false,
  delivery_zone_id: null,
  delivery_zone: null,
});

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective, DataTableComponent, DtCellDirective],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class CustomersComponent implements OnInit {
  readonly formatPhone = formatPhone;
  readonly formatAddress = formatAddress;

  customers = signal<Customer[]>([]);
  isLoading = signal<boolean>(false);
  searchTerm = signal('');
  showInactive = signal(false);

  /** Filtro local por nome ou telefone */
  filteredCustomers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.customers();
    if (!term) return list;
    const digits = term.replace(/\D/g, '');
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (digits.length >= 2 && (c.phone ?? '').includes(digits))
    );
  });

  columns: TableColumn[] = [
    { key: 'name', label: 'Nome' },
    { key: 'phone', label: 'Telefone' },
    { key: 'neighborhood', label: 'Bairro' },
    { key: 'is_active', label: 'Ativo', width: '90px', align: 'center' },
    { key: 'actions', label: '', width: '220px', align: 'center' },
  ];

  // ─── Modal ────────────────────────────────────────────────────────────────
  showModal = signal(false);
  isSaving = signal(false);
  editingCustomer = signal<Customer | null>(null);
  form = { name: '', phone: '', notes: '' };

  /** Endereços: no cadastro ficam locais; na edição são salvos direto na API */
  addresses = signal<AddressDraft[]>([]);
  addressForm: AddressDraft | null = null;
  /** Índice do endereço em edição no sub-formulário (null = novo) */
  editingAddressIndex: number | null = null;
  isSavingAddress = signal(false);

  /** Zonas de entrega ativas para o seletor do endereço */
  zones = signal<DeliveryZone[]>([]);
  /** true quando o usuário escolheu a zona manualmente (desliga a sugestão pelo bairro) */
  zoneTouched = false;

  constructor(
    private customerService: CustomerService,
    private deliveryZoneService: DeliveryZoneService,
    private toastService: ToastService,
    protected authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.deliveryZoneService.list(true).subscribe({
      next: (zones) => this.zones.set(zones),
    });
  }

  loadCustomers(): void {
    this.isLoading.set(true);
    this.customerService.list(!this.showInactive()).subscribe({
      next: (list) => {
        this.customers.set(list);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  toggleShowInactive(value: boolean): void {
    this.showInactive.set(value);
    this.loadCustomers();
  }

  defaultNeighborhood(customer: Customer): string {
    const addr = customer.addresses.find((a) => a.is_default) ?? customer.addresses[0];
    return addr?.neighborhood ?? '—';
  }

  // ─── Modal: cliente ───────────────────────────────────────────────────────

  openModal(): void {
    this.editingCustomer.set(null);
    this.form = { name: '', phone: '', notes: '' };
    this.addresses.set([]);
    this.cancelAddressForm();
    this.showModal.set(true);
  }

  editCustomer(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.form = {
      name: customer.name,
      phone: customer.phone ?? '',
      notes: customer.notes ?? '',
    };
    this.addresses.set(customer.addresses.map((a) => this._toDraft(a)));
    this.cancelAddressForm();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingCustomer.set(null);
    this.cancelAddressForm();
  }

  saveCustomer(): void {
    if (this.form.name.trim().length < 2) {
      this.toastService.error('Informe o nome do cliente (mín. 2 caracteres).');
      return;
    }
    const base = {
      name: this.form.name.trim(),
      phone: this.form.phone?.trim() || null,
      notes: this.form.notes?.trim() || null,
    };
    this.isSaving.set(true);
    const editing = this.editingCustomer();

    const request$ = editing
      ? this.customerService.update(editing.id, base)
      : this.customerService.create({
          ...base,
          addresses: this.addresses().map((a) => this._toPayload(a)),
        });

    request$.subscribe({
      next: () => {
        this.toastService.success(editing ? 'Cliente atualizado!' : 'Cliente cadastrado!');
        this.isSaving.set(false);
        this.closeModal();
        this.loadCustomers();
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving.set(false);
        this._showValidationError(err);
      },
    });
  }

  // ─── Desativar / reativar (somente ADMIN) ─────────────────────────────────

  toggleActive(customer: Customer): void {
    if (!this.authService.isAdmin()) return;

    if (customer.is_active) {
      if (!confirm(`Desativar o cliente "${customer.name}"? Ele não aparecerá mais nas buscas.`)) {
        return;
      }
      this.customerService.deactivate(customer.id).subscribe({
        next: (updated) => {
          this.toastService.success('Cliente desativado');
          this._replaceOrDrop(updated);
        },
      });
    } else {
      this.customerService.update(customer.id, { is_active: true }).subscribe({
        next: (updated) => {
          this.toastService.success('Cliente reativado');
          this._replaceOrDrop(updated);
        },
      });
    }
  }

  // ─── Endereços ────────────────────────────────────────────────────────────

  newAddress(): void {
    this.editingAddressIndex = null;
    this.addressForm = emptyAddress();
    this.zoneTouched = false;
  }

  editAddress(index: number): void {
    this.editingAddressIndex = index;
    this.addressForm = { ...this.addresses()[index] };
    // Endereço existente já tem uma escolha de zona: não sobrescreve pela sugestão
    this.zoneTouched = true;
  }

  // ─── Zona de entrega do endereço ──────────────────────────────────────────

  /** Bairro alterado: sugere a zona de mesmo nome enquanto não houver escolha manual */
  onNeighborhoodChange(value: string): void {
    if (!this.addressForm) return;
    this.addressForm.neighborhood = value;
    if (this.zoneTouched) return;
    const zone = suggestZoneForNeighborhood(this.zones(), value);
    this.addressForm.delivery_zone_id = zone?.id ?? null;
    this.addressForm.delivery_zone = zone;
  }

  onZoneChange(zoneId: number | null): void {
    if (!this.addressForm) return;
    this.zoneTouched = true;
    this.addressForm.delivery_zone_id = zoneId;
    this.addressForm.delivery_zone =
      this.zones().find((z) => z.id === zoneId) ??
      (this.addressForm.delivery_zone?.id === zoneId ? this.addressForm.delivery_zone : null);
  }

  /** Zona atual do endereço quando não está entre as ativas (ex.: desativada) */
  inactiveCurrentZone(): DeliveryZoneBrief | null {
    const zone = this.addressForm?.delivery_zone;
    if (!zone || !this.addressForm?.delivery_zone_id) return null;
    return this.zones().some((z) => z.id === zone.id) ? null : zone;
  }

  cancelAddressForm(): void {
    this.addressForm = null;
    this.editingAddressIndex = null;
  }

  saveAddress(): void {
    const draft = this.addressForm;
    if (!draft) return;
    if (!draft.street?.trim() || !draft.neighborhood?.trim()) {
      this.toastService.error('Rua e bairro são obrigatórios.');
      return;
    }

    const customer = this.editingCustomer();
    const index = this.editingAddressIndex;

    // Cadastro novo: mantém local e aplica a regra de endereço padrão
    if (!customer) {
      this.addresses.update((list) => {
        const next = [...list];
        if (index === null) next.push({ ...draft });
        else next[index] = { ...draft };
        return this._normalizeLocalDefaults(next, index === null ? next.length - 1 : index);
      });
      this.cancelAddressForm();
      return;
    }

    // Edição: salva direto na API
    this.isSavingAddress.set(true);
    const payload = this._toPayload(draft);
    const request$ =
      index !== null && draft.id
        ? this.customerService.updateAddress(customer.id, draft.id, payload)
        : this.customerService.addAddress(customer.id, payload);

    request$.subscribe({
      next: () => {
        this.isSavingAddress.set(false);
        this.cancelAddressForm();
        this._reloadEditingCustomer();
      },
      error: (err: HttpErrorResponse) => {
        this.isSavingAddress.set(false);
        this._showValidationError(err);
      },
    });
  }

  removeAddress(index: number): void {
    const addr = this.addresses()[index];
    const customer = this.editingCustomer();

    if (!customer || !addr.id) {
      this.addresses.update((list) => {
        const next = list.filter((_, i) => i !== index);
        if (addr.is_default && next.length) next[0] = { ...next[0], is_default: true };
        return next;
      });
      this.cancelAddressForm();
      return;
    }

    if (!confirm('Remover este endereço do cadastro?')) return;
    this.customerService.removeAddress(customer.id, addr.id).subscribe({
      next: () => {
        this.cancelAddressForm();
        this._reloadEditingCustomer();
      },
    });
  }

  setDefaultAddress(index: number): void {
    const addr = this.addresses()[index];
    const customer = this.editingCustomer();

    if (!customer || !addr.id) {
      this.addresses.update((list) =>
        list.map((a, i) => ({ ...a, is_default: i === index }))
      );
      return;
    }

    this.customerService.updateAddress(customer.id, addr.id, { is_default: true }).subscribe({
      next: () => this._reloadEditingCustomer(),
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _reloadEditingCustomer(): void {
    const customer = this.editingCustomer();
    if (!customer) return;
    this.customerService.getById(customer.id).subscribe({
      next: (fresh) => {
        this.editingCustomer.set(fresh);
        this.addresses.set(fresh.addresses.map((a) => this._toDraft(a)));
        this.customers.update((list) => list.map((c) => (c.id === fresh.id ? fresh : c)));
      },
    });
  }

  private _replaceOrDrop(updated: Customer): void {
    this.customers.update((list) => {
      if (!updated.is_active && !this.showInactive()) {
        return list.filter((c) => c.id !== updated.id);
      }
      return list.map((c) => (c.id === updated.id ? updated : c));
    });
  }

  /** Primeiro endereço vira padrão; marcar um como padrão desmarca os demais */
  private _normalizeLocalDefaults(list: AddressDraft[], changedIndex: number): AddressDraft[] {
    if (list[changedIndex]?.is_default) {
      return list.map((a, i) => ({ ...a, is_default: i === changedIndex }));
    }
    if (!list.some((a) => a.is_default) && list.length) {
      list[0] = { ...list[0], is_default: true };
    }
    return list;
  }

  private _toDraft(a: CustomerAddress): AddressDraft {
    return {
      id: a.id,
      street: a.street,
      number: a.number ?? '',
      complement: a.complement ?? '',
      neighborhood: a.neighborhood,
      reference: a.reference ?? '',
      is_default: a.is_default,
      delivery_zone_id: a.delivery_zone_id ?? null,
      delivery_zone: a.delivery_zone ?? null,
    };
  }

  private _toPayload(a: AddressDraft): CustomerAddressCreate {
    return {
      street: a.street.trim(),
      number: a.number?.trim() || null,
      complement: a.complement?.trim() || null,
      neighborhood: a.neighborhood.trim(),
      reference: a.reference?.trim() || null,
      is_default: a.is_default,
      delivery_zone_id: a.delivery_zone_id ?? null,
    };
  }

  /** Erros 422 do FastAPI chegam como lista; exibe as mensagens legíveis */
  private _showValidationError(err: HttpErrorResponse): void {
    const detail = err?.error?.detail;
    if (Array.isArray(detail)) {
      const msg = detail
        .map((d: any) => String(d?.msg ?? '').replace(/^Value error, /, ''))
        .filter(Boolean)
        .join(' · ');
      if (msg) this.toastService.error(msg);
    }
  }
}
