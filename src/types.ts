export interface CustomColumn {
  id: string;
  label: string;
}

export interface ScheduleRow {
  id: string;
  date: string; // YYYY-MM-DD or ''
  time: string;
  section: string;
  title: string;
  notes: string;
  linkUrl: string;
  linkLabel: string;
  customValues?: Record<string, string>;
}

export const BASE_CSV_HEADERS = ['date', 'time', 'section', 'title', 'notes', 'link'] as const;
export const CSV_HEADERS = BASE_CSV_HEADERS;

