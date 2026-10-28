import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { inflate } from 'pako';

// Configure pdfjs worker to use the local Vite-bundled worker URL
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (err) {
    console.warn('Failed to set pdfjs workerSrc:', err);
  }
}

export interface ExtractedPageInfo {
  pageNumber: number;
  employeeName?: string;
  mechanicalNumber?: string;
  category?: string;
  period?: string;
  netPay?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  rawText: string;
}

// Robust parser for Portuguese / Angolan currency formatted amounts
export function parsePortugueseAmount(raw?: string | null): number | undefined {
  if (!raw) return undefined;

  // Extract the numeric portion (digits with dots, commas, or spaces)
  const match = raw.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/);
  if (!match) return undefined;

  let cleaned = match[1].trim();

  // If contains dot and comma: "706.765,50" -> 706765.50
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/,\d{2}$/.test(cleaned)) {
    // "706765,50" or "706 765,50" -> 706765.50
    cleaned = cleaned.replace(/\s+/g, '').replace(',', '.');
  } else if (/\.\d{2}$/.test(cleaned)) {
    // "706,765.50" or "706 765.50" -> 706765.50
    cleaned = cleaned.replace(/[,\s]/g, '');
  } else if (/\s\d{3}$/.test(cleaned)) {
    // "706 765" -> 706765
    cleaned = cleaned.replace(/\s+/g, '');
  } else {
    cleaned = cleaned.replace(/\s+/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? undefined : num;
}

// Helper to extract all candidate currency numbers from a line or block
function extractNumbersFromText(str: string): number[] {
  if (!str) return [];
  const matches = str.match(/\b\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})?\b|\b\d+(?:[.,]\d{2})?\b/g) || [];
  return matches
    .map((m) => parsePortugueseAmount(m))
    .filter((n): n is number => Boolean(n && n >= 100)); // Filter out tiny day numbers like 20, 13, 25
}

// Parse fields from spatially sorted lines of text
export function parseFieldsFromLines(lines: string[], pageNumber: number): ExtractedPageInfo {
  let employeeName: string | undefined;
  let mechanicalNumber: string | undefined;
  let category: string | undefined;
  let period: string | undefined;
  let netPay: number | undefined;
  let totalEarnings: number | undefined;
  let totalDeductions: number | undefined;

  const fullText = lines.join('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const nextLine = lines[idx + 1] || '';
    const nextLine2 = lines[idx + 2] || '';

    // 1. Employee Name
    // Pattern A: "Nome: ALFREDO BUMBA JOÃO MACEDO" or "Nome ALFREDO BUMBA..."
    const nameMatch = line.match(
      /(?:Nome|Colaborador|Funcion[áa]rio|Trabalhador)\s*[:.]?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s'’.-]{3,65})/i
    );
    if (nameMatch && nameMatch[1] && !employeeName) {
      let candidate = nameMatch[1]
        .replace(/\s*(?:N\.?[ºo°]?\s*Mecan|Benef|Cat|Depart|NIF|N\.?[ºo°]?\s*Contrib|Per[íi]odo|Data).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      // Remove any trailing numbers
      candidate = candidate.replace(/\s+\d+$/, '').trim();
      if (candidate.length >= 3 && !/^(?:do|da|de|em|para|recibo|vencimento)$/i.test(candidate)) {
        employeeName = candidate;
      }
    }

    // Pattern B: "Nome:" on one line, actual name on the next line
    if (!employeeName && /^(?:Nome|Colaborador)\s*[:.]?$/i.test(line.trim()) && idx + 1 < lines.length) {
      const nextCandidate = lines[idx + 1].trim();
      if (nextCandidate.length >= 3 && /^[A-Za-zÀ-ÖØ-öø-ÿ\s'’.-]+$/.test(nextCandidate)) {
        employeeName = nextCandidate;
      }
    }

    // 2. Mechanical Number
    const mecanMatch = line.match(
      /(?:N\.?[ºo°]?\s*Mecan\.?|Mecan\.?|Mecanogr[áa]fico|N\.?[ºo°]?\s*Emp(?:regado)?|C[óo]digo)\s*[:.]?\s*(\d{2,12})/i
    );
    if (mecanMatch && mecanMatch[1] && !mechanicalNumber) {
      mechanicalNumber = mecanMatch[1].trim();
    }

    // 3. Category / Function
    const catMatch = line.match(
      /(?:Categoria|Fun[çc][ãa]o|Cargo|Profiss[ãa]o)\s*[:.]?\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s/&'’.-]{2,45})/i
    );
    if (catMatch && catMatch[1] && !category) {
      let candidate = catMatch[1]
        .replace(/\s*(?:N\.?[ºo°]?\s*Contrib|Depart|Sec[çc][ãa]o|Venc|Base|Benef|Per[íi]odo).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (candidate.length >= 2) {
        category = candidate;
      }
    }

    // 4. Period
    const periodMatch = line.match(
      /(?:Per[íi]odo|Periodo|M[êe]s|Referente)\s*[:.]?\s*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s/]+)/i
    );
    if (periodMatch && periodMatch[1] && !period) {
      let candidate = periodMatch[1]
        .replace(/\s*(?:Data|Fecho|Dias|N\.?[ºo°]|Venc|Processamento).*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (candidate.length >= 3) {
        period = candidate;
      }
    }

    // 5. Financial Totals in Primavera BSS (Handles single-line and multi-line headers/values)
    if (/(?:Total\s+L[íi]quido|L[íi]quido\s+a\s+Receber|Valor\s+L[íi]quido|L[ÍI]QUIDO)/i.test(line)) {
      const lineNums = extractNumbersFromText(line);
      if (lineNums.length > 0) {
        if (lineNums.length >= 3) {
          totalEarnings = lineNums[0];
          totalDeductions = lineNums[1];
          netPay = lineNums[2];
        } else {
          netPay = lineNums[lineNums.length - 1];
        }
      } else {
        // Values are in the following line(s) below the header
        const nextNums = extractNumbersFromText(nextLine);
        if (nextNums.length >= 3) {
          totalEarnings = nextNums[0];
          totalDeductions = nextNums[1];
          netPay = nextNums[2];
        } else if (nextNums.length > 0) {
          netPay = nextNums[nextNums.length - 1];
        } else {
          const next2Nums = extractNumbersFromText(nextLine2);
          if (next2Nums.length > 0) {
            netPay = next2Nums[next2Nums.length - 1];
          }
        }
      }
    }

    if (!totalEarnings && /(?:Total\s+Il[íi]quido|Total\s+Rendimentos|Total\s+Vencimentos)/i.test(line)) {
      const nums = extractNumbersFromText(line);
      if (nums.length > 0) totalEarnings = nums[0];
      else {
        const nextNums = extractNumbersFromText(nextLine);
        if (nextNums.length > 0) totalEarnings = nextNums[0];
      }
    }

    if (!totalDeductions && /(?:Total\s+Descontos|Total\s+Reten[çc][õo]es)/i.test(line)) {
      const nums = extractNumbersFromText(line);
      if (nums.length > 0) totalDeductions = nums[0];
      else {
        const nextNums = extractNumbersFromText(nextLine);
        if (nextNums.length > 0) totalDeductions = nextNums[0];
      }
    }
  }

  // Fallback scan across full joined text if not found line-by-line
  if (!employeeName) {
    const broadNameMatch = fullText.match(
      /(?:Nome|Colaborador)\s*[:.]?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s'’.-]{3,60}?)(?=\s*(?:N\.?[ºo°]?\s*Mecan|Benef|Cat|Depart|NIF|N\.?[ºo°]?\s*Contrib|Per[íi]odo|\n|\r|$))/i
    );
    if (broadNameMatch && broadNameMatch[1]?.trim().length >= 3) {
      employeeName = broadNameMatch[1].trim();
    }
  }

  if (!mechanicalNumber) {
    const broadMecan = fullText.match(/(?:N\.?[ºo°]?\s*Mecan\.?|Mecan\.?)\s*[:.]?\s*(\d{2,12})/i);
    if (broadMecan && broadMecan[1]) {
      mechanicalNumber = broadMecan[1].trim();
    }
  }

  // Fallback 1: Broad regex on entire page text
  if (!netPay) {
    const broadNet = fullText.match(
      /(?:Total\s+L[íi]quido|L[íi]quido\s+a\s+Receber|Valor\s+L[íi]quido|L[íi]quido)\s*[:.]?\s*(?:AKZ|Kz|AOA)?\s*([0-9.,\s]{4,25})/i
    );
    if (broadNet && broadNet[1]) {
      netPay = parsePortugueseAmount(broadNet[1]);
    }
  }

  // Fallback 2: Mathematical relationship check on bottom 30% lines of the page (Total Ilíquido - Total Descontos = Total Líquido)
  if (!netPay && lines.length >= 4) {
    const bottomLines = lines.slice(Math.floor(lines.length * 0.65));
    const allBottomNums = bottomLines.flatMap((l) => extractNumbersFromText(l)).filter((n) => n > 5000);

    for (let a = 0; a < allBottomNums.length; a++) {
      for (let b = 0; b < allBottomNums.length; b++) {
        if (a === b) continue;
        for (let c = 0; c < allBottomNums.length; c++) {
          if (c === a || c === b) continue;
          // Check if numA - numB ≈ numC
          if (Math.abs(allBottomNums[a] - allBottomNums[b] - allBottomNums[c]) < 2) {
            totalEarnings = allBottomNums[a];
            totalDeductions = allBottomNums[b];
            netPay = allBottomNums[c];
            break;
          }
        }
        if (netPay) break;
      }
      if (netPay) break;
    }

    if (!netPay && allBottomNums.length > 0) {
      netPay = allBottomNums[allBottomNums.length - 1];
    }
  }

  return {
    pageNumber,
    employeeName,
    mechanicalNumber,
    category,
    period,
    netPay,
    totalEarnings,
    totalDeductions,
    rawText: fullText,
  };
}

// Fallback: extract and decompress FlateDecode streams using pako
function extractWithPakoFallback(fileBuffer: ArrayBuffer): ExtractedPageInfo[] {
  try {
    const uint8 = new Uint8Array(fileBuffer);
    const pages: ExtractedPageInfo[] = [];

    // Find all stream ... endstream positions
    const streamHeader = new TextEncoder().encode('stream');
    const endstreamHeader = new TextEncoder().encode('endstream');

    const decompressedChunks: string[] = [];

    let i = 0;
    while (i < uint8.length - 10) {
      // Find 'stream'
      if (
        uint8[i] === 115 && // 's'
        uint8[i + 1] === 116 && // 't'
        uint8[i + 2] === 114 && // 'r'
        uint8[i + 3] === 101 && // 'e'
        uint8[i + 4] === 97 && // 'a'
        uint8[i + 5] === 109 // 'm'
      ) {
        let streamStart = i + 6;
        if (uint8[streamStart] === 13) streamStart++; // skip \r
        if (uint8[streamStart] === 10) streamStart++; // skip \n

        // Look for 'endstream'
        let streamEnd = streamStart;
        while (streamEnd < uint8.length - 9) {
          if (
            uint8[streamEnd] === 101 && // 'e'
            uint8[streamEnd + 1] === 110 && // 'n'
            uint8[streamEnd + 2] === 100 && // 'd'
            uint8[streamEnd + 3] === 115 && // 's'
            uint8[streamEnd + 4] === 116 && // 't'
            uint8[streamEnd + 5] === 114 && // 'r'
            uint8[streamEnd + 6] === 101 && // 'e'
            uint8[streamEnd + 7] === 97 && // 'a'
            uint8[streamEnd + 8] === 109 // 'm'
          ) {
            break;
          }
          streamEnd++;
        }

        if (streamEnd > streamStart) {
          const rawStreamBytes = uint8.subarray(streamStart, streamEnd);
          try {
            // Attempt decompression
            const decompressed = inflate(rawStreamBytes);
            const text = new TextDecoder('latin1').decode(decompressed);
            // Check if contains PDF text operators BT ... ET
            if (text.includes('BT') || text.includes('Tj') || text.includes('TJ')) {
              // Extract string tokens
              const stringMatches = text.match(/\(([^()]{2,100})\)/g) || [];
              const cleanStrings = stringMatches.map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'));
              if (cleanStrings.length > 0) {
                decompressedChunks.push(cleanStrings.join(' '));
              }
            }
          } catch {
            // Stream was not flate compressed or failed to inflate; ignore
          }
        }
        i = streamEnd + 9;
      } else {
        i++;
      }
    }

    if (decompressedChunks.length > 0) {
      decompressedChunks.forEach((chunk, idx) => {
        const lines = chunk.split(/[\r\n]+/);
        pages.push(parseFieldsFromLines(lines, idx + 1));
      });
    }

    return pages;
  } catch (err) {
    console.warn('Pako fallback failed:', err);
    return [];
  }
}

export async function extractTextFromPdfPages(fileBuffer: ArrayBuffer): Promise<ExtractedPageInfo[]> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileBuffer),
      verbosity: 0,
      isEvalSupported: false,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const pagesInfo: ExtractedPageInfo[] = [];

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as Array<{
          str: string;
          transform: number[];
          width: number;
          height: number;
        }>;

        // Group items spatially by vertical coordinate y (nearest 3 points)
        const linesMap = new Map<number, typeof items>();
        for (const item of items) {
          if (!item.str || item.str.trim() === '') continue;
          const y = Math.round(item.transform[5] / 3) * 3;
          if (!linesMap.has(y)) linesMap.set(y, []);
          linesMap.get(y)!.push(item);
        }

        // Sort lines top-to-bottom (descending y)
        const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
        const spatiallySortedLines: string[] = [];

        for (const y of sortedY) {
          // Sort items on this line left-to-right (ascending x)
          const lineItems = linesMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
          spatiallySortedLines.push(lineItems.map((it) => it.str).join(' '));
        }

        const pageInfo = parseFieldsFromLines(spatiallySortedLines, i);
        pagesInfo.push(pageInfo);
      } catch (pageErr) {
        console.warn(`Error reading page ${i}:`, pageErr);
        pagesInfo.push({ pageNumber: i, rawText: '' });
      }
    }

    // Verify if we found names
    const hasNames = pagesInfo.some((p) => Boolean(p.employeeName));
    if (hasNames) {
      return pagesInfo;
    }
  } catch (err) {
    console.warn('pdfjsLib extraction encountered error, attempting pako fallback:', err);
  }

  // Fallback to binary pako decompressor
  const fallbackPages = extractWithPakoFallback(fileBuffer);
  if (fallbackPages.length > 0) {
    return fallbackPages;
  }

  return [];
}
