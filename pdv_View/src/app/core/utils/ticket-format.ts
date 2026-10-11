import { OrderTypeEnum, PaymentMethodEnum, Sale } from '../models';

/**
 * Helpers puros de formatação da comanda (order-ticket-printing).
 * Valores Decimal chegam da API como string: todos os helpers aceitam
 * number | string e convertem com Number().
 */

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor em reais: "R$ 1.234,56" (espaço normal, sem NBSP) */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return moneyFormatter.format(Number.isFinite(n) ? n : 0).replace(/ /g, ' ');
}

/** Quantidade: inteira sem casas decimais; fracionada com até 3 casas e vírgula */
export function formatQty(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(3).replace(/0+$/, '').replace('.', ',');
}

/** Tipo do pedido: BALCÃO (nulo), RETIRADA ou ENTREGA */
export function orderTypeLabel(type: OrderTypeEnum | null | undefined): string {
  switch (type) {
    case OrderTypeEnum.PICKUP:
      return 'RETIRADA';
    case OrderTypeEnum.DELIVERY:
      return 'ENTREGA';
    default:
      return 'BALCÃO';
  }
}

/** Método de pagamento em português */
export function paymentMethodLabel(method: PaymentMethodEnum | null | undefined): string {
  switch (method) {
    case PaymentMethodEnum.CASH:
      return 'Dinheiro';
    case PaymentMethodEnum.CARD:
      return 'Cartão';
    case PaymentMethodEnum.PIX:
      return 'PIX';
    default:
      return '';
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data/hora no fuso do navegador em dd/MM/yyyy HH:mm ('' se inválida) */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/** Data/hora do pedido: closed_at, ou opened_at quando closed_at é nulo */
export function ticketDateTime(sale: Pick<Sale, 'closed_at' | 'opened_at'>): string {
  return formatDateTime(sale.closed_at ?? sale.opened_at);
}
