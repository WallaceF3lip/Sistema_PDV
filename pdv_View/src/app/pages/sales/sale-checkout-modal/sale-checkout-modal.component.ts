import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../../core/services/sale.service';
import { ProductService } from '../../../core/services/product.service';
import { ToastService } from '../../../core/services/toast.service';
import { CustomerService } from '../../../core/services/customer.service';
import { DeliveryZoneService } from '../../../core/services/delivery-zone.service';
import { PrintService } from '../../../core/services/print.service';
import {
  Sale,
  Product,
  PaymentMethodEnum,
  PaymentEntryState,
  OrderTypeEnum,
  UpdateOrderDetailsRequest,
  Customer,
  CustomerAddress,
  DeliveryZone,
  formatAddress,
  formatPhone,
  suggestZoneForNeighborhood,
} from '../../../core/models';
import { NgxMaskDirective } from "ngx-mask";
import { PaymentEntryComponent } from '../../../shared/components/payment-entry/payment-entry.component';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

/** Origem do endereço de entrega quando há cliente vinculado */
export type AddressMode = 'saved' | 'new' | 'custom';

export interface NewAddressForm {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  reference: string;
  delivery_zone_id: number | null;
}

const emptyNewAddress = (): NewAddressForm => ({
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  reference: '',
  delivery_zone_id: null,
});

/** Seleção de zona no checkout: id da zona, 'MANUAL' (sem zona, taxa manual) ou nada escolhido */
export type DeliveryZoneChoice = number | 'MANUAL' | null;

const MAX_DELIVERY_FEE = 9999.99;
const round2 = (v: number) => Math.round(v * 100) / 100;

export enum CheckoutStep {
  TYPE = 'TYPE',
  DETAILS = 'DETAILS',
  PAYMENT = 'PAYMENT',
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-sale-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective, PaymentEntryComponent],
  templateUrl: './sale-checkout-modal.html',
  styleUrl: './sale-checkout-modal.scss',
})
export class SaleCheckoutModalComponent implements OnInit {
  @Input() sale!: Sale;
  @Input() products: Product[] = [];
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  /** Venda atualizada pela API (ex.: taxa de entrega) — mantém o carrinho em sincronia */
  @Output() saleUpdated = new EventEmitter<Sale>();

  // Expõe enums ao template
  readonly CheckoutStep = CheckoutStep;
  readonly OrderTypeEnum = OrderTypeEnum;
  readonly PaymentMethodEnum = PaymentMethodEnum;
  readonly formatAddress = formatAddress;
  readonly formatPhone = formatPhone;

  /** Cópia local da venda, atualizada com a resposta de cada PATCH de detalhes */
  currentSale = signal<Sale>(null as unknown as Sale);

  // ─── Estado de navegação ────────────────────────────────────────────────────
  currentStep = signal<CheckoutStep>(CheckoutStep.TYPE);

  // ─── Dados do pedido ────────────────────────────────────────────────────────
  orderType = signal<OrderTypeEnum | null>(null);
  customerName = signal('');
  notes = signal('');
  deliveryTime = signal('');
  deliveryAddress = signal('');
  customerPhone = signal('');
  deliveryPaymentMethod = signal<PaymentMethodEnum | null>(null);
  isPaid = signal(false);
  showValidationErrors = signal(false);
  showTypeValidationErrors = signal(false);

  // ─── Cliente cadastrado (autocomplete + cadastro rápido) ────────────────────
  customerResults = signal<Customer[]>([]);
  selectedCustomer = signal<Customer | null>(null);
  showCustomerDropdown = signal(false);
  isSearchingCustomers = signal(false);
  showQuickCreate = signal(false);
  quickCreateName = signal('');
  quickCreatePhone = signal('');
  quickCreateError = signal<string | null>(null);
  isCreatingCustomer = signal(false);
  private readonly customerSearch$ = new Subject<string>();

  // ─── Endereço do cliente (Entrega) ──────────────────────────────────────────
  addressMode = signal<AddressMode>('custom');
  selectedAddressId = signal<number | null>(null);
  newAddress = signal<NewAddressForm>(emptyNewAddress());
  newAddressError = signal<string | null>(null);
  /** Erro da finalização exibido inline no passo atual (ex.: 409 sem caixa aberto) */
  finalizeError = signal<string | null>(null);
  isSavingAddress = signal(false);
  /** true quando a zona do novo endereço foi escolhida manualmente (desliga a sugestão pelo bairro) */
  private newAddressZoneTouched = false;

  // ─── Zona e taxa de entrega ─────────────────────────────────────────────────
  zones = signal<DeliveryZone[]>([]);
  deliveryZoneId = signal<DeliveryZoneChoice>(null);
  deliveryFee = signal<number | null>(null);
  /** Zona já gravada na venda que não está entre as ativas (ex.: desativada depois) */
  restoredZone = signal<{ id: number; name: string } | null>(null);

  // ─── Pagamento ──────────────────────────────────────────────────────────────
  /** Estado emitido por app-payment-entry (pagamentos já normalizados) */
  paymentState = signal<PaymentEntryState | null>(null);
  isProcessing = signal(false);

  // ─── Impressão da comanda ───────────────────────────────────────────────────
  readonly printService = inject(PrintService);
  /** "Imprimir comanda" ao finalizar (preferência lembrada no navegador) */
  printTicket = signal(readPrintTicketPref());

  // ─── Computed ───────────────────────────────────────────────────────────────
  isDelivery = computed(() => this.orderType() === OrderTypeEnum.DELIVERY);
  isPickup = computed(() => this.orderType() === OrderTypeEnum.PICKUP);
  isCounter = computed(() => this.orderType() === null);

  /** Totais da venda (Decimal chega da API como string) */
  itemsTotal = computed(() => {
    const sale = this.currentSale();
    if (sale.items_total !== undefined && sale.items_total !== null) return Number(sale.items_total);
    return round2(sale.items.reduce((acc, i) => acc + Number(i.subtotal), 0));
  });
  saleDeliveryFee = computed(() => Number(this.currentSale().delivery_fee ?? 0));
  saleTotal = computed(() => Number(this.currentSale().total_amount) || 0);

  /** Prévia do total na etapa 2 (Entrega) antes de salvar */
  previewTotal = computed(() => round2(this.itemsTotal() + (this.deliveryFee() ?? 0)));

  /** Zonas oferecidas no seletor (ativas + zona restaurada da venda, se inativa) */
  zoneOptions = computed(() => {
    const zones = this.zones().map((z) => ({ id: z.id, name: z.name, fee: z.fee as number | null }));
    const restored = this.restoredZone();
    if (restored && !zones.some((z) => z.id === restored.id)) {
      zones.push({ id: restored.id, name: restored.name + ' (inativa)', fee: null });
    }
    return zones;
  });

  deliveryFeeValid = computed(() => {
    const fee = this.deliveryFee();
    return fee !== null && Number.isFinite(fee) && fee >= 0 && fee <= MAX_DELIVERY_FEE;
  });

  /** Entrega exige zona (ou taxa manual) e taxa válida */
  deliveryZoneValid = computed(() => this.deliveryZoneId() !== null && this.deliveryFeeValid());

  deliveryFieldsValid = computed(() => {
    if (this.isDelivery()) {
      return !!(
        this.deliveryTime().trim() &&
        this.deliveryAddress().trim() &&
        this.customerPhone().trim() &&
        this.deliveryZoneValid()
      );
    }
    if (this.isPickup()) {
      return !!(this.deliveryTime().trim() && this.customerPhone().trim());
    }
    return true;
  });

  canFinalize = computed(() => {
    if (this.isProcessing()) return false;
    return !!this.paymentState()?.valid;
  });

  /** Nome do cliente preenchido — obrigatório na etapa 1 */
  canAdvance = computed(() => !!this.customerName().trim());

  /** Exibe o dropdown de busca (mín. 2 caracteres, sem cliente já vinculado) */
  customerDropdownVisible = computed(
    () =>
      this.showCustomerDropdown() &&
      !this.selectedCustomer() &&
      !this.showQuickCreate() &&
      this.customerName().trim().length >= 2
  );

  // ─── Opções de UI ───────────────────────────────────────────────────────────
  orderTypes = [
    { value: null, label: 'Balcão', icon: '🛒' },
    { value: OrderTypeEnum.PICKUP, label: 'Retirada', icon: '🏪' },
    { value: OrderTypeEnum.DELIVERY, label: 'Entrega', icon: '🚚' },
  ];

  paymentMethods = [
    { value: PaymentMethodEnum.PIX, label: 'PIX', icon: '⚡' },
    { value: PaymentMethodEnum.CARD, label: 'Cartão', icon: '💳' },
    { value: PaymentMethodEnum.CASH, label: 'Dinheiro', icon: '💵' },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private saleService: SaleService,
    private toastService: ToastService,
    private customerService: CustomerService,
    private deliveryZoneService: DeliveryZoneService,
  ) {
    // Busca de clientes com debounce; switchMap cancela requisições anteriores
    this.customerSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const term = q.trim();
          if (term.length < 2) {
            this.isSearchingCustomers.set(false);
            return of([] as Customer[]);
          }
          this.isSearchingCustomers.set(true);
          return this.customerService
            .search(term, true, 8)
            .pipe(catchError(() => of([] as Customer[])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => {
        this.isSearchingCustomers.set(false);
        this.customerResults.set(results);
      });
  }

  ngOnInit(): void {
    this.currentSale.set(this.sale);

    // Pré-preenche com dados já salvos na venda
    this.orderType.set(this.sale.order_type ?? null);
    this.customerName.set(this.sale.customer_name ?? '');
    this.notes.set(this.sale.notes ?? '');

    // Horário: usa o salvo; se não houver, usa o horário atual como padrão
    const savedTime = this.sale.delivery_time;
    if (savedTime) {
      this.deliveryTime.set(savedTime);
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      this.deliveryTime.set(`${hh}:${mm}`);
    }

    this.deliveryAddress.set(this.sale.delivery_address ?? '');
    this.customerPhone.set(this.sale.customer_phone ?? '');
    this.deliveryPaymentMethod.set(this.sale.delivery_payment_method ?? null);
    this.isPaid.set(this.sale.is_paid ?? false);

    // Restaura zona/taxa já gravadas (venda OPEN reaberta)
    const restoredFee = Number(this.sale.delivery_fee ?? 0);
    const hasRestoredZone =
      this.sale.order_type === OrderTypeEnum.DELIVERY &&
      (!!this.sale.delivery_zone_id || restoredFee > 0);
    if (hasRestoredZone) {
      if (this.sale.delivery_zone_id) {
        this.deliveryZoneId.set(this.sale.delivery_zone_id);
        this.restoredZone.set({
          id: this.sale.delivery_zone_id,
          name: this.sale.delivery_zone_name ?? 'Zona #' + this.sale.delivery_zone_id,
        });
      } else {
        this.deliveryZoneId.set('MANUAL');
      }
      this.deliveryFee.set(restoredFee);
    }

    // Zonas ativas para o seletor
    this.deliveryZoneService.list(true).subscribe({
      next: (zones) => {
        this.zones.set(zones);
        // Endereço selecionado antes do carregamento das zonas: aplica a zona dele
        if (this.deliveryZoneId() === null && this.addressMode() === 'saved') {
          this._applyAddressZone(this._selectedAddress());
        }
      },
    });

    // Restaura cliente vinculado (somente se ainda ativo)
    if (this.sale.customer_id) {
      this.customerService.getById(this.sale.customer_id).subscribe({
        next: (customer) => {
          if (customer.is_active) {
            this.selectedCustomer.set(customer);
            // Não sobrescreve zona/taxa restauradas da venda
            this._initAddressSelection(customer, !hasRestoredZone);
          }
        },
      });
    }
  }

  // ─── Etapa 1: Cliente (autocomplete) ────────────────────────────────────────

  /** Digitação no campo de nome: busca clientes e desfaz o vínculo se o nome mudar */
  onCustomerNameChange(value: string): void {
    this.customerName.set(value);
    this.showTypeValidationErrors.set(false);

    const selected = this.selectedCustomer();
    if (selected && value !== selected.name) {
      this.clearSelectedCustomer();
    }

    this.showCustomerDropdown.set(true);
    this.customerSearch$.next(value);
  }

  onCustomerNameBlur(): void {
    // Atraso para permitir o clique em um item do dropdown
    setTimeout(() => this.showCustomerDropdown.set(false), 150);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.customerName.set(customer.name);
    if (!this.customerPhone().trim() && customer.phone) {
      this.customerPhone.set(customer.phone);
    }
    this.showCustomerDropdown.set(false);
    this.customerResults.set([]);
    this.showQuickCreate.set(false);
    this._initAddressSelection(customer);
  }

  /** Remove o vínculo (✕ no chip ou edição do nome) */
  clearSelectedCustomer(): void {
    if (this.addressMode() !== 'custom') {
      // Endereço vinha do cadastro: não reaproveita para outro cliente
      this.deliveryAddress.set('');
    }
    this.selectedCustomer.set(null);
    this.selectedAddressId.set(null);
    this.addressMode.set('custom');
    this._applyAddressZone(null);
  }

  openQuickCreate(): void {
    this.quickCreateName.set(this.customerName().trim());
    this.quickCreatePhone.set(this.customerPhone().trim());
    this.quickCreateError.set(null);
    this.showCustomerDropdown.set(false);
    this.showQuickCreate.set(true);
  }

  cancelQuickCreate(): void {
    this.showQuickCreate.set(false);
    this.quickCreateError.set(null);
  }

  submitQuickCreate(): void {
    const name = this.quickCreateName().trim();
    if (name.length < 2) {
      this.quickCreateError.set('Informe o nome do cliente (mín. 2 caracteres).');
      return;
    }
    this.isCreatingCustomer.set(true);
    this.quickCreateError.set(null);

    this.customerService
      .create({ name, phone: this.quickCreatePhone().trim() || null })
      .subscribe({
        next: (customer) => {
          this.isCreatingCustomer.set(false);
          this.showQuickCreate.set(false);
          this.toastService.success('Cliente cadastrado!');
          this.selectCustomer(customer);
        },
        error: (err: HttpErrorResponse) => {
          this.isCreatingCustomer.set(false);
          this.quickCreateError.set(this._errorMessage(err, 'Erro ao cadastrar cliente.'));
        },
      });
  }

  // ─── Etapa 2: Endereço do cliente (Entrega) ─────────────────────────────────

  /** Define a seleção inicial de endereço para o cliente vinculado */
  private _initAddressSelection(customer: Customer, applyZone: boolean = true): void {
    const addresses = customer.addresses ?? [];
    const current = this.deliveryAddress().trim();
    this.newAddress.set(emptyNewAddress());
    this.newAddressError.set(null);

    if (addresses.length) {
      const matching = current ? addresses.find((a) => formatAddress(a) === current) : undefined;
      if (matching) {
        this.selectSavedAddress(matching, applyZone);
      } else if (current) {
        // Venda já tinha endereço avulso: preserva
        this.selectedAddressId.set(null);
        this.addressMode.set('custom');
        if (applyZone) this._applyAddressZone(null);
      } else {
        this.selectSavedAddress(addresses.find((a) => a.is_default) ?? addresses[0], applyZone);
      }
      return;
    }

    // Cliente sem endereços: formulário de novo endereço (ou mantém texto avulso já salvo)
    this.selectedAddressId.set(null);
    this.addressMode.set(current ? 'custom' : 'new');
    this.newAddressZoneTouched = false;
    if (applyZone) this._applyAddressZone(null);
  }

  selectSavedAddress(address: CustomerAddress, applyZone: boolean = true): void {
    this.addressMode.set('saved');
    this.selectedAddressId.set(address.id);
    this.deliveryAddress.set(formatAddress(address));
    if (applyZone) this._applyAddressZone(address);
  }

  chooseNewAddress(): void {
    if (this.addressMode() !== 'new') {
      this.deliveryAddress.set('');
      this._applyAddressZone(null);
    }
    this.addressMode.set('new');
    this.selectedAddressId.set(null);
    this.newAddress.set(emptyNewAddress());
    this.newAddressError.set(null);
    this.newAddressZoneTouched = false;
  }

  chooseCustomAddress(): void {
    if (this.addressMode() !== 'custom') {
      this.deliveryAddress.set('');
      this._applyAddressZone(null);
    }
    this.addressMode.set('custom');
    this.selectedAddressId.set(null);
  }

  updateNewAddress(field: Exclude<keyof NewAddressForm, 'delivery_zone_id'>, value: string): void {
    this.newAddress.update((a) => {
      const next = { ...a, [field]: value };
      // Bairro alterado: sugere a zona de mesmo nome enquanto não houver escolha manual
      if (field === 'neighborhood' && !this.newAddressZoneTouched) {
        next.delivery_zone_id = suggestZoneForNeighborhood(this.zones(), value)?.id ?? null;
      }
      return next;
    });
  }

  updateNewAddressZone(zoneId: number | null): void {
    this.newAddressZoneTouched = true;
    this.newAddress.update((a) => ({ ...a, delivery_zone_id: zoneId }));
  }

  // ─── Etapa 2: Zona e taxa de entrega ────────────────────────────────────────

  /** Endereço salvo atualmente selecionado */
  private _selectedAddress(): CustomerAddress | null {
    const id = this.selectedAddressId();
    return this.selectedCustomer()?.addresses.find((a) => a.id === id) ?? null;
  }

  /**
   * Endereço com zona ativa → preenche zona e taxa.
   * Sem zona, zona inativa ou endereço avulso → exige escolha do operador.
   */
  private _applyAddressZone(address: CustomerAddress | null): void {
    this.restoredZone.set(null);
    const zone = address?.delivery_zone_id
      ? this.zones().find((z) => z.id === address.delivery_zone_id && z.is_active)
      : undefined;
    if (zone) {
      this.deliveryZoneId.set(zone.id);
      this.deliveryFee.set(zone.fee);
    } else {
      this.deliveryZoneId.set(null);
      this.deliveryFee.set(null);
    }
  }

  /** Troca de zona no seletor: a taxa passa a ser a da zona escolhida */
  onDeliveryZoneChange(choice: DeliveryZoneChoice): void {
    this.deliveryZoneId.set(choice);
    if (typeof choice === 'number') {
      const zone = this.zones().find((z) => z.id === choice);
      if (zone) this.deliveryFee.set(zone.fee);
    } else if (choice === null) {
      this.deliveryFee.set(null);
    }
    // 'MANUAL': mantém o valor atual para o operador ajustar
  }

  onDeliveryFeeChange(value: number | string | null): void {
    if (value === null || value === '' || value === undefined) {
      this.deliveryFee.set(null);
      return;
    }
    const parsed = Number(value);
    this.deliveryFee.set(Number.isFinite(parsed) ? parsed : null);
  }

  saveNewAddress(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;
    const form = this.newAddress();
    if (!form.street.trim() || !form.neighborhood.trim()) {
      this.newAddressError.set('Rua e bairro são obrigatórios.');
      return;
    }
    this.isSavingAddress.set(true);
    this.newAddressError.set(null);

    this.customerService
      .addAddress(customer.id, {
        street: form.street.trim(),
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim(),
        reference: form.reference.trim() || null,
        delivery_zone_id: form.delivery_zone_id,
      })
      .subscribe({
        next: (address) => {
          this.isSavingAddress.set(false);
          this.selectedCustomer.set({
            ...customer,
            addresses: [...customer.addresses, address],
          });
          this.newAddress.set(emptyNewAddress());
          this.selectSavedAddress(address);
        },
        error: (err: HttpErrorResponse) => {
          this.isSavingAddress.set(false);
          this.newAddressError.set(this._errorMessage(err, 'Erro ao salvar endereço.'));
        },
      });
  }

  // ─── Navegação ──────────────────────────────────────────────────────────────

  /** Etapa 1 → avança: Balcão vai direto para PAYMENT; Retirada/Entrega vai para DETAILS */
  advanceStep(): void {
    if (!this.canAdvance()) {
      this.showTypeValidationErrors.set(true);
      return;
    }

    if (this.isCounter()) {
      // Balcão: salva customer_name, notes e order_type antes de ir para pagamento
      this.isProcessing.set(true);
      const payload: UpdateOrderDetailsRequest = {
        customer_name: this.customerName().trim() || null,
        notes: this.notes().trim() || null,
        order_type: null,
        customer_id: this.selectedCustomer()?.id ?? null,
      };
      this.saleService.updateOrderDetails(this.sale.id, payload).subscribe({
        next: (updated) => {
          this._onSaleUpdated(updated);
          this.isProcessing.set(false);
          this.paymentState.set(null);
          this.currentStep.set(CheckoutStep.PAYMENT);
        },
        error: () => {
          this.isProcessing.set(false);
          this.toastService.error('Erro ao salvar dados do pedido.');
        },
      });
    } else {
      this.currentStep.set(CheckoutStep.DETAILS);
    }
  }

  /** Volta à etapa anterior */
  goBack(): void {
    this.finalizeError.set(null);
    if (this.currentStep() === CheckoutStep.PAYMENT) {
      if (this.isCounter()) {
        this.currentStep.set(CheckoutStep.TYPE);
      } else {
        this.currentStep.set(CheckoutStep.DETAILS);
      }
    } else if (this.currentStep() === CheckoutStep.DETAILS) {
      this.showValidationErrors.set(false);
      this.currentStep.set(CheckoutStep.TYPE);
    }
  }

  /** Fecha o modal sem finalizar */
  close(): void {
    this.cancelled.emit();
  }

  // ─── Etapa 2: Detalhes ──────────────────────────────────────────────────────

  private _buildOrderDetailsPayload(): UpdateOrderDetailsRequest {
    const payload: UpdateOrderDetailsRequest = {
      customer_name: this.customerName().trim() || null,
      notes: this.notes().trim() || null,
      order_type: this.orderType(),
      customer_id: this.selectedCustomer()?.id ?? null,
    };
    if (this.isDelivery() || this.isPickup()) {
      payload.delivery_time = this.deliveryTime().trim() || null;
      payload.customer_phone = this.customerPhone().trim() || null;
      payload.delivery_payment_method = this.deliveryPaymentMethod();
      payload.is_paid = this.isPaid();
    }
    if (this.isDelivery()) {
      payload.delivery_address = this.deliveryAddress().trim() || null;
      const zoneId = this.deliveryZoneId();
      payload.delivery_zone_id = typeof zoneId === 'number' ? zoneId : null;
      payload.delivery_fee = round2(this.deliveryFee() ?? 0);
    }
    return payload;
  }

  /** Confirma detalhes, salva via PATCH e avança ou finaliza como reserva */
  confirmDetails(): void {
    if (!this.deliveryFieldsValid()) {
      this.showValidationErrors.set(true);
      return;
    }
    this.showValidationErrors.set(false);
    this.isProcessing.set(true);

    const payload = this._buildOrderDetailsPayload();

    this.saleService.updateOrderDetails(this.sale.id, payload).subscribe({
      next: (updated) => {
        this._onSaleUpdated(updated);
        this.isProcessing.set(false);
        if (!this.isPaid()) {
          // Reserva: finaliza sem pagamento imediato
          this._finalizeReservation();
        } else {
          // Pago: abre etapa de pagamento
          this.paymentState.set(null);
          this.currentStep.set(CheckoutStep.PAYMENT);
        }
      },
      error: () => {
        this.isProcessing.set(false);
        this.toastService.error('Erro ao salvar detalhes do pedido.');
      },
    });
  }

  // ─── Etapa 3: Pagamento ─────────────────────────────────────────────────────

  finalizeSale(): void {
    if (!this.canFinalize()) return;
    this.isProcessing.set(true);

    // Pagamentos normalizados pelo app-payment-entry: troco descontado do
    // dinheiro, soma == total (antes o valor digitado gerava 422 com troco).
    const payments = this.paymentState()?.payments ?? [];

    this.finalizeError.set(null);
    this.saleService.finalize(this.sale.id, { payments }).subscribe({
      next: (finalized: Sale) => {
        this.toastService.success('Venda finalizada com sucesso!');
        this.isProcessing.set(false);
        if (this.printTicket()) {
          this.printService.printOrderTicket(finalized, this._cashExtras());
        }
        this.completed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.isProcessing.set(false);
        // Mantém o modal aberto com os dados; mensagem do servidor inline
        this.finalizeError.set(this._errorMessage(err, 'Erro ao finalizar venda.'));
      },
    });
  }

  // ─── Reserva (sem pagamento imediato) ───────────────────────────────────────

  private _finalizeReservation(): void {
    this.isProcessing.set(true);
    const msg = this.isDelivery() ? '🚚 Pedido de entrega reservado!' : '🏪 Retirada agendada!';

    this.finalizeError.set(null);
    this.saleService.finalize(this.sale.id, { payments: [] }).subscribe({
      next: (finalized: Sale) => {
        this.toastService.success(msg);
        this.isProcessing.set(false);
        if (this.printTicket()) {
          this.printService.printOrderTicket(finalized);
        }
        this.completed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.isProcessing.set(false);
        // O interceptor já exibe o toast com o detail; aqui apenas inline
        this.finalizeError.set(this._errorMessage(err, 'Erro ao reservar pedido.'));
      },
    });
  }

  // ─── Impressão ──────────────────────────────────────────────────────────────

  /** Altera e persiste a preferência "Imprimir comanda" */
  setPrintTicket(value: boolean): void {
    this.printTicket.set(value);
    try {
      localStorage.setItem(PRINT_TICKET_PREF_KEY, String(value));
    } catch {
      /* storage indisponível: vale só para esta sessão */
    }
  }

  /** Recebido (entradas em dinheiro + troco) e troco, só quando há troco */
  private _cashExtras(): { cashReceived: number; change: number } | undefined {
    const state = this.paymentState();
    const change = Number(state?.change ?? 0);
    if (!state || !(change > 0)) return undefined;
    const cash = state.payments
      .filter((p) => p.method === PaymentMethodEnum.CASH)
      .reduce((acc, p) => acc + Number(p.amount), 0);
    return { cashReceived: round2(cash + change), change: round2(change) };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private _onSaleUpdated(updated: Sale): void {
    this.currentSale.set(updated);
    this.saleUpdated.emit(updated);
  }

  /** Extrai mensagem legível (inclui erros 422 do FastAPI em lista) */
  private _errorMessage(err: HttpErrorResponse, fallback: string): string {
    const detail = err?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msg = detail
        .map((d: any) => String(d?.msg ?? '').replace(/^Value error, /, ''))
        .filter(Boolean)
        .join(' · ');
      if (msg) return msg;
    }
    return fallback;
  }

  getProductName(productId: number): string {
    return this.products.find(p => p.id === productId)?.name || `Produto #${productId}`;
  }
}

// ─── Preferência de impressão ─────────────────────────────────────────────────

const PRINT_TICKET_PREF_KEY = 'pdv.printTicketOnFinalize';

/** Padrão true; só 'false' salvo desliga a impressão */
function readPrintTicketPref(): boolean {
  try {
    return localStorage.getItem(PRINT_TICKET_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}
