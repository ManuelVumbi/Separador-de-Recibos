export interface ContactPhoneItem {
  number: string;
  isWhatsApp?: boolean;
  label?: string;
}

export interface CollaboratorContact {
  id: string;
  name: string;
  mechanicalNumber?: string;
  phone: string; // Contacto principal prioritário (prioriza WhatsApp e 1º contacto)
  secondaryPhones?: string[]; // Contactos adicionais / alternativos
  allPhones?: ContactPhoneItem[]; // Lista completa de contactos com indicação de WhatsApp
  email: string;
  secondaryEmails?: string[];
  department?: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactImportResult {
  added: number;
  updated: number;
  skipped: number;
  contacts: CollaboratorContact[];
  errors: string[];
}
