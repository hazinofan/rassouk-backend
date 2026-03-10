import { Injectable } from '@nestjs/common';

interface InvoicePdfPayload {
  invoiceNumber: string;
  issuedAt: Date | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  audience: string;
  planKey: string;
  customerName: string;
  customerEmail: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  provider: string;
}

@Injectable()
export class InvoicePdfService {
  generate(payload: InvoicePdfPayload): Buffer {
    const lines = [
      'Rassouk Receipt',
      `Invoice: ${payload.invoiceNumber}`,
      `Issued: ${this.formatDate(payload.issuedAt)}`,
      `Customer: ${payload.customerName}`,
      `Email: ${payload.customerEmail}`,
      `Audience: ${payload.audience}`,
      `Plan: ${payload.planKey}`,
      `Description: ${payload.description}`,
      `Amount: ${payload.amount.toFixed(2)} ${payload.currency}`,
      `Status: ${payload.status}`,
      `Period: ${this.formatDate(payload.periodStart)} -> ${this.formatDate(payload.periodEnd)}`,
      `Provider: ${payload.provider}`,
      'Thank you for using Rassouk.',
    ];

    const stream = [
      'BT',
      '/F1 22 Tf',
      '50 780 Td',
      `(${this.escape(lines[0])}) Tj`,
      '/F1 11 Tf',
      '0 -30 Td',
      ...lines.slice(1).flatMap((line) => [
        `(${this.escape(line)}) Tj`,
        '0 -18 Td',
      ]),
      'ET',
    ].join('\n');

    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
      '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
      `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private formatDate(value: Date | null) {
    if (!value) return '-';
    return new Date(value).toISOString().slice(0, 10);
  }

  private escape(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}
