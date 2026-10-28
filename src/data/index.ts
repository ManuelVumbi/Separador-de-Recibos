import { batch1Receipts } from './batch1';
import { batch2Receipts } from './batch2';
import { ReceiptData } from '../types/receipt';

export const allInitialReceipts: ReceiptData[] = [
  ...batch1Receipts,
  ...batch2Receipts,
];

export function sanitizeFileName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function formatFileName(
  receipt: Partial<ReceiptData> | null | undefined,
  pattern: string
): string {
  if (!receipt) return 'Recibo.pdf';

  const rawName = (receipt.employeeName || 'Colaborador').trim();
  const cleanName = sanitizeFileName(rawName) || 'Colaborador';
  const mecan = String(receipt.mechanicalNumber || '0000').trim();
  const period = sanitizeFileName(receipt.period || '') || 'Geral';
  const category = sanitizeFileName(receipt.category || '') || 'Geral';

  let currentPattern = pattern && pattern.trim() ? pattern.trim() : 'Recibo_{MECAN}_{NOME_LIMPO}.pdf';

  // Replace placeholders case-insensitively using replacer functions to avoid $ substitution bugs
  let formatted = currentPattern
    .replace(/\{NOME_LIMPO\}/gi, () => cleanName)
    .replace(/\{NOME\}/gi, () => rawName)
    .replace(/\{MECAN\}/gi, () => mecan)
    .replace(/\{PERIODO\}/gi, () => period)
    .replace(/\{CATEGORIA\}/gi, () => category);

  if (!formatted.toLowerCase().endsWith('.pdf')) {
    formatted += '.pdf';
  }
  return formatted;
}
