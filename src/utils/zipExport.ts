import JSZip from 'jszip';
import { ReceiptData } from '../types/receipt';
import { generateReceiptPdf, getReceiptPdfBlob } from './pdfGenerator';
import { formatFileName } from '../data';

export interface ExportProgress {
  current: number;
  total: number;
  currentName: string;
}

export async function exportReceiptsToZip(
  receipts: ReceiptData[],
  namingPattern: string,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('recibos_separados') || zip;

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    const fileName = formatFileName(receipt, namingPattern);

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: receipts.length,
        currentName: fileName,
      });
    }

    const { bytes } = await getReceiptPdfBlob(receipt);
    folder.file(fileName, bytes);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return zipBlob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Keep URL alive for 60 seconds so browser download and viewer can complete
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
