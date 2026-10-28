import { CollaboratorContact } from '../types/contact';
import { ReceiptData } from '../types/receipt';
import { allInitialReceipts } from '../data';

const CONTACTS_STORAGE_KEY = 'recibos_vencimento_contacts_v1';

// Generate corporate contact for initial receipts list
export function generateDefaultContactForReceipt(r: ReceiptData, index: number): CollaboratorContact {
  const words = r.employeeName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const firstName = words[0] || 'colaborador';
  const lastName = words.length > 1 ? words[words.length - 1] : 'geral';
  const email = `${firstName}.${lastName}@espacieservices.com`;

  const numPart = r.mechanicalNumber ? r.mechanicalNumber.replace(/\D/g, '') : String(10100 + index);
  // Angola mobile format: +244 923 xxx xxx
  const phoneSuffix = numPart.padStart(6, '0').slice(-6);
  const phone = `+244923${phoneSuffix}`;

  return {
    id: `contact_auto_${r.id || numPart}`,
    name: r.employeeName,
    mechanicalNumber: r.mechanicalNumber,
    phone,
    secondaryPhones: [],
    allPhones: [{ number: phone, isWhatsApp: true, label: 'WhatsApp Principal' }],
    email,
    department: r.department || 'Operações & Serviços',
    category: r.category,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Generate complete contacts for all collaborators in receipts
export function getAllInitialContacts(): CollaboratorContact[] {
  const map = new Map<string, CollaboratorContact>();

  allInitialReceipts.forEach((r, idx) => {
    const key = r.mechanicalNumber ? r.mechanicalNumber.replace(/\D/g, '') : r.employeeName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, generateDefaultContactForReceipt(r, idx));
    }
  });

  return Array.from(map.values());
}

export function loadContactsFromStorage(): CollaboratorContact[] {
  try {
    const defaults = getAllInitialContacts();
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) {
      saveContactsToStorage(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveContactsToStorage(defaults);
      return defaults;
    }

    // Merge any missing initial receipts so all employees have contacts
    let hadNew = false;
    const merged = [...parsed];
    defaults.forEach((def) => {
      const exists = merged.some(
        (c) =>
          (c.mechanicalNumber &&
            def.mechanicalNumber &&
            c.mechanicalNumber.replace(/\D/g, '') === def.mechanicalNumber.replace(/\D/g, '')) ||
          c.name.trim().toLowerCase() === def.name.trim().toLowerCase()
      );
      if (!exists) {
        merged.push(def);
        hadNew = true;
      }
    });

    if (hadNew) {
      saveContactsToStorage(merged);
    }

    return merged;
  } catch (err) {
    console.error('Erro ao ler contactos do localStorage:', err);
    return getAllInitialContacts();
  }
}

export function saveContactsToStorage(contacts: CollaboratorContact[]): void {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch (err) {
    console.error('Erro ao gravar contactos no localStorage:', err);
  }
}

// Find a contact that matches an employee name or mechanical number
export function findMatchingContact(
  employeeName?: string,
  mechanicalNumber?: string,
  contacts: CollaboratorContact[] = []
): CollaboratorContact | undefined {
  if (!contacts || contacts.length === 0) return undefined;

  // 1. Match by mechanical number
  if (mechanicalNumber) {
    const cleanMecan = mechanicalNumber.replace(/\D/g, '');
    if (cleanMecan) {
      const byMecan = contacts.find(
        (c) => c.mechanicalNumber && c.mechanicalNumber.replace(/\D/g, '') === cleanMecan
      );
      if (byMecan) return byMecan;
    }
  }

  // 2. Match by normalized name
  if (employeeName) {
    const norm = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const cleanReceiptName = norm(employeeName);

    // Exact match
    const byExactName = contacts.find((c) => norm(c.name) === cleanReceiptName);
    if (byExactName) return byExactName;

    // Match by first and last name
    const receiptWords = cleanReceiptName.split(/\s+/).filter(Boolean);
    const byFirstAndLast = contacts.find((c) => {
      const cWords = norm(c.name).split(/\s+/).filter(Boolean);
      if (receiptWords.length >= 2 && cWords.length >= 2) {
        return (
          receiptWords[0] === cWords[0] &&
          receiptWords[receiptWords.length - 1] === cWords[cWords.length - 1]
        );
      }
      return false;
    });
    if (byFirstAndLast) return byFirstAndLast;

    // Match by substring containment
    const bySubstring = contacts.find((c) => {
      const cNorm = norm(c.name);
      return cleanReceiptName.includes(cNorm) || cNorm.includes(cleanReceiptName);
    });
    if (bySubstring) return bySubstring;
  }

  return undefined;
}

// Synchronize receipts with the contact database
export function syncReceiptsWithContacts(
  receipts: ReceiptData[],
  contacts: CollaboratorContact[]
): { updatedReceipts: ReceiptData[]; matchCount: number } {
  let matchCount = 0;

  const updatedReceipts = receipts.map((r) => {
    const contact = findMatchingContact(r.employeeName, r.mechanicalNumber, contacts);
    if (contact && (contact.phone || contact.email)) {
      matchCount++;
      return {
        ...r,
        phone: contact.phone || r.phone,
        email: contact.email || r.email,
      };
    }
    return r;
  });

  return { updatedReceipts, matchCount };
}
