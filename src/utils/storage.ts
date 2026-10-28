import { ReceiptData, BatchHistoryRecord } from '../types/receipt';
import { allInitialReceipts } from '../data';
import { saveMultipleOriginalPdfBytes, getAllOriginalPdfBytes } from './pdfStorage';

const RECEIPTS_STORAGE_KEY = 'recibos_vencimento_list_v1';
const HISTORY_STORAGE_KEY = 'recibos_vencimento_history_v1';

export function loadReceiptsFromStorage(): ReceiptData[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_STORAGE_KEY);
    if (!raw) {
      saveReceiptsToStorage(allInitialReceipts);
      return allInitialReceipts;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allInitialReceipts;

    // Automatically correct any legacy records that had the dummy 640000 netPay placeholder
    let hadCorrections = false;
    const cleaned = parsed.map((r: ReceiptData) => {
      if (r.netPay === 640000 || !r.netPay) {
        const match = allInitialReceipts.find(
          (k) =>
            (r.mechanicalNumber && k.mechanicalNumber === r.mechanicalNumber) ||
            (r.employeeName && k.employeeName.toLowerCase() === r.employeeName.toLowerCase())
        );
        if (match) {
          hadCorrections = true;
          return {
            ...r,
            netPay: match.netPay,
            totalEarnings: match.totalEarnings,
            totalDeductions: match.totalDeductions,
            items: r.items && r.items.length > 0 && r.items[0]?.earnings !== 450000 ? r.items : match.items,
          };
        }
      }
      return r;
    });

    if (hadCorrections) {
      saveReceiptsToStorage(cleaned);
    }

    return cleaned.map((r: any) => {
      let originalPdfBytes: Uint8Array | undefined = undefined;
      if (r.originalPdfBytes) {
        if (r.originalPdfBytes instanceof Uint8Array && r.originalPdfBytes.length > 0) {
          originalPdfBytes = r.originalPdfBytes;
        } else if (typeof r.originalPdfBytes === 'object') {
          const vals = Object.values(r.originalPdfBytes);
          if (vals.length > 0 && typeof vals[0] === 'number') {
            originalPdfBytes = new Uint8Array(vals as number[]);
          }
        }
      }
      return {
        ...r,
        originalPdfBytes,
      };
    });
  } catch (err) {
    console.error('Erro ao ler recibos do localStorage:', err);
    return allInitialReceipts;
  }
}

export function saveReceiptsToStorage(receipts: ReceiptData[]): void {
  try {
    // 1. Save metadata to localStorage (without huge binary blobs to respect quota)
    const serialized = receipts.map(({ originalPdfBytes, ...rest }) => rest);
    localStorage.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(serialized));

    // 2. Persist all original PDF page byte buffers into IndexedDB
    const recordsToStore = receipts
      .filter((r) => r.originalPdfBytes && r.originalPdfBytes.length > 0)
      .map((r) => ({ id: r.id, bytes: r.originalPdfBytes as Uint8Array }));

    if (recordsToStore.length > 0) {
      saveMultipleOriginalPdfBytes(recordsToStore);
    }
  } catch (err) {
    console.error('Erro ao gravar recibos no localStorage:', err);
  }
}

// Hydrate receipts with their original PDF page bytes from IndexedDB
export async function hydrateReceiptsFromPdfStorage(receipts: ReceiptData[]): Promise<ReceiptData[]> {
  try {
    const map = await getAllOriginalPdfBytes();
    if (!map || map.size === 0) return receipts;

    let changed = false;
    const hydrated = receipts.map((r) => {
      if (!r.originalPdfBytes && map.has(r.id)) {
        changed = true;
        return {
          ...r,
          originalPdfBytes: map.get(r.id),
        };
      }
      return r;
    });

    return changed ? hydrated : receipts;
  } catch (err) {
    console.warn('Erro ao hidratar PDFs originais do IndexedDB:', err);
    return receipts;
  }
}

export function resetReceiptsToDefault(): ReceiptData[] {
  saveReceiptsToStorage(allInitialReceipts);
  return allInitialReceipts;
}

export function loadHistoryFromStorage(): BatchHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      // Seed with initial processed batches
      const initialHistory: BatchHistoryRecord[] = [
        {
          id: 'hist-init-01',
          timestamp: new Date().toLocaleString('pt-PT'),
          batchName: 'Lote 1 (30 Recibos) - Primavera BSS',
          actionType: 'export_zip',
          receiptCount: 30,
          totalAmount: 20286702.48,
          currency: 'AKZ',
          patternUsed: 'Recibo_{MECAN}_{NOME_LIMPO}.pdf',
          receiptNames: allInitialReceipts.slice(0, 30).map((r) => r.employeeName),
          notes: 'Separação e indexação automática inicial do Lote 1',
        },
        {
          id: 'hist-init-02',
          timestamp: new Date().toLocaleString('pt-PT'),
          batchName: 'Lote 2 (27 Recibos) - Primavera BSS',
          actionType: 'export_zip',
          receiptCount: 27,
          totalAmount: 18456120.15,
          currency: 'AKZ',
          patternUsed: 'Recibo_{MECAN}_{NOME_LIMPO}.pdf',
          receiptNames: allInitialReceipts.slice(30).map((r) => r.employeeName),
          notes: 'Separação e indexação automática inicial do Lote 2',
        },
      ];
      saveHistoryToStorage(initialHistory);
      return initialHistory;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler histórico do localStorage:', err);
    return [];
  }
}

export function saveHistoryToStorage(history: BatchHistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Erro ao gravar histórico no localStorage:', err);
  }
}

export function addHistoryRecord(record: Omit<BatchHistoryRecord, 'id' | 'timestamp'>): BatchHistoryRecord {
  const history = loadHistoryFromStorage();
  const newRecord: BatchHistoryRecord = {
    ...record,
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleString('pt-PT'),
  };
  const updated = [newRecord, ...history];
  saveHistoryToStorage(updated);
  return newRecord;
}
