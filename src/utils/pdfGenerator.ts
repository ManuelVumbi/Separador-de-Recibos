import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ReceiptData } from '../types/receipt';
import { getOriginalPdfBytes } from './pdfStorage';

export async function generateReceiptPdf(receipt: ReceiptData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 landscape (842 x 595) to match the original Primavera payslip layout
  const page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawSlip = (startX: number, titleCopy: string) => {
    // Header
    page.drawText(receipt.companyName.toUpperCase(), {
      x: startX,
      y: 560,
      size: 14,
      font: boldFont,
      color: rgb(0.08, 0.18, 0.36),
    });
    page.drawText(`NIF: ${receipt.companyNif}`, {
      x: startX,
      y: 546,
      size: 8,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(receipt.companyAddress, {
      x: startX,
      y: 535,
      size: 7,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText('RECIBO DE VENCIMENTOS', {
      x: startX,
      y: 512,
      size: 11,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(titleCopy, {
      x: startX + 320,
      y: 550,
      size: 9,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Box Header Info
    const infoY = 490;
    page.drawRectangle({
      x: startX,
      y: infoY - 60,
      width: 380,
      height: 70,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.75,
      color: rgb(0.98, 0.99, 1),
    });

    // Left info
    page.drawText(`Período: ${receipt.period}`, { x: startX + 8, y: infoY - 2, size: 8, font: boldFont });
    page.drawText(`Data Fecho: ${receipt.closingDate}`, { x: startX + 8, y: infoY - 14, size: 8, font: font });
    page.drawText(`N. Dias Mês: ${receipt.daysWorked}`, { x: startX + 8, y: infoY - 26, size: 8, font: font });
    page.drawText(`Venc./Hora: ${receipt.hourlyRate.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`, { x: startX + 8, y: infoY - 38, size: 8, font: font });

    // Right info
    page.drawText(`Nome: ${receipt.employeeName}`, { x: startX + 150, y: infoY - 2, size: 8.5, font: boldFont, color: rgb(0.05, 0.2, 0.45) });
    page.drawText(`N.º Mecan.: ${receipt.mechanicalNumber}   |   Benef.: ${receipt.beneficiaryNumber}`, { x: startX + 150, y: infoY - 14, size: 8, font: font });
    page.drawText(`Categoria: ${receipt.category}`, { x: startX + 150, y: infoY - 26, size: 8, font: font });
    page.drawText(`N.º Contrib.: ${receipt.taxNumber}`, { x: startX + 150, y: infoY - 38, size: 8, font: font });
    page.drawText(`Departamento: ${receipt.department}`, { x: startX + 150, y: infoY - 50, size: 8, font: font });

    // Table Header
    const tableY = 410;
    page.drawRectangle({
      x: startX,
      y: tableY - 14,
      width: 380,
      height: 16,
      color: rgb(0.12, 0.22, 0.4),
    });
    page.drawText('Cód', { x: startX + 4, y: tableY - 10, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Descrição', { x: startX + 32, y: tableY - 10, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Qtd', { x: startX + 180, y: tableY - 10, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Remunerações', { x: startX + 225, y: tableY - 10, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Descontos', { x: startX + 315, y: tableY - 10, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });

    // Table rows
    let currentY = tableY - 26;
    receipt.items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: startX,
          y: currentY - 3,
          width: 380,
          height: 12,
          color: rgb(0.96, 0.97, 0.98),
        });
      }
      page.drawText(item.code, { x: startX + 4, y: currentY, size: 7, font: font });
      page.drawText(item.desc.substring(0, 32), { x: startX + 32, y: currentY, size: 7, font: font });
      if (item.qty) {
        page.drawText(String(item.qty), { x: startX + 184, y: currentY, size: 7, font: font });
      }
      if (item.earnings) {
        page.drawText(item.earnings.toLocaleString('pt-PT', { minimumFractionDigits: 2 }), {
          x: startX + 225,
          y: currentY,
          size: 7,
          font: font,
        });
      }
      if (item.deductions) {
        page.drawText(item.deductions.toLocaleString('pt-PT', { minimumFractionDigits: 2 }), {
          x: startX + 315,
          y: currentY,
          size: 7,
          font: font,
          color: rgb(0.7, 0.1, 0.1),
        });
      }
      currentY -= 13;
    });

    // Totals Box
    const totalBoxY = 160;
    page.drawRectangle({
      x: startX,
      y: totalBoxY - 45,
      width: 380,
      height: 50,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.75,
      color: rgb(0.97, 0.98, 1),
    });

    page.drawText('Total Remunerações:', { x: startX + 8, y: totalBoxY - 12, size: 7.5, font: font });
    page.drawText(`${receipt.totalEarnings.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${receipt.currency}`, {
      x: startX + 95,
      y: totalBoxY - 12,
      size: 7.5,
      font: boldFont,
    });

    page.drawText('Total Descontos:', { x: startX + 8, y: totalBoxY - 26, size: 7.5, font: font });
    page.drawText(`${receipt.totalDeductions.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${receipt.currency}`, {
      x: startX + 95,
      y: totalBoxY - 26,
      size: 7.5,
      font: boldFont,
      color: rgb(0.7, 0.1, 0.1),
    });

    page.drawText('TOTAL LÍQUIDO A RECEBER:', { x: startX + 200, y: totalBoxY - 14, size: 8, font: boldFont, color: rgb(0.08, 0.35, 0.15) });
    page.drawText(`${receipt.netPay.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${receipt.currency}`, {
      x: startX + 200,
      y: totalBoxY - 32,
      size: 13,
      font: boldFont,
      color: rgb(0.05, 0.45, 0.18),
    });

    // Footer
    page.drawText('Declaro que recebi a quantia constante neste recibo.', {
      x: startX + 8,
      y: 75,
      size: 7,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawLine({
      start: { x: startX + 220, y: 70 },
      end: { x: startX + 370, y: 70 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText('Assinatura do Colaborador', {
      x: startX + 245,
      y: 58,
      size: 6.5,
      font: font,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(`Processado eletronicamente · ${receipt.companyName}`, {
      x: startX + 8,
      y: 35,
      size: 6.5,
      font: font,
      color: rgb(0.6, 0.6, 0.6),
    });
  };

  // Draw Original (left half) and Duplicado (right half)
  drawSlip(25, 'ORIGINAL');
  // Divider in the middle
  page.drawLine({
    start: { x: 421, y: 40 },
    end: { x: 421, y: 570 },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
    dashArray: [4, 4],
  });
  drawSlip(435, 'DUPLICADO');

  return await pdfDoc.save();
}

export async function splitUploadedPdf(
  fileBuffer: ArrayBuffer
): Promise<{ pageIndex: number; pdfBytes: Uint8Array }[]> {
  const srcDoc = await PDFDocument.load(fileBuffer);
  const totalPages = srcDoc.getPageCount();
  const results: { pageIndex: number; pdfBytes: Uint8Array }[] = [];

  for (let i = 0; i < totalPages; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copiedPage);
    const pdfBytes = await singleDoc.save();
    results.push({ pageIndex: i, pdfBytes });
  }

  return results;
}

// Safely retrieve original PDF bytes (or generate fallback only if no original exists)
export async function getReceiptPdfBlob(
  receipt: ReceiptData
): Promise<{ blob: Blob; url: string; bytes: Uint8Array }> {
  let bytes: Uint8Array | null = null;

  // 1. Try directly from in-memory originalPdfBytes
  if (receipt.originalPdfBytes) {
    if (receipt.originalPdfBytes instanceof Uint8Array && receipt.originalPdfBytes.length > 0) {
      bytes = receipt.originalPdfBytes;
    } else if (typeof receipt.originalPdfBytes === 'object') {
      const vals = Object.values(receipt.originalPdfBytes);
      if (vals.length > 0 && typeof vals[0] === 'number') {
        bytes = new Uint8Array(vals as number[]);
      }
    }
  }

  // 2. Try loading original PDF bytes from persistent IndexedDB
  if (!bytes && receipt.id) {
    try {
      const stored = await getOriginalPdfBytes(receipt.id);
      if (stored && stored.length > 0) {
        bytes = stored;
        receipt.originalPdfBytes = stored; // cache in memory
      }
    } catch (e) {
      console.warn('Erro ao ler PDF original do IndexedDB:', e);
    }
  }

  // 3. Only if no original PDF exists anywhere, generate fallback
  if (!bytes) {
    bytes = await generateReceiptPdf(receipt);
  }

  // Ensure clean Uint8Array slice and pure ArrayBuffer
  const safeBytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const arrayBuffer = safeBytes.buffer.slice(safeBytes.byteOffset, safeBytes.byteOffset + safeBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  return { blob, url, bytes: safeBytes };
}

// Open the PDF directly in a new browser tab for immediate viewing
export async function openReceiptPdfInNewTab(receipt: ReceiptData): Promise<string> {
  const { url } = await getReceiptPdfBlob(receipt);
  window.open(url, '_blank');
  return url;
}

