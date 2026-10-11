import { DeliveryZoneBrief } from './delivery-zone.model';

export interface CustomerAddress {
  id: number;
  customer_id: number;
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood: string;
  reference?: string | null;
  is_default: boolean;
  delivery_zone_id?: number | null;
  delivery_zone?: DeliveryZoneBrief | null;
}

export interface Customer {
  id: number;
  name: string;
  /** Apenas dígitos (10 ou 11) */
  phone?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  /** Endereço padrão primeiro */
  addresses: CustomerAddress[];
}

export interface CustomerAddressCreate {
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood: string;
  reference?: string | null;
  is_default?: boolean;
  delivery_zone_id?: number | null;
}

export interface CustomerAddressUpdate {
  street?: string;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string;
  reference?: string | null;
  is_default?: boolean;
  /** null remove o vínculo com a zona */
  delivery_zone_id?: number | null;
}

export interface CustomerCreate {
  name: string;
  phone?: string | null;
  notes?: string | null;
  addresses?: CustomerAddressCreate[];
}

export interface CustomerUpdate {
  name?: string;
  phone?: string | null;
  notes?: string | null;
  /** Somente ADMIN */
  is_active?: boolean;
}

/** Tamanho máximo de `sales.delivery_address` */
const MAX_ADDRESS_LENGTH = 500;

/**
 * Formata o endereço como snapshot textual da venda:
 * "{street}, {number} - {complement} - {neighborhood} (Ref: {reference})",
 * omitindo partes vazias e truncando a 500 caracteres.
 */
export function formatAddress(
  addr: Pick<CustomerAddress, 'street' | 'number' | 'complement' | 'neighborhood' | 'reference'> | null | undefined
): string {
  if (!addr) return '';
  const clean = (v?: string | null) => (v ?? '').trim();

  const street = clean(addr.street);
  const number = clean(addr.number);
  const first = [street, number].filter(Boolean).join(', ');

  const parts = [first, clean(addr.complement), clean(addr.neighborhood)].filter(Boolean);
  let text = parts.join(' - ');

  const reference = clean(addr.reference);
  if (reference) {
    text = text ? `${text} (Ref: ${reference})` : `(Ref: ${reference})`;
  }
  return text.slice(0, MAX_ADDRESS_LENGTH);
}

/** Aplica máscara de exibição: (00) 00000-0000 ou (00) 0000-0000 */
export function formatPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone ?? '';
}
