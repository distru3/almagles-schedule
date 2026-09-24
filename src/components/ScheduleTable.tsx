import { Fragment, useRef } from 'react';
import type { ScheduleRow, CustomColumn } from '../types';
import { formatHijri, formatGregorianShort, formatWeekday, getWeekKey, formatWeekRange } from '../lib/dates';

interface Props {
  rows: ScheduleRow[];
  columns: CustomColumn[];
  nextWeekLabel: string;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onSetLink: (id: string) => void;
  onDeleteColumn: (colId: string) => void;
  onAddRowToWeek: (mondayIso: string) => void;
  onDuplicateRowDate: (date: string, afterId: string) => void;
  onAddWeek: () => void;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch {
        el.focus();
      }
    } else {
      el.focus();
    }
  };

  return (
    <div className="date-cell" onClick={openPicker}>
      <input
        ref={inputRef}
        type="date"
        className="date-input-overlay"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="اضغط لاختيار التاريخ"
      />
      <div className="date-btn" aria-hidden="true">
        {value ? (
          <>
            <span className="date-hijri">{formatHijri(value)}</span>
            <span className="date-greg">
              {formatWeekday(value)} — {formatGregorianShort(value)} م
            </span>
          </>
        ) : (
          <span className="date-placeholder">📅 اضغط لتحديد التاريخ</span>
        )}
      </div>
    </div>
  );
}

export default function ScheduleTable({
  rows,
  columns,
  nextWeekLabel,
  onUpdate,
  onDelete,
  onSetLink,
  onDeleteColumn,
  onAddRowToWeek,
  onDuplicateRowDate,
  onAddWeek,
}: Props) {
  // Group rows by week (Monday key)
  const weekMap = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = getWeekKey(row.date);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(row);
  }

  // Sort week keys chronologically
  const sortedKeys = Array.from(weekMap.keys()).sort((a, b) => {
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    return a.localeCompare(b);
  });

  const totalCols = 8 + columns.length;
  let runningIndex = 0;

  return (
    <div className="schedule-container">
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
              {columns.map((col) => (
                <th key={col.id} className="col-custom">
                  <div className="custom-th-content">
                    <span>{col.label}</span>
                    <button
                      type="button"
                      className="col-del-btn no-print"
                      onClick={() => onDeleteColumn(col.id)}
                      title={`حذف عمود «${col.label}»`}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="col-link">الرابط</th>
              <th className="col-del no-print"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="empty-row">
                <td
                  data-label=""
                  colSpan={totalCols}
                  style={{ textAlign: 'center', color: '#a8a29e', padding: '28px', fontStyle: 'italic' }}
                >
                  لا توجد صفوف بعد — اضغط «📅 إضافة أسبوع» أو «➕ إضافة صف» للبدء.
                </td>
              </tr>
            )}

            {sortedKeys.map((weekKey, weekIdx) => {
              const weekRows = weekMap.get(weekKey) || [];
              return (
                <Fragment key={`week-group-${weekKey}`}>
                  <tr className="week-separator-row">
                    <td colSpan={totalCols} data-label="الأسبوع">
                      <div className="week-header-content">
                        <div className="week-title-wrap">
                          <span className="week-badge">الأسبوع {weekIdx + 1}</span>
                          <span className="week-range-text">
                            {weekKey !== 'unassigned' ? formatWeekRange(weekKey) : 'جلسات غير محددة التاريخ'}
                          </span>
                        </div>
                        <div className="week-actions no-print">
                          {weekKey !== 'unassigned' && (
                            <button
                              type="button"
                              className="btn-week-add-session"
                              onClick={() => onAddRowToWeek(weekKey)}
                              title="إضافة جلسة لهذا الأسبوع"
                            >
                              ➕ إضافة جلسة بهذا الأسبوع
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {weekRows.map((row) => {
                    runningIndex++;
                    const rowIndex = runningIndex;
                    return (
                      <tr key={row.id}>
                        <td className="col-num" data-label="رقم">
                          {rowIndex}
                        </td>
                        <td className="date-cell" data-label="التاريخ">
                          <DateCell value={row.date} onChange={(v) => onUpdate(row.id, { date: v })} />
                        </td>
                        <td data-label="الوقت">
                          <input
                            className="cell-text"
                            value={row.time}
                            placeholder="مثال: 10:00"
                            onChange={(e) => onUpdate(row.id, { time: e.target.value })}
                          />
                        </td>
                        <td data-label="القسم">
                          <input
                            className="cell-text"
                            value={row.section}
                            placeholder="القسم…"
                            onChange={(e) => onUpdate(row.id, { section: e.target.value })}
                          />
                        </td>
                        <td data-label="العنوان">
                          <textarea
                            className="cell-text"
                            value={row.title}
                            placeholder="عنوان الجلسة…"
                            rows={1}
                            onChange={(e) => onUpdate(row.id, { title: e.target.value })}
                          />
                        </td>
                        <td data-label="ملاحظات">
                          <textarea
                            className="cell-text area"
                            value={row.notes}
                            placeholder="ملاحظات أو فوائد…"
                            rows={2}
                            onChange={(e) => onUpdate(row.id, { notes: e.target.value })}
                          />
                        </td>

                        {columns.map((col) => (
                          <td key={col.id} data-label={col.label}>
                            <input
                              className="cell-text"
                              value={row.customValues?.[col.id] || ''}
                              placeholder={`${col.label}…`}
                              onChange={(e) => {
                                const next = { ...(row.customValues || {}), [col.id]: e.target.value };
                                onUpdate(row.id, { customValues: next });
                              }}
                            />
                          </td>
                        ))}

                        <td className="link-cell" data-label="الرابط">
                          <LinkCell row={row} onSetLink={() => onSetLink(row.id)} />
                        </td>
                        <td className="no-print col-del-td" data-label="الإجراءات" style={{ textAlign: 'center' }}>
                          <div className="row-action-btns">
                            <button
                              type="button"
                              className="row-action-btn add-btn-small"
                              onClick={() => onDuplicateRowDate(row.date, row.id)}
                              title="إضافة جلسة أخرى في هذا اليوم"
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              className="del-btn"
                              onClick={() => onDelete(row.id)}
                              title="حذف الجلسة"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="add-next-week-bar no-print">
        <button type="button" className="btn-add-next-week-large" onClick={onAddWeek}>
          <span className="plus-icon">📅➕</span>
          <span>إضافة الأسبوع التالي ({nextWeekLabel})</span>
        </button>
      </div>
    </div>
  );
}
