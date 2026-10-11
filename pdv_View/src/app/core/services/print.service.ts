import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
import { Sale } from '../models';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';

/** Dados opcionais exibidos só na impressão feita no checkout */
export interface TicketExtras {
  /** Valor recebido em dinheiro (entradas CASH + troco) */
  cashReceived?: number;
  change?: number;
}

export interface PrintTicketOptions extends TicketExtras {
  /** Vias (padrão: environment.ticket.copies). Ignorado na reimpressão */
  copies?: 1 | 2;
  /** Reimpressão: sempre 1 via marcada "REIMPRESSÃO" */
  reprint?: boolean;
}

export interface PrintCopy {
  label: string | null;
}

export interface PrintJob {
  sale: Sale;
  copies: PrintCopy[];
  extras: TicketExtras | null;
}

/** Classe no body que ativa o modo de impressão da comanda (styles.scss) */
export const PRINTING_BODY_CLASS = 'is-printing-ticket';
/** Libera a fila se o afterprint nunca disparar */
export const PRINT_SAFETY_TIMEOUT_MS = 60_000;

/**
 * Impressão da comanda do pedido pelo diálogo do navegador (window.print).
 * O job atual é renderizado pelo PrintRootComponent; o @media print global
 * esconde o restante do app enquanto o body tem a classe is-printing-ticket.
 * Pedidos de impressão entram numa fila e são atendidos um por vez.
 */
@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly toastService = inject(ToastService);

  /** Job em impressão (lido pelo PrintRootComponent) */
  readonly job = signal<PrintJob | null>(null);

  private readonly queue: PrintJob[] = [];
  private busy = false;

  /** Indica se a impressão de comanda está disponível */
  canPrint(): boolean {
    return typeof window !== 'undefined' && typeof window.print === 'function';
  }

  /** Envia a comanda do pedido (SaleOut completo, com itens nomeados) para impressão */
  printOrderTicket(sale: Sale, options?: PrintTicketOptions): void {
    if (!sale || !this.canPrint()) return;
    this.queue.push(this.buildJob(sale, options));
    if (!this.busy) this.processNext();
  }

  /** Monta as vias: reimpressão (1 via), 2 vias (cozinha/cliente) ou via única */
  buildJob(sale: Sale, options?: PrintTicketOptions): PrintJob {
    let copies: PrintCopy[];
    if (options?.reprint) {
      copies = [{ label: 'REIMPRESSÃO' }];
    } else {
      const count = options?.copies ?? environment.ticket?.copies ?? 1;
      copies = count === 2 ? [{ label: 'VIA COZINHA' }, { label: 'VIA CLIENTE' }] : [{ label: null }];
    }

    const change = Number(options?.change ?? 0);
    const extras: TicketExtras | null =
      !options?.reprint && change > 0
        ? { cashReceived: Number(options?.cashReceived ?? 0), change }
        : null;

    return { sale, copies, extras };
  }

  private processNext(): void {
    const next = this.queue.shift();
    if (!next) {
      this.busy = false;
      return;
    }
    this.busy = true;

    try {
      this.job.set(next);
      this.document.body.classList.add(PRINTING_BODY_CLASS);
      // Espera a comanda ser renderizada antes do snapshot de impressão
      afterNextRender(() => setTimeout(() => this.doPrint(), 50), { injector: this.injector });
    } catch (err) {
      this.notifyError(err);
      this.document.body.classList.remove(PRINTING_BODY_CLASS);
      this.job.set(null);
      this.processNext();
    }
  }

  private doPrint(): void {
    const win = this.document.defaultView ?? window;
    let finished = false;
    let safety: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      win.removeEventListener('afterprint', finish);
      if (safety !== undefined) clearTimeout(safety);
      this.document.body.classList.remove(PRINTING_BODY_CLASS);
      this.job.set(null);
      this.processNext();
    };

    try {
      win.addEventListener('afterprint', finish, { once: true });
      safety = setTimeout(finish, PRINT_SAFETY_TIMEOUT_MS);
      win.print();
      // print() é bloqueante no Chrome desktop: ao retornar, o diálogo já fechou
      finish();
    } catch (err) {
      this.notifyError(err);
      finish();
    }
  }

  /** Falha ao preparar/imprimir: avisa o operador. Nunca relança. */
  private notifyError(err: unknown): void {
    console.error('[PrintService] Falha ao imprimir comanda.', err);
    try {
      this.toastService.error('Não foi possível imprimir a comanda.');
    } catch {
      /* ignora */
    }
  }
}
