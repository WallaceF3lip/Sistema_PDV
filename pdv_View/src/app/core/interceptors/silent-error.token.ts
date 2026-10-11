import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Quando true, o errorInterceptor não exibe toast para a requisição
 * (ex.: polling do quadro, erros tratados inline em modais).
 * O tratamento de 401 (logout) é mantido.
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

/** HttpContext com SILENT_ERROR = true */
export function silentContext(): HttpContext {
  return new HttpContext().set(SILENT_ERROR, true);
}
