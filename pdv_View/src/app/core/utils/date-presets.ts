/**
 * Atalhos de período para relatórios.
 * Todas as datas são strings `YYYY-MM-DD`; a aritmética é feita em UTC sobre
 * essas strings (independe do fuso do navegador). "Hoje" é o dia do
 * calendário em America/Sao_Paulo (a hora de virada do dia de operação não
 * é aplicada aqui).
 */

export type DatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'WEEKEND';

export interface DateRange {
  start: string;
  end: string;
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  TODAY: 'Hoje',
  YESTERDAY: 'Ontem',
  LAST_7_DAYS: 'Últimos 7 dias',
  THIS_MONTH: 'Este mês',
  LAST_MONTH: 'Mês passado',
  WEEKEND: 'Fim de semana',
};

const BUSINESS_TZ = 'America/Sao_Paulo';

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Quantidade de dias do intervalo, contando os dois extremos. */
export function daysInRange(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000) + 1;
}

/** Calcula o intervalo do atalho a partir de `today` (YYYY-MM-DD). */
export function presetRange(preset: DatePreset, today: string): DateRange {
  const t = parse(today);
  switch (preset) {
    case 'TODAY':
      return { start: today, end: today };
    case 'YESTERDAY': {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case 'LAST_7_DAYS':
      return { start: addDays(today, -6), end: today };
    case 'THIS_MONTH':
      return { start: format(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), end: today };
    case 'LAST_MONTH': {
      const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return { start: format(start), end: format(end) };
    }
    case 'WEEKEND': {
      // 0=dom ... 5=sex, 6=sáb
      const dow = t.getUTCDay();
      if (dow === 5) return { start: today, end: today };
      if (dow === 6) return { start: addDays(today, -1), end: today };
      if (dow === 0) return { start: addDays(today, -2), end: today };
      // Seg–qui: sexta a domingo anteriores
      const lastSunday = addDays(today, -dow);
      return { start: addDays(lastSunday, -2), end: lastSunday };
    }
  }
}
