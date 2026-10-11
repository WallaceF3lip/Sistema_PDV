import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OrderTypeEnum, Sale, SaleItem, SaleStatusEnum } from '../../../core/models';
import { TicketExtras } from '../../../core/services/print.service';
import { saleLabel } from '../../../core/utils/sale-label';
import {
  formatDateTime,
  formatMoney,
  formatQty,
  orderTypeLabel,
  paymentMethodLabel,
  ticketDateTime,
} from '../../../core/utils/ticket-format';
import { environment } from '../../../../environments/environment';

/**
 * Comanda do pedido para bobina térmica de 58 mm (área útil de 48 mm).
 * Renderizada apenas pelo PrintRootComponent durante a impressão.
 */
@Component({
  selector: 'app-order-ticket',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-ticket.html',
  styleUrl: './order-ticket.scss',
})
export class OrderTicketComponent {
  sale = input.required<Sale>();
  /** "VIA COZINHA", "VIA CLIENTE", "REIMPRESSÃO" ou null (via única) */
  copyLabel = input<string | null>(null);
  /** Valor recebido em dinheiro e troco (só na impressão feita no checkout) */
  extras = input<TicketExtras | null>(null);

  readonly money = formatMoney;
  readonly qty = formatQty;
  readonly methodLabel = paymentMethodLabel;

  readonly establishmentName =
    (environment.establishment?.name ?? '').trim() || 'PDV';
  readonly establishmentPhone = (environment.establishment?.phone ?? '').trim();
  readonly footerMessage =
    (environment.establishment?.footer ?? '').trim() || 'Obrigado pela preferência!';

  label = computed(() => saleLabel(this.sale()));
  dateTime = computed(() => ticketDateTime(this.sale()));
  typeLabel = computed(() => orderTypeLabel(this.sale().order_type));
  /** Horário rotulado "Entrega:" ou "Retirada:" (Balcão não tem horário) */
  timeLabel = computed(() => {
    const type = this.sale().order_type;
    if (type === OrderTypeEnum.DELIVERY) return 'Entrega:';
    if (type === OrderTypeEnum.PICKUP) return 'Retirada:';
    return null;
  });

  itemsTotal = computed(() => {
    const sale = this.sale();
    if (sale.items_total !== undefined && sale.items_total !== null) return Number(sale.items_total);
    return sale.items.reduce((acc, i) => acc + Number(i.subtotal), 0);
  });
  deliveryFee = computed(() => Number(this.sale().delivery_fee ?? 0));
  total = computed(() => Number(this.sale().total_amount ?? 0));

  isPaid = computed(() => this.sale().status === SaleStatusEnum.PAID);
  isPending = computed(() => this.sale().status === SaleStatusEnum.PENDING);
  pendingMethod = computed(() => paymentMethodLabel(this.sale().delivery_payment_method));

  showChange = computed(() => {
    const e = this.extras();
    return this.isPaid() && !!e && Number(e.change ?? 0) > 0;
  });

  /** Momento da impressão (calculado na criação da comanda) */
  readonly printedAt = ((full: string) => `${full.slice(0, 5)} ${full.slice(11)}`)(
    formatDateTime(new Date())
  );

  itemName(item: SaleItem): string {
    return item.product_name?.trim() || `Produto #${item.product_id}`;
  }
}
