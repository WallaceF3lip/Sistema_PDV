import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleService } from '../../../core/services/sale.service';
import { ProductService } from '../../../core/services/product.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  Sale,
  Product,
  PaymentMethodEnum,
  PaymentIn,
  OrderTypeEnum,
  UpdateOrderDetailsRequest,
} from '../../../core/models';
import { NgxMaskDirective } from "ngx-mask";

// ─── Tipos locais ─────────────────────────────────────────────────────────────

export interface PaymentEntry {
  method: PaymentMethodEnum;
  amount: number;
}

export enum CheckoutStep {
  TYPE = 'TYPE',
  DETAILS = 'DETAILS',
  PAYMENT = 'PAYMENT',
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-sale-checkout-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  templateUrl: './sale-checkout-modal.html',
  styleUrl: './sale-checkout-modal.scss',
})
export class SaleCheckoutModalComponent implements OnInit {
  @Input() sale!: Sale;
  @Input() products: Product[] = [];
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // Expõe enums ao template
  readonly CheckoutStep = CheckoutStep;
  readonly OrderTypeEnum = OrderTypeEnum;
  readonly PaymentMethodEnum = PaymentMethodEnum;

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

  // ─── Pagamento ──────────────────────────────────────────────────────────────
  paymentEntries = signal<PaymentEntry[]>([]);
  isProcessing = signal(false);

  // ─── Computed ───────────────────────────────────────────────────────────────
  isDelivery = computed(() => this.orderType() === OrderTypeEnum.DELIVERY);
  isPickup = computed(() => this.orderType() === OrderTypeEnum.PICKUP);
  isCounter = computed(() => this.orderType() === null);

  deliveryFieldsValid = computed(() => {
    if (this.isDelivery()) {
      return !!(
        this.deliveryTime().trim() &&
        this.deliveryAddress().trim() &&
        this.customerPhone().trim()
      );
    }
    if (this.isPickup()) {
      return !!(this.deliveryTime().trim() && this.customerPhone().trim());
    }
    return true;
  });

  remainingAmount = computed(() => {
    const sum = this.paymentEntries().reduce((acc, e) => acc + (e.amount || 0), 0);
    return Math.round((this.sale.total_amount - sum) * 100) / 100;
  });

  changeAmount = computed(() => {
    const hasCash = this.paymentEntries().some(e => e.method === PaymentMethodEnum.CASH);
    const remaining = this.remainingAmount();
    return hasCash && remaining < 0 ? Math.round(Math.abs(remaining) * 100) / 100 : 0;
  });

  canFinalize = computed(() => {
    if (this.isProcessing()) return false;
    const entries = this.paymentEntries();
    if (entries.length === 0) return false;
    const allPositive = entries.every(e => e.amount > 0);
    return allPositive && this.remainingAmount() <= 0.01;
  });

  canAddEntry = computed(() => {
    return this.paymentEntries().length < 3 && this.remainingAmount() > 0;
  });

  /** Nome do cliente preenchido — obrigatório na etapa 1 */
  canAdvance = computed(() => !!this.customerName().trim());

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

  constructor(
    private saleService: SaleService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
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
      };
      this.saleService.updateOrderDetails(this.sale.id, payload).subscribe({
        next: () => {
          this.isProcessing.set(false);
          this._initPaymentEntries();
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
    };
    if (this.isDelivery() || this.isPickup()) {
      payload.delivery_time = this.deliveryTime().trim() || null;
      payload.customer_phone = this.customerPhone().trim() || null;
      payload.delivery_payment_method = this.deliveryPaymentMethod();
      payload.is_paid = this.isPaid();
    }
    if (this.isDelivery()) {
      payload.delivery_address = this.deliveryAddress().trim() || null;
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
      next: () => {
        this.isProcessing.set(false);
        if (!this.isPaid()) {
          // Reserva: finaliza sem pagamento imediato
          this._finalizeReservation();
        } else {
          // Pago: abre etapa de pagamento
          this._initPaymentEntries();
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

  private _initPaymentEntries(): void {
    this.paymentEntries.set([
      { method: PaymentMethodEnum.PIX, amount: this.sale.total_amount },
    ]);
  }

  addPaymentEntry(): void {
    const remaining = Math.max(0, this.remainingAmount());
    this.paymentEntries.update(entries => [
      ...entries,
      { method: PaymentMethodEnum.PIX, amount: remaining },
    ]);
  }

  removePaymentEntry(index: number): void {
    this.paymentEntries.update(entries => entries.filter((_, i) => i !== index));
  }

  updateEntryMethod(index: number, method: PaymentMethodEnum): void {
    this.paymentEntries.update(entries =>
      entries.map((e, i) => (i === index ? { ...e, method } : e))
    );
  }

  updateEntryAmount(index: number, amount: number): void {
    const parsed = parseFloat(String(amount)) || 0;
    this.paymentEntries.update(entries =>
      entries.map((e, i) => (i === index ? { ...e, amount: parsed } : e))
    );
  }

  finalizeSale(): void {
    if (!this.canFinalize()) return;
    this.isProcessing.set(true);

    const payments: PaymentIn[] = this.paymentEntries()
      .filter(e => e.amount > 0)
      .map(e => ({ method: e.method, amount: e.amount }));

    this.saleService.finalize(this.sale.id, { payments }).subscribe({
      next: () => {
        this.toastService.success('Venda finalizada com sucesso!');
        this.isProcessing.set(false);
        this.completed.emit();
      },
      error: () => {
        this.isProcessing.set(false);
      },
    });
  }

  // ─── Reserva (sem pagamento imediato) ───────────────────────────────────────

  private _finalizeReservation(): void {
    this.isProcessing.set(true);
    const msg = this.isDelivery() ? '🚚 Pedido de entrega reservado!' : '🏪 Retirada agendada!';

    this.saleService.finalize(this.sale.id, { payments: [] }).subscribe({
      next: () => {
        this.toastService.success(msg);
        this.isProcessing.set(false);
        this.completed.emit();
      },
      error: () => {
        this.isProcessing.set(false);
        this.toastService.error('Erro ao reservar pedido.');
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  getProductName(productId: number): string {
    return this.products.find(p => p.id === productId)?.name || `Produto #${productId}`;
  }
}
