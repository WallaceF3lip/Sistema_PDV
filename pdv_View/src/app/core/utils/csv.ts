/**
 * Exportação CSV no navegador, compatível com Excel em português:
 * UTF-8 com BOM, separador `;` e decimais com vírgula.
 */

export type CsvCell = string | number | null | undefined;

const SEPARATOR = ';';

/** Formata um número com vírgula decimal e sem separador de milhar. */
export function formatCsvNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false,
  });
}

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  const text = typeof cell === 'number' ? formatCsvNumber(cell) : String(cell);
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Monta o conteúdo CSV (sem BOM). Números são formatados com 2 casas; passe strings para outros formatos. */
export function buildCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(SEPARATOR)).join('\r\n');
}

/** Gera e baixa o arquivo CSV. */
export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]): void {
  const blob = new Blob(['﻿' + buildCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
