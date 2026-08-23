import type { ScheduleRow } from '../types';
import { CSV_HEADERS } from '../types';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyRow(): ScheduleRow {
  return { id: newId(), date: '', time: '', section: '', title: '', notes: '', linkUrl: '', linkLabel: '' };
}

export function csvRenderRow(row: ScheduleRow, headers: string[]): string {
  return headers
    .map((h) => {
      if (h === 'date') return row.date;
      if (h === 'time') return row.time;
      if (h === 'section') return row.section;
      if (h === 'title') return row.title;
      if (h === 'notes') return row.notes;
      if (h === 'link') return row.linkUrl;
      return '';
    })
    .join(',');
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportCsv(rows: ScheduleRow[]): string {
  const lines = [CSV_HEADERS.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.date),
        csvEscape(row.time),
        csvEscape(row.section),
        csvEscape(row.title),
        csvEscape(row.notes),
        csvEscape(row.linkUrl),
      ].join(','),
    );
  }
  // UTF-8 BOM so Excel renders Arabic correctly.
  return '\ufeff' + lines.join('\n') + '\n';
}

export function downloadCsv(rows: ScheduleRow[], filename: string): void {
  const blob = new Blob([exportCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTemplate(): void {
  const example: ScheduleRow[] = [
    { ...emptyRow(), date: '2026-08-22', time: '10:00', section: 'مفاهيم شرعية', title: 'مثال: أضف عنوان الجلسة', notes: 'مثال: فوائد وملاحظات', linkUrl: 'https://example.com', linkLabel: 'فتح الرابط' },
  ];
  downloadCsv(example, 'قالب_الجدول.csv');
}

export interface ParseResult {
  rows: ScheduleRow[];
  skipped: number[];
}

/**
 * RFC 4180 CSV parser (handles quoted fields containing commas, quotes,
 * and newlines). Expects the exact header: date,time,section,title,notes,link.
 */
export function parseCsv(text: string): ParseResult {
  // Strip BOM and normalize line endings.
  const src = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');

  const rows: string[][] = [];
  let i = 0;
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      pushField();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) pushRow();

  if (rows.length === 0) {
    throw new Error('الملف فارغ');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const expected = [...CSV_HEADERS];
  if (header.join(',') !== expected.join(',')) {
    throw new Error('صيغة الملف غير صحيحة — تأكد أن السطر الأول يحمل رأس الأعمدة: date,time,section,title,notes,link');
  }

  const out: ScheduleRow[] = [];
  const skipped: number[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (idx: number) => (cells[idx] ?? '').trim();
    const date = get(0);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped.push(r + 1);
      continue;
    }
    if (cells.every((c) => c.trim() === '')) {
      continue;
    }
    out.push({
      id: newId(),
      date,
      time: get(1),
      section: get(2),
      title: get(3),
      notes: get(4),
      linkUrl: get(5),
      linkLabel: get(5) ? 'فتح الرابط' : '',
    });
  }
  return { rows: out, skipped };
}
