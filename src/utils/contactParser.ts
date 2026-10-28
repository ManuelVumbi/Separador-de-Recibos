import * as XLSX from 'xlsx';
import { CollaboratorContact, ContactPhoneItem } from '../types/contact';

// Parse raw CSV lines properly handling quoted values
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // Normalize line breaks
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // Closing quote
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',' || char === ';' || char === '\t') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field & row if exists
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Clean phone string to normalized WhatsApp/phone format
export function cleanPhoneNumber(rawPhone: any): string {
  if (rawPhone === null || rawPhone === undefined) return '';
  let str = String(rawPhone).trim();
  if (!str) return '';

  // Handle scientific notation from Excel (e.g. 9.23101e+08 or 2.44923e+11)
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = Math.round(num).toString();
    }
  }

  // Remove spaces, dots, dashes, parentheses, slashes
  let cleaned = str.replace(/[\s\-\(\)\.\/\\]/g, '');

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If starts with +
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Angola standard format: 9 digits starting with 9
  if (/^9\d{8}$/.test(cleaned)) {
    return '+244' + cleaned;
  }

  // Angola format without plus: 2449xxxxxxxx
  if (/^2449\d{8}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  // Portugal standard format: 9 digits starting with 9
  // If 9 digits starting with 9, in an Angola-based app, +244 is primary.

  // If 8 to 15 pure digits, prefix with '+' for international WhatsApp links if appropriate
  if (/^\d{8,15}$/.test(cleaned)) {
    return '+' + cleaned;
  }

  return cleaned;
}

// Extract multiple phone numbers from a single cell value or string
export function extractPhoneItemsFromValue(
  rawVal: any,
  isExplicitWhatsAppCol: boolean = false,
  baseOrder: number = 0
): ContactPhoneItem[] {
  if (rawVal === null || rawVal === undefined) return [];
  const str = String(rawVal).trim();
  if (!str) return [];

  // Split multiple numbers in a single cell by delimiters: / , ; \n | or "ou" or "and"
  const tokens = str.split(/[\n,;\/\|\\]|\bou\b|\band\b/i).map((t) => t.trim()).filter(Boolean);
  const items: ContactPhoneItem[] = [];

  tokens.forEach((token, subIdx) => {
    // Check if token text indicates WhatsApp (e.g. "(whatsapp)", "wa", "zap")
    const lower = token.toLowerCase();
    const tokenIsWhatsApp =
      isExplicitWhatsAppCol ||
      lower.includes('whats') ||
      lower.includes('wa') ||
      lower.includes('zap') ||
      lower.includes('wpp');

    const cleaned = cleanPhoneNumber(token);
    // Validate minimum digits to be a real phone number
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length >= 7 && digitsOnly.length <= 16) {
      items.push({
        number: cleaned,
        isWhatsApp: tokenIsWhatsApp,
        label: tokenIsWhatsApp ? 'WhatsApp' : `Contacto`,
      });
    }
  });

  return items;
}

/**
 * Prioritization Rule:
 * "Um colaborador pode ter mais de um contacto. Priorize os primeiros contactos e os que possuem whatsApp."
 *
 * Algorithm:
 * 1. Collect all detected candidate phones in the order they appear.
 * 2. Numbers explicitly flagged or column-labeled as WhatsApp receive highest priority.
 * 3. Among WhatsApp numbers, the FIRST contact listed is top priority.
 * 4. Among non-WhatsApp numbers, the FIRST contact listed is top priority.
 * 5. Return:
 *    - phone: The highest-priority primary number.
 *    - secondaryPhones: All remaining alternative numbers (unique).
 *    - allPhones: Structured list with WhatsApp flags and labels.
 */
export function prioritizeCollaboratorPhones(
  candidatePhones: { number: string; isWhatsApp?: boolean; label?: string }[]
): {
  primaryPhone: string;
  secondaryPhones: string[];
  allPhones: ContactPhoneItem[];
} {
  if (!candidatePhones || candidatePhones.length === 0) {
    return { primaryPhone: '', secondaryPhones: [], allPhones: [] };
  }

  // Deduplicate candidates by their normalized digits
  const seenDigits = new Set<string>();
  const uniqueCandidates: {
    number: string;
    isWhatsApp: boolean;
    orderIndex: number;
    label?: string;
  }[] = [];

  candidatePhones.forEach((c, idx) => {
    const digits = c.number.replace(/\D/g, '');
    if (!digits || seenDigits.has(digits)) return;
    seenDigits.add(digits);
    uniqueCandidates.push({
      number: c.number,
      isWhatsApp: Boolean(c.isWhatsApp),
      orderIndex: idx,
      label: c.label,
    });
  });

  if (uniqueCandidates.length === 0) {
    return { primaryPhone: '', secondaryPhones: [], allPhones: [] };
  }

  // Sort candidates according to rule:
  // 1. isWhatsApp (true first)
  // 2. orderIndex (lowest first: first listed contact)
  uniqueCandidates.sort((a, b) => {
    if (a.isWhatsApp !== b.isWhatsApp) {
      return a.isWhatsApp ? -1 : 1;
    }
    return a.orderIndex - b.orderIndex;
  });

  const primary = uniqueCandidates[0];
  const primaryPhone = primary.number;
  const secondaryCandidates = uniqueCandidates.slice(1);
  const secondaryPhones = secondaryCandidates.map((c) => c.number);

  const allPhones: ContactPhoneItem[] = uniqueCandidates.map((c, i) => ({
    number: c.number,
    isWhatsApp: c.isWhatsApp,
    label:
      i === 0
        ? c.isWhatsApp
          ? 'WhatsApp Principal'
          : 'Contacto Principal'
        : c.isWhatsApp
        ? `WhatsApp Alternativo ${i}`
        : `Telefone Alternativo ${i}`,
  }));

  return { primaryPhone, secondaryPhones, allPhones };
}

// Interface for intermediate detected column mapping
interface ColumnMapping {
  nameIndices: number[];
  givenNameIndex: number;
  familyNameIndex: number;
  phoneColumns: { index: number; isWhatsApp: boolean; label: string }[];
  emailIndices: number[];
  mecanIndices: number[];
  deptIndices: number[];
  categoryIndices: number[];
  notesIndices: number[];
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const normHeaders = headers.map((h) =>
    String(h || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

  const mapping: ColumnMapping = {
    nameIndices: [],
    givenNameIndex: -1,
    familyNameIndex: -1,
    phoneColumns: [],
    emailIndices: [],
    mecanIndices: [],
    deptIndices: [],
    categoryIndices: [],
    notesIndices: [],
  };

  normHeaders.forEach((col, idx) => {
    // 1. WhatsApp detection (explicit)
    if (
      col.includes('whatsapp') ||
      col.includes('whats') ||
      col === 'wa' ||
      col.includes('wpp') ||
      col.includes('telemovel whatsapp') ||
      col.includes('telefone whatsapp') ||
      col.includes('tel whatsapp')
    ) {
      mapping.phoneColumns.push({ index: idx, isWhatsApp: true, label: headers[idx] || 'WhatsApp' });
      return;
    }

    // 2. Regular phone columns
    if (
      col.includes('telefone') ||
      col.includes('telemovel') ||
      col.includes('celular') ||
      col.includes('contacto') ||
      col.includes('contato') ||
      col.includes('mobile') ||
      col.includes('phone') ||
      col === 'tel' ||
      col === 'fone' ||
      col.startsWith('tel ') ||
      col.startsWith('contacto ') ||
      col.startsWith('contato ')
    ) {
      mapping.phoneColumns.push({ index: idx, isWhatsApp: false, label: headers[idx] || 'Telefone' });
      return;
    }

    // 3. Name columns
    if (
      col === 'name' ||
      col === 'nome' ||
      col === 'nome completo' ||
      col === 'colaborador' ||
      col === 'funcionario' ||
      col === 'empregado' ||
      col === 'trabalhador' ||
      col === 'beneficiario' ||
      col === 'nome do colaborador' ||
      col === 'nome do funcionario'
    ) {
      mapping.nameIndices.push(idx);
      return;
    }
    if (col === 'given name' || col === 'primeiro nome' || col === 'first name') {
      mapping.givenNameIndex = idx;
      return;
    }
    if (col === 'family name' || col === 'sobrenome' || col === 'ultimo nome' || col === 'last name' || col === 'apelido') {
      mapping.familyNameIndex = idx;
      return;
    }

    // 4. Email columns
    if (
      col.includes('email') ||
      col.includes('e-mail') ||
      col.includes('correio') ||
      col === 'mail'
    ) {
      mapping.emailIndices.push(idx);
      return;
    }

    // 5. Mechanical number / Employee code
    if (
      col.includes('mecan') ||
      col.includes('codigo') ||
      col.includes('matricula') ||
      col === 'num' ||
      col === 'nº' ||
      col === 'no' ||
      col === 'id' ||
      col.includes('identificador')
    ) {
      mapping.mecanIndices.push(idx);
      return;
    }

    // 6. Department
    if (
      col.includes('departamento') ||
      col.includes('sector') ||
      col.includes('seccao') ||
      col.includes('department') ||
      col.includes('area')
    ) {
      mapping.deptIndices.push(idx);
      return;
    }

    // 7. Category / Role
    if (
      col.includes('categoria') ||
      col.includes('funcao') ||
      col.includes('cargo') ||
      col.includes('ocupacao') ||
      col.includes('profissao')
    ) {
      mapping.categoryIndices.push(idx);
      return;
    }

    // 8. Notes
    if (col.includes('nota') || col.includes('observa') || col.includes('obs') || col.includes('coment')) {
      mapping.notesIndices.push(idx);
      return;
    }
  });

  return mapping;
}

// Parse Excel Workbook (Buffer or ArrayBuffer) from .xlsx or .xls files
export function parseExcelBuffer(buffer: ArrayBuffer): {
  contacts: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[];
  sheetNames: string[];
  totalRows: number;
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return { contacts: [], sheetNames: [], totalRows: 0 };
  }

  // Use first sheet with data
  let targetSheet = workbook.Sheets[sheetNames[0]];
  for (const name of sheetNames) {
    const s = workbook.Sheets[name];
    if (s && s['!ref']) {
      targetSheet = s;
      break;
    }
  }

  if (!targetSheet) {
    return { contacts: [], sheetNames, totalRows: 0 };
  }

  // Convert to 2D array matrix with raw values preserved
  const rawRows: any[][] = XLSX.utils.sheet_to_json(targetSheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length === 0) {
    return { contacts: [], sheetNames, totalRows: 0 };
  }

  // Identify which row is the header row (usually first non-empty row)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const r = rawRows[i];
    const textCells = r.filter((cell) => typeof cell === 'string' && cell.trim().length > 0);
    if (textCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = (rawRows[headerRowIndex] || []).map((c) => String(c || '').trim());
  const mapping = detectColumnMapping(headerRow);

  // Group by collaborator (mechanical number or normalized name) to support multiple contacts per collaborator
  const collaboratorMap = new Map<
    string,
    {
      name: string;
      mechanicalNumber?: string;
      rawPhones: { number: string; isWhatsApp?: boolean; label?: string }[];
      emails: string[];
      department?: string;
      category?: string;
      notes?: string;
    }
  >();

  const dataRows = rawRows.slice(headerRowIndex + 1);

  dataRows.forEach((row) => {
    if (!row || row.length === 0) return;

    let name = '';
    let mechanicalNumber = '';
    let department = '';
    let category = '';
    let notes = '';
    const collectedPhones: { number: string; isWhatsApp?: boolean; label?: string }[] = [];
    const collectedEmails: string[] = [];

    // Extract Name
    if (mapping.nameIndices.length > 0) {
      for (const idx of mapping.nameIndices) {
        if (row[idx]) {
          name = String(row[idx]).trim();
          break;
        }
      }
    } else if (mapping.givenNameIndex !== -1 && row[mapping.givenNameIndex]) {
      const given = String(row[mapping.givenNameIndex]).trim();
      const family = mapping.familyNameIndex !== -1 && row[mapping.familyNameIndex]
        ? String(row[mapping.familyNameIndex]).trim()
        : '';
      name = `${given} ${family}`.trim();
    }

    // Extract Mechanical Number
    if (mapping.mecanIndices.length > 0) {
      for (const idx of mapping.mecanIndices) {
        if (row[idx]) {
          const val = String(row[idx]).replace(/\D/g, '');
          if (val) {
            mechanicalNumber = val;
            break;
          }
        }
      }
    }

    // Extract Phones from mapped phone columns (prioritizing WhatsApp columns and column order)
    mapping.phoneColumns.forEach((colInfo) => {
      const cellVal = row[colInfo.index];
      if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
        const extracted = extractPhoneItemsFromValue(cellVal, colInfo.isWhatsApp);
        collectedPhones.push(...extracted);
      }
    });

    // Extract Emails
    mapping.emailIndices.forEach((idx) => {
      const val = String(row[idx] || '').trim();
      if (val && val.includes('@')) {
        collectedEmails.push(val);
      }
    });

    // Extract Department
    if (mapping.deptIndices.length > 0) {
      for (const idx of mapping.deptIndices) {
        if (row[idx]) {
          department = String(row[idx]).trim();
          break;
        }
      }
    }

    // Extract Category
    if (mapping.categoryIndices.length > 0) {
      for (const idx of mapping.categoryIndices) {
        if (row[idx]) {
          category = String(row[idx]).trim();
          break;
        }
      }
    }

    // Extract Notes
    if (mapping.notesIndices.length > 0) {
      for (const idx of mapping.notesIndices) {
        if (row[idx]) {
          notes = String(row[idx]).trim();
          break;
        }
      }
    }

    // Fallback: If no phones were found via headers, check all cells heuristically
    if (collectedPhones.length === 0) {
      row.forEach((cell, idx) => {
        const str = String(cell || '').trim();
        if (!str) return;
        if (str.includes('@') && !collectedEmails.includes(str)) {
          collectedEmails.push(str);
        } else if (/^(\+?\d[\d\s\-\(\)\.]{6,16})$/.test(str)) {
          const items = extractPhoneItemsFromValue(str, false);
          collectedPhones.push(...items);
        } else if (!mechanicalNumber && /^\d{3,6}$/.test(str)) {
          mechanicalNumber = str;
        } else if (!name && str.length > 2 && !/^\d+$/.test(str) && !str.includes('@')) {
          name = str;
        }
      });
    }

    // Must have at least a Name or a Phone or an Email
    if (!name && collectedPhones.length === 0 && collectedEmails.length === 0) {
      return;
    }

    if (!name) {
      name = collectedEmails.length > 0
        ? collectedEmails[0].split('@')[0]
        : collectedPhones.length > 0
        ? `Contacto ${collectedPhones[0].number}`
        : 'Colaborador';
    }

    // Determine collaborator grouping key (prefer mechanical number, then normalized name)
    const normKey = mechanicalNumber
      ? `mecan_${mechanicalNumber}`
      : `name_${name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;

    if (collaboratorMap.has(normKey)) {
      // Merge into existing collaborator (allows collaborator across multiple rows with multiple numbers)
      const existing = collaboratorMap.get(normKey)!;
      existing.rawPhones.push(...collectedPhones);
      collectedEmails.forEach((e) => {
        if (!existing.emails.includes(e)) existing.emails.push(e);
      });
      if (!existing.department && department) existing.department = department;
      if (!existing.category && category) existing.category = category;
      if (!existing.notes && notes) existing.notes = notes;
      if (!existing.mechanicalNumber && mechanicalNumber) existing.mechanicalNumber = mechanicalNumber;
    } else {
      collaboratorMap.set(normKey, {
        name,
        mechanicalNumber: mechanicalNumber || undefined,
        rawPhones: collectedPhones,
        emails: collectedEmails,
        department: department || undefined,
        category: category || undefined,
        notes: notes || undefined,
      });
    }
  });

  // Convert merged map to final prioritized contacts
  const contacts: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  collaboratorMap.forEach((entry) => {
    // Apply prioritization rule:
    // Prioritize WhatsApp numbers first, then first contact listed
    const { primaryPhone, secondaryPhones, allPhones } = prioritizeCollaboratorPhones(entry.rawPhones);

    contacts.push({
      name: entry.name,
      mechanicalNumber: entry.mechanicalNumber,
      phone: primaryPhone,
      secondaryPhones,
      allPhones,
      email: entry.emails[0] || '',
      secondaryEmails: entry.emails.slice(1),
      department: entry.department,
      category: entry.category,
      notes: entry.notes,
    });
  });

  return {
    contacts,
    sheetNames,
    totalRows: dataRows.length,
  };
}

// Parse Google Contacts CSV, standard CSV, or arbitrary tabular file
export function parseContactsFile(fileContent: string): {
  contacts: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[];
  detectedType: 'google_csv' | 'standard_csv' | 'heuristic';
} {
  const rows = parseCsvRows(fileContent);
  if (rows.length === 0) {
    return { contacts: [], detectedType: 'heuristic' };
  }

  const headerRow = rows[0].map((h) => h.toLowerCase().trim());

  // Check if it's a Google Contacts CSV
  const isGoogleContacts =
    headerRow.includes('e-mail 1 - value') ||
    headerRow.includes('phone 1 - value') ||
    (headerRow.includes('name') && headerRow.includes('given name'));

  let detectedType: 'google_csv' | 'standard_csv' | 'heuristic' = isGoogleContacts
    ? 'google_csv'
    : 'standard_csv';

  const mapping = detectColumnMapping(rows[0]);
  const hasRecognizedHeaders =
    mapping.nameIndices.length > 0 ||
    mapping.phoneColumns.length > 0 ||
    mapping.emailIndices.length > 0 ||
    mapping.givenNameIndex !== -1;

  if (!hasRecognizedHeaders) {
    detectedType = 'heuristic';
  }

  const collaboratorMap = new Map<
    string,
    {
      name: string;
      mechanicalNumber?: string;
      rawPhones: { number: string; isWhatsApp?: boolean; label?: string }[];
      emails: string[];
      department?: string;
      category?: string;
      notes?: string;
    }
  >();

  const startRow = hasRecognizedHeaders ? 1 : 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0) continue;

    let name = '';
    let mechanicalNumber = '';
    let department = '';
    let category = '';
    let notes = '';
    const collectedPhones: { number: string; isWhatsApp?: boolean; label?: string }[] = [];
    const collectedEmails: string[] = [];

    if (hasRecognizedHeaders) {
      // Name
      if (mapping.nameIndices.length > 0) {
        for (const idx of mapping.nameIndices) {
          if (row[idx]) {
            name = row[idx];
            break;
          }
        }
      } else if (mapping.givenNameIndex !== -1 && row[mapping.givenNameIndex]) {
        const given = row[mapping.givenNameIndex];
        const family = mapping.familyNameIndex !== -1 && row[mapping.familyNameIndex] ? row[mapping.familyNameIndex] : '';
        name = `${given} ${family}`.trim();
      }

      // Mechanical number
      if (mapping.mecanIndices.length > 0) {
        for (const idx of mapping.mecanIndices) {
          if (row[idx]) {
            mechanicalNumber = row[idx].replace(/\D/g, '');
            break;
          }
        }
      }

      // Phones across all phone columns
      mapping.phoneColumns.forEach((colInfo) => {
        const cell = row[colInfo.index];
        if (cell) {
          const items = extractPhoneItemsFromValue(cell, colInfo.isWhatsApp);
          collectedPhones.push(...items);
        }
      });

      // Emails
      mapping.emailIndices.forEach((idx) => {
        if (row[idx] && row[idx].includes('@')) {
          collectedEmails.push(row[idx].trim());
        }
      });

      // Department
      if (mapping.deptIndices.length > 0) {
        for (const idx of mapping.deptIndices) {
          if (row[idx]) {
            department = row[idx].trim();
            break;
          }
        }
      }

      // Category
      if (mapping.categoryIndices.length > 0) {
        for (const idx of mapping.categoryIndices) {
          if (row[idx]) {
            category = row[idx].trim();
            break;
          }
        }
      }

      // Notes
      if (mapping.notesIndices.length > 0) {
        for (const idx of mapping.notesIndices) {
          if (row[idx]) {
            notes = row[idx].trim();
            break;
          }
        }
      }
    } else {
      // Heuristic parsing
      for (const cell of row) {
        const val = cell.trim();
        if (!val) continue;

        if (val.includes('@')) {
          collectedEmails.push(val);
        } else if (/^(\+?\d[\d\s\-\(\)\.]{6,16})$/.test(val)) {
          const items = extractPhoneItemsFromValue(val, false);
          collectedPhones.push(...items);
        } else if (/^\d{3,6}$/.test(val) && !mechanicalNumber) {
          mechanicalNumber = val;
        } else if (!name && val.length > 2 && !/^\d+$/.test(val)) {
          name = val;
        }
      }
    }

    if (!name && collectedPhones.length === 0 && collectedEmails.length === 0) {
      continue;
    }

    if (!name) {
      name = collectedEmails.length > 0
        ? collectedEmails[0].split('@')[0]
        : collectedPhones.length > 0
        ? `Contacto ${collectedPhones[0].number}`
        : 'Colaborador';
    }

    const normKey = mechanicalNumber
      ? `mecan_${mechanicalNumber}`
      : `name_${name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;

    if (collaboratorMap.has(normKey)) {
      const existing = collaboratorMap.get(normKey)!;
      existing.rawPhones.push(...collectedPhones);
      collectedEmails.forEach((e) => {
        if (!existing.emails.includes(e)) existing.emails.push(e);
      });
      if (!existing.department && department) existing.department = department;
      if (!existing.category && category) existing.category = category;
      if (!existing.notes && notes) existing.notes = notes;
    } else {
      collaboratorMap.set(normKey, {
        name,
        mechanicalNumber: mechanicalNumber || undefined,
        rawPhones: collectedPhones,
        emails: collectedEmails,
        department: department || undefined,
        category: category || undefined,
        notes: notes || undefined,
      });
    }
  }

  const contacts: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  collaboratorMap.forEach((entry) => {
    const { primaryPhone, secondaryPhones, allPhones } = prioritizeCollaboratorPhones(entry.rawPhones);
    contacts.push({
      name: entry.name,
      mechanicalNumber: entry.mechanicalNumber,
      phone: primaryPhone,
      secondaryPhones,
      allPhones,
      email: entry.emails[0] || '',
      secondaryEmails: entry.emails.slice(1),
      department: entry.department,
      category: entry.category,
      notes: entry.notes,
    });
  });

  return { contacts, detectedType };
}

// Export contacts to clean Excel (.xlsx) file with multi-phone support
export function exportContactsToExcel(contacts: CollaboratorContact[]): Uint8Array {
  const data = contacts.map((c) => ({
    'Nome Completo': c.name,
    'Nº Mecanográfico': c.mechanicalNumber || '',
    'Telefone Principal (WhatsApp)': c.phone || '',
    'Contactos Secundários / Alternativos': (c.secondaryPhones || []).join('; '),
    'E-mail': c.email || '',
    'Departamento': c.department || '',
    'Categoria / Função': c.category || '',
    'Observações': c.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Nome
    { wch: 16 }, // Mecan
    { wch: 26 }, // WhatsApp Principal
    { wch: 32 }, // Contactos Secundários
    { wch: 30 }, // E-mail
    { wch: 22 }, // Departamento
    { wch: 22 }, // Categoria
    { wch: 25 }, // Observações
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contactos Colaboradores');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}

// Generate sample Excel template showing multiple phone numbers per collaborator
export function generateSampleExcelWorkbook(): Uint8Array {
  const sampleData = [
    {
      'Nome Completo': 'Alfredo Bumba João Macedo',
      'Nº Mecanográfico': '10100',
      'WhatsApp': '+244923101001',
      'Telefone 2': '+244912345678',
      'Contacto Alternativo': '+244945112233',
      'E-mail': 'alfredo.macedo@espacieservices.com',
      'Departamento': 'Operações & Serviços',
      'Categoria': 'Mecânico de 1ª',
      'Observações': 'Priorizar WhatsApp para recibos',
    },
    {
      'Nome Completo': 'Benisio Manuel Lombo',
      'Nº Mecanográfico': '10101',
      'WhatsApp': '+244923101002',
      'Telefone 2': '+244924555123',
      'Contacto Alternativo': '',
      'E-mail': 'benisio.lombo@espacieservices.com',
      'Departamento': 'Manutenção & Oficinas',
      'Categoria': 'Serralheiro Mecânico',
      'Observações': 'Número secundário da residência',
    },
    {
      'Nome Completo': 'Carlos Domingos Silva',
      'Nº Mecanográfico': '10102',
      'WhatsApp': '+244923101003',
      'Telefone 2': '',
      'Contacto Alternativo': '+244933778899',
      'E-mail': 'carlos.silva@espacieservices.com',
      'Departamento': 'Logística & Armazém',
      'Categoria': 'Motorista Pesados',
      'Observações': 'Disponível em ambos os números',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 32 },
    { wch: 24 },
    { wch: 24 },
    { wch: 30 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo Colaboradores');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}

// Export contacts to Google Contacts format CSV
export function exportContactsToGoogleCsv(contacts: CollaboratorContact[]): string {
  const headers = [
    'Name',
    'Given Name',
    'Family Name',
    'E-mail 1 - Type',
    'E-mail 1 - Value',
    'Phone 1 - Type',
    'Phone 1 - Value',
    'Phone 2 - Type',
    'Phone 2 - Value',
    'Organization 1 - Name',
    'Organization 1 - Department',
    'Notes',
  ];

  const escapeCsv = (str?: string) => {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [headers.join(',')];

  contacts.forEach((c) => {
    const parts = c.name.trim().split(/\s+/);
    const givenName = parts[0] || '';
    const familyName = parts.slice(1).join(' ') || '';
    const altPhone = c.secondaryPhones && c.secondaryPhones.length > 0 ? c.secondaryPhones[0] : '';

    const row = [
      escapeCsv(c.name),
      escapeCsv(givenName),
      escapeCsv(familyName),
      escapeCsv('Trabalho'),
      escapeCsv(c.email),
      escapeCsv('Celular'),
      escapeCsv(c.phone),
      escapeCsv('Outro'),
      escapeCsv(altPhone),
      escapeCsv('Espacie Services, Lda'),
      escapeCsv(c.department || (c.mechanicalNumber ? `N.º ${c.mechanicalNumber}` : '')),
      escapeCsv(c.notes || (c.mechanicalNumber ? `Nº Mecanográfico: ${c.mechanicalNumber}` : '')),
    ];
    lines.push(row.join(','));
  });

  return lines.join('\r\n');
}

// Export contacts to clean standard CSV
export function exportContactsToStandardCsv(contacts: CollaboratorContact[]): string {
  const headers = [
    'Nome Completo',
    'Nº Mecanográfico',
    'Telefone / WhatsApp Principal',
    'Contactos Secundários',
    'E-mail',
    'Departamento',
    'Observações',
  ];

  const escapeCsv = (str?: string) => {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [headers.join(';')];

  contacts.forEach((c) => {
    const row = [
      escapeCsv(c.name),
      escapeCsv(c.mechanicalNumber || ''),
      escapeCsv(c.phone || ''),
      escapeCsv((c.secondaryPhones || []).join(', ')),
      escapeCsv(c.email || ''),
      escapeCsv(c.department || ''),
      escapeCsv(c.notes || ''),
    ];
    lines.push(row.join(';'));
  });

  return lines.join('\r\n');
}

// Parse text copied directly from WhatsApp Web (group participants list, chat header, or contact card)
export function parseWhatsAppRawText(rawText: string): Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] {
  if (!rawText || !rawText.trim()) return [];

  // Check if it's vCard format (.vcf)
  if (rawText.includes('BEGIN:VCARD')) {
    return parseVCardText(rawText);
  }

  const results: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const seenPhones = new Set<string>();

  // Normalize line endings
  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // WhatsApp Web Group participants usually look like:
  // "+244 923 101 001, +244 924 555 123, Alfredo Macedo, Domingos Eduardo (+244 925 111 222), Você"
  if (clean.includes(',') && !clean.includes('\n')) {
    const parts = clean.split(',').map((p) => p.trim()).filter(Boolean);
    parts.forEach((part) => {
      if (part.toLowerCase() === 'você' || part.toLowerCase() === 'you') return;

      // Pattern: "Name (+244 923 101 001)" or "Name +244 923 101 001"
      const withParen = part.match(/^(.*?)\s*[\(\[]?(\+?\d[\d\s\-]{7,16})[\)\]]?$/);
      if (withParen) {
        const potentialName = withParen[1].trim();
        const phone = cleanPhoneNumber(withParen[2]);
        if (phone && !seenPhones.has(phone)) {
          seenPhones.add(phone);
          results.push({
            name: potentialName || `WhatsApp ${phone}`,
            phone,
            secondaryPhones: [],
            allPhones: [{ number: phone, isWhatsApp: true, label: 'WhatsApp' }],
            email: '',
            notes: 'Importado de participantes do WhatsApp Web',
          });
          return;
        }
      }

      // Direct phone number
      const cleaned = cleanPhoneNumber(part);
      if (/^\+?\d{8,16}$/.test(cleaned) && !seenPhones.has(cleaned)) {
        seenPhones.add(cleaned);
        results.push({
          name: `WhatsApp ${cleaned}`,
          phone: cleaned,
          secondaryPhones: [],
          allPhones: [{ number: cleaned, isWhatsApp: true, label: 'WhatsApp' }],
          email: '',
          notes: 'Importado do WhatsApp Web',
        });
      }
    });

    if (results.length > 0) return results;
  }

  // Multi-line format (e.g. Chat list copy, Contact Info copy, or message list)
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  let pendingName = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains a phone number
    const phoneMatch = line.match(/(\+?\d[\d\s\-]{7,16})/);
    if (phoneMatch) {
      const phone = cleanPhoneNumber(phoneMatch[1]);
      if (/^\+?\d{8,16}$/.test(phone) && !seenPhones.has(phone)) {
        seenPhones.add(phone);

        // Name might be in the same line: "Alfredo Macedo: +244 923 101 001"
        let name = line.replace(phoneMatch[0], '').replace(/[:\-\(\)]/g, '').trim();
        if (!name && pendingName) {
          name = pendingName;
        }

        results.push({
          name: name || `WhatsApp ${phone}`,
          phone,
          secondaryPhones: [],
          allPhones: [{ number: phone, isWhatsApp: true, label: 'WhatsApp' }],
          email: '',
          notes: 'Importado do WhatsApp Web',
        });
        pendingName = '';
        continue;
      }
    }

    // If line has no phone, it might be a collaborator name
    if (!line.includes(':') && line.length > 2 && !/^\d+$/.test(line) && !line.includes('http')) {
      pendingName = line;
    }
  }

  return results;
}

// Parse vCard (.vcf) format used by WhatsApp when sharing contacts
export function parseVCardText(vcfText: string): Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] {
  const contacts: Omit<CollaboratorContact, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const cards = vcfText.split(/BEGIN:VCARD/i).filter((c) => c.trim().length > 0);

  cards.forEach((card) => {
    let name = '';
    const phoneCandidates: { number: string; isWhatsApp: boolean; label?: string }[] = [];
    let email = '';
    let org = '';
    let notes = '';

    const lines = card.split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (/^FN:/i.test(trimmed)) {
        name = trimmed.replace(/^FN:/i, '').trim();
      } else if (/^TEL[^:]*:/i.test(trimmed)) {
        const p = trimmed.replace(/^TEL[^:]*:/i, '').trim();
        const isCell = /CELL|MOBILE/i.test(trimmed);
        const cleaned = cleanPhoneNumber(p);
        if (cleaned) {
          phoneCandidates.push({
            number: cleaned,
            isWhatsApp: isCell || true,
            label: isCell ? 'Celular / WhatsApp' : 'Telefone',
          });
        }
      } else if (/^EMAIL[^:]*:/i.test(trimmed)) {
        const e = trimmed.replace(/^EMAIL[^:]*:/i, '').trim();
        if (!email) email = e;
      } else if (/^ORG:/i.test(trimmed)) {
        org = trimmed.replace(/^ORG:/i, '').replace(/;/g, ' ').trim();
      } else if (/^NOTE:/i.test(trimmed)) {
        notes = trimmed.replace(/^NOTE:/i, '').trim();
      }
    });

    const { primaryPhone, secondaryPhones, allPhones } = prioritizeCollaboratorPhones(phoneCandidates);

    if (name || primaryPhone || email) {
      contacts.push({
        name: name || (primaryPhone ? `WhatsApp ${primaryPhone}` : 'Contacto'),
        phone: primaryPhone,
        secondaryPhones,
        allPhones,
        email,
        department: org || undefined,
        notes: notes || 'Importado de vCard do WhatsApp Web',
      });
    }
  });

  return contacts;
}

// Export contacts to vCard (.vcf) format for WhatsApp Web and mobile phones
export function exportContactsToVCard(contacts: CollaboratorContact[]): string {
  const cards: string[] = [];

  contacts.forEach((c) => {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.name}`,
    ];
    if (c.phone) {
      lines.push(`TEL;TYPE=CELL,VOICE,PREF:${c.phone}`);
    }
    if (c.secondaryPhones && c.secondaryPhones.length > 0) {
      c.secondaryPhones.forEach((sec, idx) => {
        lines.push(`TEL;TYPE=WORK,VOICE:${sec}`);
      });
    }
    if (c.email) {
      lines.push(`EMAIL;TYPE=WORK:${c.email}`);
    }
    lines.push('ORG:Espacie Services, Lda');
    if (c.department) {
      lines.push(`TITLE:${c.department}`);
    }
    if (c.mechanicalNumber || c.notes) {
      lines.push(
        `NOTE:${[c.mechanicalNumber ? `Nº Mecanográfico: ${c.mechanicalNumber}` : '', c.notes || ''].filter(Boolean).join(' - ')}`
      );
    }
    lines.push('END:VCARD');
    cards.push(lines.join('\r\n'));
  });

  return cards.join('\r\n\r\n');
}
