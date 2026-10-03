import { Fragment, useRef, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleRow, CustomColumn } from '../types';
import { isBlankRow, rankedValues } from '../lib/rows';
import {
  formatHijri,
  formatGregorianShort,
  formatWeekday,
  getWeekKey,
  formatWeekRange,
  formatWeekShort,
  generateWeekDates,
  relativeWeekLabel,
  todayISO,
  toISODate,
  getSaturdayOfWeek,
} from '../lib/dates';

interface Props {
  rows: ScheduleRow[];
  columns: CustomColumn[];
  /** All week keys, sorted (undated last). */
  weekKeys: string[];
  /** While printing: only these weeks are rendered. */
  printWeekKeys: string[] | null;
  nextWeekLabel: string;
  selectedWeekKey: string;
  onSelectWeekKey: (key: string) => void;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onSetLink: (id: string) => void;
  onDeleteColumn: (colId: string) => void;
  onAddSession: (date: string) => void;
  onDeleteWeek: (weekKey: string) => void;
  copySourceFor: (weekKey: string) => string | null;
  onCopyWeek: (fromKey: string, toKey: string) => void;
  onPrintWeeks: (weekKeys: string[]) => void;
  onOpenAddWeekModal: () => void;
}

/** Common session times offered before anything has been typed. */
const TIME_PRESETS = ['بعد الفجر', 'بعد الظهر', 'بعد العصر', 'بعد المغرب', 'بعد العشاء'];

interface Suggestions {
  time: string[];
  section: string[];
  custom: Record<string, string[]>;
}

function LinkCell({ row, onSetLink }: { row: ScheduleRow; onSetLink: () => void }) {
  if (row.linkUrl) {
    return (
      <div className="link-holder">
        <a className="link-set" href={row.linkUrl} target="_blank" rel="noopener noreferrer">
          🔗 {row.linkLabel || 'فتح الرابط'}
        </a>
        {/* Printed under the label so the link still works when a PDF printer drops clickable links
            (e.g. "Microsoft Print to PDF"); PDF viewers turn visible URLs back into links. */}
        <a className="link-url-print" href={row.linkUrl} dir="ltr">
          {row.linkUrl}
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

/** Fixed day label for a week's day group: weekday, Hijri and Gregorian date. */
function DayLabel({ date, onAddSession }: { date: string; onAddSession: () => void }) {
  return (
    <div className="day-label">
      <span className="day-name">
        {formatWeekday(date)}
        {date === todayISO() && <span className="today-tag no-print">اليوم</span>}
      </span>
      <span className="date-hijri">{formatHijri(date)}</span>
      <span className="date-greg">{formatGregorianShort(date)} م</span>
      <button type="button" className="btn-day-add no-print" onClick={onAddSession} title="إضافة جلسة لهذا اليوم">
        ➕ جلسة
      </button>
    </div>
  );
}

function AutoFoldingCell({
  value,
  placeholder,
  onChange,
  className = 'cell-text',
  suggestions,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
  /** Values offered in a dropdown while the cell is focused. */
  suggestions?: string[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const query = value.trim();
  const matches = (suggestions || [])
    .filter((sug) => sug !== query && (!query || sug.includes(query)))
    .slice(0, 8);
  const showList = focused && matches.length > 0 && anchor !== null;

  // Keep the dropdown attached to the cell while the page scrolls or resizes.
  useEffect(() => {
    if (!focused || !suggestions) return;
    const place = () => setAnchor(textareaRef.current?.getBoundingClientRect() ?? null);
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [focused, suggestions, value]);

  const choose = (sug: string) => {
    onChange(sug);
    setActiveIdx(-1);
    setFocused(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      choose(matches[activeIdx]);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  // Re-measure when the column width changes or web fonts finish loading,
  // otherwise wrapped text stays clipped at its old height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    document.fonts?.ready.then(resize);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <textarea
        ref={textareaRef}
        rows={1}
        className={`${className} no-print`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIdx(-1);
          setFocused(true);
          resize();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setActiveIdx(-1);
        }}
        onKeyDown={suggestions ? onKeyDown : undefined}
      />
      {showList &&
        createPortal(
          <ul
            className="suggest-list no-print"
            role="listbox"
            // Right-aligned to the cell, matching the RTL layout.
            style={{
              top: anchor.bottom + 4,
              left: Math.max(8, anchor.right - Math.max(anchor.width, 160)),
              width: Math.max(anchor.width, 160),
            }}
          >
            {matches.map((sug, i) => (
              <li
                key={sug}
                role="option"
                aria-selected={i === activeIdx}
                className={i === activeIdx ? 'is-active' : undefined}
                // mousedown (not click) so the textarea keeps focus until the value is set
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(sug);
                }}
              >
                {sug}
              </li>
            ))}
          </ul>,
          document.body,
        )}
      {/* Textareas can't grow to fit their content in print, so print a plain-text mirror instead. */}
      <div className="cell-print">{value}</div>
    </>
  );
}

function SessionCells({
  row,
  columns,
  suggestions,
  onUpdate,
  onSetLink,
}: {
  row: ScheduleRow;
  columns: CustomColumn[];
  suggestions: Suggestions;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onSetLink: (id: string) => void;
}) {
  return (
    <>
      <td data-label="الوقت">
        <AutoFoldingCell
          value={row.time}
          placeholder="مثال: بعد العصر"
          suggestions={suggestions.time}
          onChange={(v) => onUpdate(row.id, { time: v })}
        />
      </td>
      <td data-label="القسم">
        <AutoFoldingCell
          value={row.section}
          placeholder="القسم…"
          suggestions={suggestions.section}
          onChange={(v) => onUpdate(row.id, { section: v })}
        />
      </td>
      <td data-label="العنوان">
        <AutoFoldingCell value={row.title} placeholder="عنوان الجلسة…" onChange={(v) => onUpdate(row.id, { title: v })} />
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
            suggestions={suggestions.custom[col.id]}
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
    </>
  );
}

export default function ScheduleTable({
  rows,
  columns,
  weekKeys,
  printWeekKeys,
  nextWeekLabel,
  selectedWeekKey,
  onSelectWeekKey,
  onUpdate,
  onDelete,
  onSetLink,
  onDeleteColumn,
  onAddSession,
  onDeleteWeek,
  copySourceFor,
  onCopyWeek,
  onPrintWeeks,
  onOpenAddWeekModal,
}: Props) {
  // Group rows by week (Saturday key)
  const weekMap = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = getWeekKey(row.date);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(row);
  }

  const sortedKeys = weekKeys;

  const suggestions = useMemo<Suggestions>(() => {
    const custom: Record<string, string[]> = {};
    for (const col of columns) custom[col.id] = rankedValues(rows.map((r) => r.customValues?.[col.id] || ''));
    const usedTimes = rankedValues(rows.map((r) => r.time));
    return {
      time: [...usedTimes, ...TIME_PRESETS.filter((t) => !usedTimes.includes(t))],
      section: rankedValues(rows.map((r) => r.section)),
      custom,
    };
  }, [rows, columns]);

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

  const thisWeekKey = toISODate(getSaturdayOfWeek(new Date()));
  const canJumpToThisWeek = sortedKeys.includes(thisWeekKey) && effectiveWeekKey !== thisWeekKey;

  const weekOptionLabel = (k: string) => {
    if (k === 'unassigned') return 'جلسات بدون تاريخ محدد';
    const rel = relativeWeekLabel(k);
    return rel ? `${rel} · ${formatWeekShort(k)}` : formatWeekShort(k);
  };

  const keysToRender = printWeekKeys
    ? printWeekKeys
    : effectiveWeekKey === 'all'
      ? sortedKeys
      : sortedKeys.includes(effectiveWeekKey)
      ? [effectiveWeekKey]
      : sortedKeys.slice(0, 1);

  // #, day, time, section, title, notes, ...custom, link, actions
  const totalCols = 8 + columns.length;
  const sessionCols = 5 + columns.length; // time..link

  const actionsCell = (row: ScheduleRow, weekDays: string[] | null) => (
    <td className="no-print col-del-td" data-label="الإجراءات" style={{ textAlign: 'center' }}>
      <div className="row-action-btns">
        {weekDays && (
          <select
            className="move-day-select"
            value={row.date}
            onChange={(e) => onUpdate(row.id, { date: e.target.value })}
            title="نقل الجلسة إلى يوم آخر"
          >
            {weekDays.map((d) => (
              <option key={d} value={d}>
                {formatWeekday(d)}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="del-btn" onClick={() => onDelete(row.id)} title="حذف الجلسة">
          🗑
        </button>
      </div>
    </td>
  );

  const renderWeekBody = (weekKey: string, weekRows: ScheduleRow[]) => {
    if (weekKey === 'unassigned') {
      return weekRows.map((row, idx) => (
        <tr key={row.id} className={isBlankRow(row) ? 'print-hide' : undefined}>
          <td className="col-num" data-label="رقم">
            {idx + 1}
          </td>
          <td className="date-cell" data-label="التاريخ">
            <DateCell value={row.date} onChange={(v) => onUpdate(row.id, { date: v })} />
          </td>
          <SessionCells
                  row={row}
                  columns={columns}
                  suggestions={suggestions}
                  onUpdate={onUpdate}
                  onSetLink={onSetLink}
                />
          {actionsCell(row, null)}
        </tr>
      ));
    }

    const weekDays = generateWeekDates(weekKey);
    let sessionNumber = 0;
    const copySource = weekRows.every(isBlankRow) ? copySourceFor(weekKey) : null;

    const copyBanner = copySource && (
      <tr key="copy-banner" className="copy-banner-row no-print">
        <td colSpan={totalCols} data-label="">
          <div className="copy-banner">
            <span>هذا الأسبوع فارغ — أضف جلسة لأي يوم، أو ابدأ بنسخ جلسات أسبوع سابق (بدون الملاحظات).</span>
            <button type="button" className="btn-copy-week" onClick={() => onCopyWeek(copySource, weekKey)}>
              📋 نسخ جلسات أسبوع {formatWeekShort(copySource)}
            </button>
          </div>
        </td>
      </tr>
    );

    const dayRows = weekDays.map((day, dayIdx) => {
      const sessions = weekRows.filter((r) => r.date === day);
      const altClass = [dayIdx % 2 === 1 ? 'day-alt' : '', day === todayISO() ? 'day-today' : '']
        .filter(Boolean)
        .join(' ');
      const dayCaption = `${formatWeekday(day)} — ${formatHijri(day)}`;

      if (sessions.length === 0) {
        return (
          <tr key={`empty-${day}`} className={`day-empty print-hide ${altClass}`} data-day={dayCaption}>
            <td className="col-num" data-label="" />
            <td className="day-cell" data-label="اليوم">
              <DayLabel date={day} onAddSession={() => onAddSession(day)} />
            </td>
            <td colSpan={sessionCols + 1} className="day-empty-msg" data-label="">
              لا توجد جلسات — اضغط «➕ جلسة» للإضافة
            </td>
          </tr>
        );
      }

      // Days whose sessions are all still blank are left out of the PDF.
      const allBlank = sessions.every(isBlankRow);

      return (
        <Fragment key={`day-${day}`}>
          {sessions.map((row, i) => {
            sessionNumber += 1;
            const classes = [i === 0 ? 'day-first' : 'day-cont', altClass, allBlank ? 'print-hide' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <tr key={row.id} className={classes} data-day={dayCaption}>
                <td className="col-num" data-label="رقم">
                  {sessionNumber}
                </td>
                {i === 0 && (
                  <td className="day-cell" rowSpan={sessions.length} data-label="اليوم">
                    <DayLabel date={day} onAddSession={() => onAddSession(day)} />
                  </td>
                )}
                <SessionCells
                  row={row}
                  columns={columns}
                  suggestions={suggestions}
                  onUpdate={onUpdate}
                  onSetLink={onSetLink}
                />
                {actionsCell(row, weekDays)}
              </tr>
            );
          })}
        </Fragment>
      );
    });

    return [copyBanner, ...dayRows];
  };

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
              <select
                className="week-select"
                value={effectiveWeekKey}
                onChange={(e) => onSelectWeekKey(e.target.value)}
              >
                {sortedKeys.map((k) => (
                  <option key={k} value={k}>
                    {weekOptionLabel(k)}
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

            <button
              type="button"
              className="btn-week-today"
              onClick={() => onSelectWeekKey(thisWeekKey)}
              disabled={!canJumpToThisWeek}
              title="الانتقال إلى الأسبوع الحالي"
            >
              ⦿ هذا الأسبوع
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-date">اليوم</th>
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
            {sortedKeys.length === 0 && (
              <tr className="empty-row">
                <td
                  data-label=""
                  colSpan={totalCols}
                  style={{ textAlign: 'center', color: '#a8a29e', padding: '28px', fontStyle: 'italic' }}
                >
                  لا توجد صفوف بعد — اضغط «📅 إضافة أسبوع» للبدء.
                </td>
              </tr>
            )}

            {keysToRender.map((weekKey) => {
              const weekRows = weekMap.get(weekKey) || [];
              const relLabel = relativeWeekLabel(weekKey);

              return (
                <Fragment key={`week-group-${weekKey}`}>
                  <tr className="week-separator-row">
                    <td colSpan={totalCols} data-label="الأسبوع">
                      <div className="week-header-content">
                        <div className="week-title-wrap">
                          <span className={`week-badge${relLabel === 'هذا الأسبوع' ? ' week-badge-now' : ''}`}>
                            {weekKey === 'unassigned' ? 'بدون تاريخ' : relLabel || 'أسبوع'}
                          </span>
                          <span className="week-range-text">
                            {weekKey !== 'unassigned' ? formatWeekRange(weekKey) : 'جلسات غير محددة التاريخ'}
                          </span>
                        </div>
                        <div className="week-actions no-print">
                          {weekKey !== 'unassigned' && effectiveWeekKey === 'all' && (
                            <button
                              type="button"
                              className="btn-week-print-session"
                              onClick={() => onPrintWeeks([weekKey])}
                              title="طباعة هذا الأسبوع فقط بصيغة PDF"
                            >
                              🖨 طباعة هذا الأسبوع
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-week-delete"
                            onClick={() => onDeleteWeek(weekKey)}
                            title="حذف كل جلسات هذا الأسبوع"
                          >
                            🗑 حذف الأسبوع
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {renderWeekBody(weekKey, weekRows)}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="add-next-week-bar no-print">
        <button type="button" className="btn-add-next-week-large" onClick={onOpenAddWeekModal}>
          <span className="plus-icon">＋</span>
          <span>إضافة أسبوع جديد</span>
          <span className="next-week-hint">التالي: {nextWeekLabel}</span>
        </button>
      </div>
    </div>
  );
}
