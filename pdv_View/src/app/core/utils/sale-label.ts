import { Sale } from '../models';

/** Rótulo do pedido: "Pedido #N" (número do dia) ou "Venda #id" (vendas sem número) */
export function saleLabel(sale: Pick<Sale, 'id' | 'daily_number'>): string {
  return sale.daily_number != null ? `Pedido #${sale.daily_number}` : `Venda #${sale.id}`;
}
