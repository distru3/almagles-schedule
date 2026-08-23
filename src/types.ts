export interface ScheduleRow {
  id: string;
  date: string; // YYYY-MM-DD or ''
  time: string;
  section: string;
  title: string;
  notes: string;
  linkUrl: string;
  linkLabel: string;
}

export const CSV_HEADERS = ['date', 'time', 'section', 'title', 'notes', 'link'] as const;
