import {
  Component,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PaymentEntry,
  PaymentEntryState,
  PaymentIn,
  PaymentMethodEnum,
} from '../../../core/models';

const toCents = (value: number): number => Math.round((Number(value) || 0) * 100);
const fromCents = (cents: number): number => cents / 100;

/**
 * Normaliza as entradas digitadas em pagamentos enviáveis à API:
 *  - remove entradas <= 0 e arredonda a 2 casas;
 *  - desconta o troco (valor excedente) das entradas em dinheiro, da última
 *    para a primeira, removendo as que zerarem.
 * Retorna os pagamentos e o troco. Se o excedente não puder ser coberto por
 * dinheiro, a soma continua diferente do total (estado inválido).
 */
export function normalizePayments(
  entries: PaymentEntry[],
  total: number,
): { payments: PaymentIn[]; changeCents: number; remainingCents: number } {
  const totalCents = toCents(total);
  const cents = entries
    .map((e) => ({ method: e.method, cents: toCents(e.amount) }))
    .filter((e) => e.cents > 0);

  const sumCents = cents.reduce((acc, e) => acc + e.cents, 0);
  const remainingCents = totalCents - sumCents;
  const cashCents = cents
    .filter((e) => e.method === PaymentMethodEnum.CASH)
    .reduce((acc, e) => acc + e.cents, 0);
  // Troco só existe com dinheiro e limitado ao valor em dinheiro
  const changeCents = remainingCents < 0 ? Math.min(-remainingCents, cashCents) : 0;

  let toDeduct = changeCents;
  for (let i = cents.length - 1; i >= 0 && toDeduct > 0; i--) {
    if (cents[i].method !== PaymentMethodEnum.CASH) continue;
    const take = Math.min(cents[i].cents, toDeduct);
    cents[i].cents -= take;
    toDeduct -= take;
  }

  const payments = cents
    .filter((e) => e.cents > 0)
    .map((e) => ({ method: e.method, amount: fromCents(e.cents) }));

  return { payments, changeCents, remainingCents };
}

/**
 * Entrada de pagamentos (até `maxEntries` formas, restante e troco).
 * Usado no checkout (finalização) e na quitação de pedidos pendentes.
 * Emite `stateChange` com os pagamentos já normalizados (soma == total).
 */
@Component({
  selector: 'app-payment-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-entry.html',
  styleUrl: './payment-entry.scss',
})
export class PaymentEntryComponent implements OnInit {
  /** Total a pagar */
  total = input.required<number>();
  /** Forma inicial (ex.: forma prevista do pedido); padrão PIX */
  initialMethod = input<PaymentMethodEnum | null>(null);
  /** Máximo de formas de pagamento */
  maxEntries = input(3);

  stateChange = output<PaymentEntryState>();

  readonly paymentMethods = [
    { value: PaymentMethodEnum.PIX, label: 'PIX', icon: '⚡' },
    { value: PaymentMethodEnum.CARD, label: 'Cartão', icon: '💳' },
    { value: PaymentMethodEnum.CASH, label: 'Dinheiro', icon: '💵' },
  ];

  paymentEntries = signal<PaymentEntry[]>([]);

  private normalized = computed(() => normalizePayments(this.paymentEntries(), this.total()));

  /** Valor que falta (> 0) ou excedente (< 0), sobre os valores digitados */
  remainingAmount = computed(() => fromCents(this.normalized().remainingCents));

  /** Troco a devolver em dinheiro */
  changeAmount = computed(() => fromCents(this.normalized().changeCents));

  state = computed<PaymentEntryState>(() => {
    const entries = this.paymentEntries();
    const { payments, changeCents } = this.normalized();
    const totalCents = toCents(this.total());
    const sumCents = payments.reduce((acc, p) => acc + toCents(p.amount), 0);
    const valid =
      entries.length > 0 &&
      entries.every((e) => toCents(e.amount) > 0) &&
      payments.length > 0 &&
      totalCents > 0 &&
      sumCents === totalCents;
    return {
      payments,
      valid,
      remaining: this.remainingAmount(),
      change: fromCents(changeCents),
    };
  });

  canAddEntry = computed(
    () => this.paymentEntries().length < this.maxEntries() && this.remainingAmount() > 0,
  );

  constructor() {
    effect(() => {
      const state = this.state();
      untracked(() => this.stateChange.emit(state));
    });
  }

  ngOnInit(): void {
    this.reset();
  }

  /** Reinicia com uma única entrada do total na forma inicial */
  reset(): void {
    this.paymentEntries.set([
      { method: this.initialMethod() ?? PaymentMethodEnum.PIX, amount: this.total() },
    ]);
  }

  addPaymentEntry(): void {
    const remaining = Math.max(0, this.remainingAmount());
    this.paymentEntries.update((entries) => [
      ...entries,
      { method: PaymentMethodEnum.PIX, amount: remaining },
    ]);
  }

  removePaymentEntry(index: number): void {
    this.paymentEntries.update((entries) => entries.filter((_, i) => i !== index));
  }

  updateEntryMethod(index: number, method: PaymentMethodEnum): void {
    this.paymentEntries.update((entries) =>
      entries.map((e, i) => (i === index ? { ...e, method } : e)),
    );
  }

  updateEntryAmount(index: number, amount: number): void {
    const parsed = parseFloat(String(amount)) || 0;
    this.paymentEntries.update((entries) =>
      entries.map((e, i) => (i === index ? { ...e, amount: parsed } : e)),
    );
  }
}
