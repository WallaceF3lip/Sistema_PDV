import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PrintService } from '../../../core/services/print.service';
import { OrderTicketComponent } from '../order-ticket/order-ticket.component';

/**
 * Área de impressão da comanda, fora do layout e do router-outlet.
 * Oculta na tela; no @media print (com body.is-printing-ticket) é a única
 * coisa visível. Renderiza as vias do job atual do PrintService.
 */
@Component({
  selector: 'app-print-root',
  standalone: true,
  imports: [OrderTicketComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="print-root" aria-hidden="true">
      @if (printService.job(); as job) {
        @for (copy of job.copies; track $index) {
          <app-order-ticket [sale]="job.sale" [copyLabel]="copy.label" [extras]="job.extras" />
        }
      }
    </div>
  `,
})
export class PrintRootComponent {
  readonly printService = inject(PrintService);
}
