import { Fragment, useRef, useEffect } from 'react';
import type { ScheduleRow, CustomColumn } from '../types';
import { formatHijri, formatGregorianShort, formatWeekday, getWeekKey, formatWeekRange } from '../lib/dates';

interface Props {
  rows: ScheduleRow[];
  columns: CustomColumn[];
  nextWeekLabel: string;
  selectedWeekKey: string;
  onSelectWeekKey: (key: string) => void;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onSetLink: (id: string) => void;
  onDeleteColumn: (colId: string) => void;
  onAddRowToWeek: (weekIso: string) => void;
  onDuplicateRowDate: (date: string, afterId: string) => void;
  onOpenAddWeekModal: () => void;
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

function AutoFoldingCell({
  value,
  placeholder,
  onChange,
  className = 'cell-text',
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
    />
  );
}

export default function ScheduleTable({
  rows,
  columns,
  nextWeekLabel,
  selectedWeekKey,
  onSelectWeekKey,
  onUpdate,
  onDelete,
  onSetLink,
  onDeleteColumn,
  onAddRowToWeek,
  onDuplicateRowDate,
  onOpenAddWeekModal,
}: Props) {
  // Group rows by week (Saturday key)
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

  // Effective selected week key
  const effectiveWeekKey =
    selectedWeekKey === 'all'
      ? 'all'
      : sortedKeys.includes(selectedWeekKey)
      ? selectedWeekKey
      : sortedKeys.length > 0
      ? sortedKeys[0]
      : 'all';

  const currentIdx = sortedKeys.indexOf(effectiveWeekKey);
  const canGoPrev = effectiveWeekKey !== 'all' && currentIdx > 0;
  const canGoNext = effectiveWeekKey !== 'all' && currentIdx >= 0 && currentIdx < sortedKeys.length - 1;

  const handlePrevWeek = () => {
    if (canGoPrev) {
      onSelectWeekKey(sortedKeys[currentIdx - 1]);
    }
  };

  const handleNextWeek = () => {
    if (canGoNext) {
      onSelectWeekKey(sortedKeys[currentIdx + 1]);
    }
  };

  const handlePrintCurrentWeek = () => {
    window.print();
  };

  const handlePrintSpecificWeek = (weekKey: string) => {
    onSelectWeekKey(weekKey);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const keysToRender =
    effectiveWeekKey === 'all'
      ? sortedKeys
      : sortedKeys.includes(effectiveWeekKey)
      ? [effectiveWeekKey]
      : sortedKeys.slice(0, 1);

  const totalCols = 8 + columns.length;

  return (
    <div className="schedule-container">
      {/* Week Navigation & Display Switcher (No Print) */}
      {sortedKeys.length > 0 && (
        <div className="week-nav-bar no-print">
          <div className="week-nav-controls">
            <button
              type="button"
              className="btn-week-nav"
              onClick={handlePrevWeek}
              disabled={!canGoPrev}
              title="الأسبوع السابق"
            >
              ◀ السابق
            </button>

            <div className="week-select-wrapper">
              <span className="week-nav-label">عرض:</span>
              <select
                className="week-select"
                value={effectiveWeekKey}
                onChange={(e) => onSelectWeekKey(e.target.value)}
              >
                {sortedKeys.map((k, idx) => (
                  <option key={k} value={k}>
                    {k !== 'unassigned'
                      ? `الأسبوع ${idx + 1}: ${formatWeekRange(k)}`
                      : 'جلسات بدون تاريخ محدد'}
                  </option>
                ))}
                <option value="all">👁️ عرض جميع الأسابيع في صفحة واحدة</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-week-nav"
              onClick={handleNextWeek}
              disabled={!canGoNext}
              title="الأسبوع التالي"
            >
              التالي ▶
            </button>
          </div>

          <div className="week-nav-actions">
            <button
              type="button"
              className="btn-print-week"
              onClick={handlePrintCurrentWeek}
              title="طباعة الأسبوع الظاهر على الشاشة فقط بصيغة PDF"
            >
              🖨 طباعة هذا الأسبوع (PDF)
            </button>
            <button
              type="button"
              className="btn-open-add-week"
              onClick={onOpenAddWeekModal}
              title="إضافة أسبوع جديد (تلقائي أو اختيار أي أسبوع بعيد)"
            >
              📅➕ إضافة أسبوع...
            </button>
          </div>
        </div>
      )}

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

            {keysToRender.map((weekKey) => {
              const weekRows = weekMap.get(weekKey) || [];
              const weekIdx = sortedKeys.indexOf(weekKey);

              return (
                <Fragment key={`week-group-${weekKey}`}>
                  <tr className="week-separator-row">
                    <td colSpan={totalCols} data-label="الأسبوع">
                      <div className="week-header-content">
                        <div className="week-title-wrap">
                          <span className="week-badge">
                            {weekIdx >= 0 ? `الأسبوع ${weekIdx + 1}` : 'أسبوع'}
                          </span>
                          <span className="week-range-text">
                            {weekKey !== 'unassigned' ? formatWeekRange(weekKey) : 'جلسات غير محددة التاريخ'}
                          </span>
                        </div>
                        <div className="week-actions no-print">
                          {weekKey !== 'unassigned' && (
                            <>
                              <button
                                type="button"
                                className="btn-week-add-session"
                                onClick={() => onAddRowToWeek(weekKey)}
                                title="إضافة جلسة لهذا الأسبوع"
                              >
                                ➕ إضافة جلسة
                              </button>
                              <button
                                type="button"
                                className="btn-week-print-session"
                                onClick={() => handlePrintSpecificWeek(weekKey)}
                                title="طباعة هذا الأسبوع فقط بصيغة PDF"
                              >
                                🖨 طباعة هذا الأسبوع
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {weekRows.map((row, rowIdx) => {
                    const sessionNumber = rowIdx + 1;
                    return (
                      <tr key={row.id}>
                        <td className="col-num" data-label="رقم">
                          {sessionNumber}
                        </td>
                        <td className="date-cell" data-label="التاريخ">
                          <DateCell value={row.date} onChange={(v) => onUpdate(row.id, { date: v })} />
                        </td>
                        <td data-label="الوقت">
                          <AutoFoldingCell
                            value={row.time}
                            placeholder="مثال: 10:00"
                            onChange={(v) => onUpdate(row.id, { time: v })}
                          />
                        </td>
                        <td data-label="القسم">
                          <AutoFoldingCell
                            value={row.section}
                            placeholder="القسم…"
                            onChange={(v) => onUpdate(row.id, { section: v })}
                          />
                        </td>
                        <td data-label="العنوان">
                          <AutoFoldingCell
                            value={row.title}
                            placeholder="عنوان الجلسة…"
                            onChange={(v) => onUpdate(row.id, { title: v })}
                          />
                        </td>
                        <td data-label="ملاحظات">
                          <AutoFoldingCell
                            className="cell-text area"
                            value={row.notes}
                            placeholder="ملاحظات أو فوائد…"
                            onChange={(v) => onUpdate(row.id, { notes: v })}
                          />
                        </td>

                        {columns.map((col) => (
                          <td key={col.id} className="col-custom" data-label={col.label}>
                            <AutoFoldingCell
                              value={row.customValues?.[col.id] || ''}
                              placeholder={`${col.label}…`}
                              onChange={(v) => {
                                const next = { ...(row.customValues || {}), [col.id]: v };
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
        <button type="button" className="btn-add-next-week-large" onClick={onOpenAddWeekModal}>
          <span className="plus-icon">📅➕</span>
          <span>إضافة أسبوع جديد (التالي: {nextWeekLabel} — أو اختيار أي تاريخ محدد)</span>
        </button>
      </div>
    </div>
  );
}
