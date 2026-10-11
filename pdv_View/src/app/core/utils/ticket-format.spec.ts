import { OrderTypeEnum, PaymentMethodEnum } from '../models';
import {
  formatDateTime,
  formatMoney,
  formatQty,
  orderTypeLabel,
  paymentMethodLabel,
  ticketDateTime,
} from './ticket-format';

describe('ticket-format', () => {
  describe('formatQty', () => {
    it('mostra quantidade inteira sem casas decimais', () => {
      expect(formatQty(2)).toBe('2');
      expect(formatQty('3.000')).toBe('3');
    });

    it('mostra quantidade fracionada com até 3 casas e vírgula', () => {
      expect(formatQty(0.5)).toBe('0,5');
      expect(formatQty('1.250')).toBe('1,25');
      expect(formatQty(0.125)).toBe('0,125');
    });
  });

  describe('formatMoney', () => {
    it('formata em reais com milhar e centavos', () => {
      expect(formatMoney(1234.56)).toBe('R$ 1.234,56');
      expect(formatMoney('85.00')).toBe('R$ 85,00');
      expect(formatMoney(null)).toBe('R$ 0,00');
    });
  });

  describe('orderTypeLabel', () => {
    it('rotula Balcão, Retirada e Entrega', () => {
      expect(orderTypeLabel(null)).toBe('BALCÃO');
      expect(orderTypeLabel(undefined)).toBe('BALCÃO');
      expect(orderTypeLabel(OrderTypeEnum.PICKUP)).toBe('RETIRADA');
      expect(orderTypeLabel(OrderTypeEnum.DELIVERY)).toBe('ENTREGA');
    });
  });

  describe('paymentMethodLabel', () => {
    it('rotula os métodos em português', () => {
      expect(paymentMethodLabel(PaymentMethodEnum.CASH)).toBe('Dinheiro');
      expect(paymentMethodLabel(PaymentMethodEnum.CARD)).toBe('Cartão');
      expect(paymentMethodLabel(PaymentMethodEnum.PIX)).toBe('PIX');
      expect(paymentMethodLabel(null)).toBe('');
    });
  });

  describe('ticketDateTime', () => {
    it('usa closed_at quando presente', () => {
      const closed = new Date(2026, 9, 11, 19, 5);
      const opened = new Date(2026, 9, 11, 18, 0);
      expect(
        ticketDateTime({ closed_at: closed.toISOString(), opened_at: opened.toISOString() })
      ).toBe('11/10/2026 19:05');
    });

    it('usa opened_at quando closed_at é nulo', () => {
      const opened = new Date(2026, 0, 2, 8, 30);
      expect(ticketDateTime({ closed_at: null, opened_at: opened.toISOString() })).toBe(
        '02/01/2026 08:30'
      );
    });

    it('retorna vazio para data inválida', () => {
      expect(formatDateTime('não é data')).toBe('');
    });
  });
});
