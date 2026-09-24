import type { ScheduleRow, CustomColumn } from '../types';
import { BASE_CSV_HEADERS } from '../types';

export function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyRow(date = ''): ScheduleRow {
  return {
    id: newId(),
    date,
    time: '',
    section: '',
    title: '',
    notes: '',
    linkUrl: '',
    linkLabel: '',
    customValues: {},
  };
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportCsv(rows: ScheduleRow[], customColumns: CustomColumn[] = []): string {
  const headers = [...BASE_CSV_HEADERS, ...customColumns.map((c) => c.label)];
  const lines = [headers.map(csvEscape).join(',')];

  for (const row of rows) {
    const rowValues = [
      csvEscape(row.date),
      csvEscape(row.time),
      csvEscape(row.section),
      csvEscape(row.title),
      csvEscape(row.notes),
      csvEscape(row.linkUrl),
      ...customColumns.map((c) => csvEscape(row.customValues?.[c.id] || '')),
    ];
    lines.push(rowValues.join(','));
  }
  // UTF-8 BOM so Excel renders Arabic correctly.
  return '\ufeff' + lines.join('\n') + '\n';
}

export function downloadCsv(rows: ScheduleRow[], filename: string, customColumns: CustomColumn[] = []): void {
  const blob = new Blob([exportCsv(rows, customColumns)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTemplate(customColumns: CustomColumn[] = []): void {
  const example: ScheduleRow[] = [
    {
      ...emptyRow('2026-08-22'),
      time: '10:00',
      section: 'مفاهيم شرعية',
      title: 'مثال: أضف عنوان الجلسة',
      notes: 'مثال: فوائد وملاحظات',
      linkUrl: 'https://example.com',
      linkLabel: 'فتح الرابط',
      customValues: customColumns.reduce<Record<string, string>>((acc, col) => {
        acc[col.id] = 'مثال';
        return acc;
      }, {}),
    },
  ];
  downloadCsv(example, 'قالب_الجدول.csv', customColumns);
}

export interface ParseResult {
  rows: ScheduleRow[];
  skipped: number[];
  detectedColumns: CustomColumn[];
}

/**
 * RFC 4180 CSV parser (handles quoted fields containing commas, quotes,
 * and newlines). Expects at least: date,time,section,title,notes,link.
 * Any additional headers are automatically parsed as custom columns.
 */
export function parseCsv(text: string, existingColumns: CustomColumn[] = []): ParseResult {
  // Strip BOM and normalize line endings.
  const src = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');

  const rawRows: string[][] = [];
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
    rawRows.push(row);
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

  if (rawRows.length === 0) {
    throw new Error('الملف فارغ');
  }

  const rawHeader = rawRows[0].map((h) => h.trim());
  const baseHeadersCount = BASE_CSV_HEADERS.length;
  const headerLower = rawHeader.slice(0, baseHeadersCount).map((h) => h.toLowerCase());

  if (headerLower.join(',') !== BASE_CSV_HEADERS.join(',')) {
    throw new Error(
      'صيغة الملف غير صحيحة — يجب أن يبدأ السطر الأول بالأعمدة الأساسية: date,time,section,title,notes,link',
    );
  }

  // Detect custom columns from header beyond base headers
  const detectedColumns: CustomColumn[] = [...existingColumns];
  const customColIndices: { index: number; colId: string }[] = [];

  for (let c = baseHeadersCount; c < rawHeader.length; c++) {
    const label = rawHeader[c];
    if (!label) continue;
    let match = detectedColumns.find((dc) => dc.label.toLowerCase() === label.toLowerCase());
    if (!match) {
      match = { id: `col_${newId().slice(0, 8)}`, label };
      detectedColumns.push(match);
    }
    customColIndices.push({ index: c, colId: match.id });
  }

  const out: ScheduleRow[] = [];
  const skipped: number[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r];
    const get = (idx: number) => (cells[idx] ?? '').trim();
    const date = get(0);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped.push(r + 1);
      continue;
    }
    if (cells.every((c) => c.trim() === '')) {
      continue;
    }

    const customValues: Record<string, string> = {};
    for (const { index, colId } of customColIndices) {
      const val = get(index);
      if (val) customValues[colId] = val;
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
      customValues,
    });
  }

  return { rows: out, skipped, detectedColumns };
}

