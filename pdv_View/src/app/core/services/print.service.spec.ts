import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sale, SaleStatusEnum } from '../models';
import { PRINTING_BODY_CLASS, PrintService } from './print.service';
import { ToastService } from './toast.service';

function makeSale(id: number): Sale {
  return {
    id,
    user_id: 1,
    status: SaleStatusEnum.PAID,
    total_amount: 10,
    opened_at: '2026-10-11T18:00:00Z',
    closed_at: '2026-10-11T18:10:00Z',
    items: [],
    payments: [],
    cash_register_id: 1,
    daily_number: id,
  };
}

/** Roda a detecção de mudanças (dispara afterNextRender) e o setTimeout de 50 ms */
async function flushRender(): Promise<void> {
  TestBed.inject(ApplicationRef).tick();
  await new Promise((r) => setTimeout(r, 60));
}

describe('PrintService', () => {
  let service: PrintService;
  let toast: { error: ReturnType<typeof vi.fn> };
  let printSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    toast = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ToastService, useValue: toast }],
    });
    service = TestBed.inject(PrintService);
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    printSpy.mockRestore();
    document.body.classList.remove(PRINTING_BODY_CLASS);
  });

  describe('vias', () => {
    it('monta 1 via sem rótulo por padrão', () => {
      const job = service.buildJob(makeSale(1), { copies: 1 });
      expect(job.copies).toEqual([{ label: null }]);
    });

    it('monta 2 vias cozinha/cliente', () => {
      const job = service.buildJob(makeSale(1), { copies: 2 });
      expect(job.copies.map((c) => c.label)).toEqual(['VIA COZINHA', 'VIA CLIENTE']);
    });

    it('reimpressão é sempre 1 via "REIMPRESSÃO" e sem troco', () => {
      const job = service.buildJob(makeSale(1), { copies: 2, reprint: true, change: 5, cashReceived: 15 });
      expect(job.copies).toEqual([{ label: 'REIMPRESSÃO' }]);
      expect(job.extras).toBeNull();
    });

    it('leva recebido/troco só quando troco > 0', () => {
      expect(service.buildJob(makeSale(1), { change: 0, cashReceived: 10 }).extras).toBeNull();
      expect(service.buildJob(makeSale(1), { change: 2.5, cashReceived: 12.5 }).extras).toEqual({
        cashReceived: 12.5,
        change: 2.5,
      });
    });
  });

  it('declara disponibilidade quando window.print existe', () => {
    expect(service.canPrint()).toBe(true);
  });

  it('imprime em fila, um job por vez, e limpa classe/job ao final', async () => {
    const printed: number[] = [];
    printSpy.mockImplementation(() => {
      expect(document.body.classList.contains(PRINTING_BODY_CLASS)).toBe(true);
      printed.push(service.job()!.sale.id);
    });

    service.printOrderTicket(makeSale(3));
    service.printOrderTicket(makeSale(4));
    expect(service.job()?.sale.id).toBe(3);

    await flushRender();
    expect(printed).toEqual([3]);
    expect(service.job()?.sale.id).toBe(4);

    await flushRender();
    expect(printed).toEqual([3, 4]);
    expect(service.job()).toBeNull();
    expect(document.body.classList.contains(PRINTING_BODY_CLASS)).toBe(false);
  });

  it('afterprint e retorno de print() não finalizam duas vezes', async () => {
    printSpy.mockImplementation(() => window.dispatchEvent(new Event('afterprint')));
    service.printOrderTicket(makeSale(1));
    service.printOrderTicket(makeSale(2));

    await flushRender();
    // O job 2 não pode ter sido descartado por um segundo finish()
    expect(service.job()?.sale.id).toBe(2);
    await flushRender();
    expect(printSpy).toHaveBeenCalledTimes(2);
    expect(service.job()).toBeNull();
  });

  it('erro em print() vira toast, não propaga e libera a fila', async () => {
    printSpy.mockImplementation(() => {
      throw new Error('falhou');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => service.printOrderTicket(makeSale(1))).not.toThrow();
    await flushRender();

    expect(toast.error).toHaveBeenCalledWith('Não foi possível imprimir a comanda.');
    expect(service.job()).toBeNull();
    expect(document.body.classList.contains(PRINTING_BODY_CLASS)).toBe(false);
  });
});
