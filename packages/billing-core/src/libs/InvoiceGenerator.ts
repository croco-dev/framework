import type { Invoice, InvoiceLineItem, InvoiceStatus } from "../types";

export type GenerateInvoiceParams = {
  invoiceId: string;
  billingAccountId: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  issuedAt: Date;
  dueAt?: Date;
  externalInvoiceId?: string;
  status?: InvoiceStatus;
};

export interface InvoiceGenerator {
  generate(params: GenerateInvoiceParams): Promise<Invoice>;
}
