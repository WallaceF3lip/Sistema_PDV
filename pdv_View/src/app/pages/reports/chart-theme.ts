/** Tema dos gráficos (mesmas fontes/cores/tooltip do Dashboard). */

export const CHART_COLORS = {
  primary: '#E05D53',
  primaryFill: 'rgba(224, 93, 83, 0.75)',
  primaryBorder: '#c74b42',
  accent: '#659A76',
  accentFill: 'rgba(101, 154, 118, 0.75)',
  accentBorder: '#4d7f5c',
  blue: '#3b82f6',
  blueBorder: '#2563eb',
  text: '#2D2825',
  muted: '#A89F9A',
  grid: 'rgba(168, 159, 154, 0.12)',
};

export const LEGEND_FONT = { family: "'Nunito', sans-serif", size: 13, weight: 600 } as const;
export const TICK_FONT = { family: "'Plus Jakarta Sans', sans-serif", size: 12 } as const;

export const LEGEND_LABELS = {
  font: LEGEND_FONT,
  color: CHART_COLORS.text,
  usePointStyle: true,
  pointStyleWidth: 18,
  padding: 18,
};

export const TOOLTIP_BASE = {
  backgroundColor: 'rgba(45, 40, 37, 0.92)',
  titleFont: { family: "'Outfit', sans-serif", size: 14, weight: 600 } as const,
  bodyFont: { family: "'Nunito', sans-serif", size: 13 } as const,
  cornerRadius: 12,
  padding: 14,
};

export const AXIS_TICKS = {
  font: TICK_FONT,
  color: CHART_COLORS.muted,
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value: number | string | null | undefined): string {
  return BRL.format(Number(value ?? 0));
}
