import { useRef } from 'react';
import type { ScheduleRow } from '../types';
import { formatHijri, formatGregorianShort, formatWeekday } from '../lib/dates';

interface Props {
  rows: ScheduleRow[];
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onSetLink: (id: string) => void;
}

function LinkCell({ row, onSetLink }: { row: ScheduleRow; onSetLink: () => void }) {
  if (row.linkUrl) {
    return (
      <div className="link-holder">
        <a className="link-set" href={row.linkUrl} target="_blank" rel="noopener noreferrer">
          🔗 {row.linkLabel || 'فتح الرابط'}
        </a>
        <button type="button" className="edit-pencil no-print" onClick={onSetLink} title="تعديل الرابط">
          ✎
        </button>
      </div>
    );
  }
  return (
    <div className="link-holder">
      <button type="button" className="link-btn no-print" onClick={onSetLink}>
        🔗 إضافة رابط
      </button>
    </div>
  );
}

function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pickRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const el = pickRef.current;
    if (!el) return;
    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      (el as HTMLInputElement & { showPicker: () => void }).showPicker();
    } else {
      el.click();
    }
  };
  return (
    <div className="date-cell">
      <input
        ref={pickRef}
        type="date"
        className="date-input-hidden"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="date-btn" onClick={openPicker} title="اختر التاريخ">
        {value ? (
          <>
            <span className="date-hijri">{formatHijri(value)}</span>
            <span className="date-greg">{formatWeekday(value)} — {formatGregorianShort(value)} م</span>
          </>
        ) : (
          <span className="date-placeholder">اختر التاريخ</span>
        )}
      </button>
    </div>
  );
}

export default function ScheduleTable({ rows, onUpdate, onDelete, onSetLink }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="col-num">#</th>
            <th className="col-date">التاريخ</th>
            <th className="col-time">الوقت</th>
            <th className="col-section">القسم</th>
            <th className="col-title">العنوان</th>
            <th className="col-notes">ملاحظات</th>
            <th className="col-link">الرابط</th>
            <th className="col-del no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: '#a8a29e', padding: '28px', fontStyle: 'italic' }}>
                لا توجد صفوف بعد — اضغط «➕ إضافة صف» أو استورد ملف CSV.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id}>
              <td className="col-num">{i + 1}</td>
              <td className="date-cell">
                <DateCell value={row.date} onChange={(v) => onUpdate(row.id, { date: v })} />
              </td>
              <td>
                <input
                  className="cell-text"
                  value={row.time}
                  placeholder="مثال: 10:00"
                  onChange={(e) => onUpdate(row.id, { time: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="cell-text"
                  value={row.section}
                  placeholder="القسم…"
                  onChange={(e) => onUpdate(row.id, { section: e.target.value })}
                />
              </td>
              <td>
                <textarea
                  className="cell-text"
                  value={row.title}
                  placeholder="عنوان الجلسة…"
                  rows={1}
                  onChange={(e) => onUpdate(row.id, { title: e.target.value })}
                />
              </td>
              <td>
                <textarea
                  className="cell-text area"
                  value={row.notes}
                  placeholder="ملاحظات أو فوائد…"
                  rows={2}
                  onChange={(e) => onUpdate(row.id, { notes: e.target.value })}
                />
              </td>
              <td className="link-cell">
                <LinkCell row={row} onSetLink={() => onSetLink(row.id)} />
              </td>
              <td className="no-print" style={{ textAlign: 'center' }}>
                <button
                  className="del-btn"
                  onClick={() => onDelete(row.id)}
                  title="حذف الصف"
                >
                  🗑
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
