export interface DeliveryZone {
  id: number;
  name: string;
  /** Decimal serializado pela API; convertido com Number() no service */
  fee: number;
  is_active: boolean;
}

/** Resumo da zona retornado junto do endereço do cliente */
export type DeliveryZoneBrief = DeliveryZone;

export interface DeliveryZoneCreate {
  name: string;
  fee: number;
}

export interface DeliveryZoneUpdate {
  name?: string;
  fee?: number;
  is_active?: boolean;
}

const normalizeZoneName = (v: string | null | undefined) =>
  (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Sugere a zona ativa cujo nome é igual ao bairro
 * (comparação sem maiúsculas e espaços nas extremidades).
 */
export function suggestZoneForNeighborhood(
  zones: DeliveryZone[],
  neighborhood: string | null | undefined
): DeliveryZone | null {
  const key = normalizeZoneName(neighborhood);
  if (!key) return null;
  return zones.find((z) => z.is_active && normalizeZoneName(z.name) === key) ?? null;
}
