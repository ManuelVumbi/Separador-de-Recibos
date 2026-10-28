export interface ReceiptItem {
  code: string;
  desc: string;
  qty?: number;
  unitValue?: number;
  earnings?: number;
  deductions?: number;
}

export interface ReceiptData {
  id: string;
  sourceDoc: string;
  pageNumber: number;
  companyName: string;
  companyNif: string;
  companyAddress: string;
  employeeName: string;
  mechanicalNumber: string;
  category: string;
  beneficiaryNumber: string;
  taxNumber: string;
  department: string;
  period: string;
  closingDate: string;
  daysWorked: number;
  hourlyRate: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  currency: string;
  paymentMethod: string;
  items: ReceiptItem[];
  suggestedFileName: string;
  originalPdfBytes?: Uint8Array;
  email?: string;
  phone?: string;
  sentAt?: string;
  sentChannel?: 'whatsapp' | 'email';
}

export interface BatchHistoryRecord {
  id: string;
  timestamp: string;
  batchName: string;
  actionType: 'export_zip' | 'upload_split' | 'manual_add';
  receiptCount: number;
  totalAmount: number;
  currency: string;
  patternUsed: string;
  receiptNames: string[];
  notes?: string;
}

