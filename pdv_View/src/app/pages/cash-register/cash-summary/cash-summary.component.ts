import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CashRegisterSummary,
  ChannelSummary,
  PaymentMethodEnum,
  PaymentMethodTotal,
  SalesChannel,
} from '../../../core/models';

/**
 * Resumo do caixa: blocos "Balcão" e "Delivery (Retirada + Entrega)" e bloco
 * geral (líquido, estornos, a receber, dinheiro esperado, contagem/diferença).
 * Reutilizado na aba "Caixa atual" e no histórico.
 */
@Component({
  selector: 'app-cash-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cash-summary.html',
  styleUrl: './cash-summary.scss',
})
export class CashSummaryComponent {
  @Input({ required: true }) summary!: CashRegisterSummary;

  readonly methods: PaymentMethodEnum[] = [
    PaymentMethodEnum.CASH,
    PaymentMethodEnum.CARD,
    PaymentMethodEnum.PIX,
  ];

  readonly channelLabels: Record<SalesChannel, string> = {
    COUNTER: 'Balcão',
    DELIVERY: 'Delivery (Retirada + Entrega)',
  };

  methodLabel(method: PaymentMethodEnum | string): string {
    const labels: Record<string, string> = { CASH: 'Dinheiro', CARD: 'Cartão', PIX: 'PIX' };
    return labels[method] ?? method;
  }

  /** Sempre Balcão e Delivery, nesta ordem (zerados se ausentes). */
  channels(): ChannelSummary[] {
    const order: SalesChannel[] = ['COUNTER', 'DELIVERY'];
    return order.map(
      (code) =>
        this.summary.by_channel.find((c) => c.channel === code) ?? {
          channel: code,
          sales_count: 0,
          net_total: 0,
          delivery_fees_total: 0,
          by_payment_method: [],
        }
    );
  }

  amountFor(list: PaymentMethodTotal[], method: PaymentMethodEnum): number {
    return Number(list.find((p) => p.method === method)?.amount ?? 0);
  }

  isClosed(): boolean {
    return this.summary.status === 'CLOSED';
  }

  toNumber(value: number | string | null | undefined): number {
    return Number(value ?? 0);
  }
}
