import { apiClient, ProductResponse } from './api';

export interface ParsedVoiceProduct {
  name: string;
  pack_size: string | number;
  unit: string;
  purchase_price: string | number;
  selling_price: string | number;
  stock_quantity: string | number;
  low_stock_threshold: string | number | null;
  category_name: string | null;
  barcode: string | null;
}

export interface PendingVoiceProduct extends ParsedVoiceProduct {
  _tempId: string;
}

export interface VoiceProductBatchCreateRequest {
  products: ParsedVoiceProduct[];
}

export interface VoiceProductBatchCreateResponse {
  created_count: number;
  products: ProductResponse[];
}

// Supported measurement and packaging units recognized by VoiceBill.AI backend
export const COMMON_UNITS = [
  { value: 'kg', label: 'kg (Kilogram)' },
  { value: 'g', label: 'g (Gram)' },
  { value: 'litre', label: 'litre (Liter)' },
  { value: 'ml', label: 'ml (Milliliter)' },
  { value: 'pcs', label: 'pcs (Pieces)' },
  { value: 'packet', label: 'packet (Packet)' },
  { value: 'pack', label: 'pack (Pack)' },
  { value: 'pouch', label: 'pouch (Pouch)' },
  { value: 'box', label: 'box (Box)' },
  { value: 'bottle', label: 'bottle (Bottle)' },
  { value: 'can', label: 'can (Can)' },
  { value: 'jar', label: 'jar (Jar)' },
  { value: 'tin', label: 'tin (Tin)' },
  { value: 'bag', label: 'bag (Bag)' },
  { value: 'sack', label: 'sack (Sack)' },
  { value: 'carton', label: 'carton (Carton)' },
  { value: 'dozen', label: 'dozen (Dozen)' },
  { value: 'strip', label: 'strip (Strip)' },
  { value: 'roll', label: 'roll (Roll)' },
  { value: 'meter', label: 'meter (Meter)' },
  { value: 'unit', label: 'unit (Unit)' },
];

/**
 * Parses a voice product command transcript into structured product attributes.
 * Strictly READ-ONLY; does NOT create or modify anything in PostgreSQL.
 */
export const parseVoiceProduct = async (command: string): Promise<ParsedVoiceProduct> => {
  const response = await apiClient.post<ParsedVoiceProduct>('/api/voice/products/parse', {
    command,
  });
  return response.data;
};

/**
 * Atomically creates a batch of reviewed and confirmed products in PostgreSQL.
 * If any product in the batch fails validation, the entire batch fails and ZERO products are created.
 */
export const createProductsBatch = async (
  products: ParsedVoiceProduct[]
): Promise<VoiceProductBatchCreateResponse> => {
  const payload: VoiceProductBatchCreateRequest = {
    products: products.map((p) => ({
      name: p.name.trim(),
      pack_size: p.pack_size,
      unit: p.unit.trim().toLowerCase(),
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold !== '' && p.low_stock_threshold !== null
        ? p.low_stock_threshold
        : null,
      category_name: p.category_name && p.category_name.trim() !== ''
        ? p.category_name.trim()
        : null,
      barcode: p.barcode && p.barcode.trim() !== ''
        ? p.barcode.trim()
        : null,
    })),
  };

  const response = await apiClient.post<VoiceProductBatchCreateResponse>(
    '/api/voice/products/create-batch',
    payload
  );
  return response.data;
};
