import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduleRow, CustomColumn } from './types';
import { emptyRow, parseCsv, downloadCsv, downloadTemplate } from './lib/csv';
import { loadRows, saveRows, loadColumns, saveColumns } from './lib/storage';
import { isFirebaseConfigured, database } from './lib/firebase';
import { fetchScheduleOnce, pushSchedule, listenToSchedule } from './lib/sync';
import {
  getSaturdayOfWeek,
  generateWeekDates,
  addDays,
  isValidISODate,
  toISODate,
  formatWeekShort,
  getWeekKey,
} from './lib/dates';
import Masthead from './components/Masthead';
import HelpInstructions from './components/HelpInstructions';
import Toolbar, { type SyncStatus } from './components/Toolbar';
import Toast, { type ToastMessage } from './components/Toast';
import ScheduleTable from './components/ScheduleTable';
import LinkModal from './components/LinkModal';
import AddColumnModal from './components/AddColumnModal';
import AddWeekModal from './components/AddWeekModal';

function createWeekRows(saturdayDate: Date): ScheduleRow[] {
  const dates = generateWeekDates(saturdayDate);
  return dates.map((d) => emptyRow(d));
}

function createInitialWeeks(): ScheduleRow[] {
  const thisSaturday = getSaturdayOfWeek(new Date());
  const nextSaturday = addDays(thisSaturday, 7);
  return [...createWeekRows(thisSaturday), ...createWeekRows(nextSaturday)];
}

export default function App() {
  const [rows, setRows] = useState<ScheduleRow[]>(() => {
    const loaded = loadRows();
    if (loaded.length > 0) return loaded;
    return createInitialWeeks();
  });

  const [columns, setColumns] = useState<CustomColumn[]>(() => loadColumns());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isFirebaseConfigured && database ? 'connecting' : 'local',
  );

  const [activeLinkRowId, setActiveLinkRowId] = useState<string | null>(null);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(() => {
    return toISODate(getSaturdayOfWeek(new Date()));
  });

  const skipPush = useRef(false);
  const remoteApplied = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const lastOwnTimestamp = useRef<number>(0);

  // Remote: first hydrate, then live subscribe.
  useEffect(() => {
    if (!isFirebaseConfigured || !database) return;
    let active = true;
    const syncStatusRef = { live: false };

    fetchScheduleOnce().then((remote) => {
      if (!active) return;
      if (remote !== null) {
        skipPush.current = true;
        remoteApplied.current = true;

        let nextRows = remote.rows;
        // If remote has no rows at all, bake in initial 2 weeks (current + next)
        if (nextRows.length === 0) {
          nextRows = createInitialWeeks();
        }
        setRows(nextRows);
        saveRows(nextRows);

        setColumns(remote.columns);
        saveColumns(remote.columns);
      } else {
        remoteApplied.current = true;
      }
      setSyncStatus('live');
    });

    const unsub = listenToSchedule((remote) => {
      if (!active) return;
      // Guard against echo loops: ignore our own writes
      if (remote.updatedAt && remote.updatedAt === lastOwnTimestamp.current) {
        return;
      }
      skipPush.current = true;
      remoteApplied.current = true;
      setRows(remote.rows);
      saveRows(remote.rows);
      setColumns(remote.columns);
      saveColumns(remote.columns);
      if (!syncStatusRef.live) {
        syncStatusRef.live = true;
        setSyncStatus('live');
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Keep the browser copy current so local mode (and the next page load) never loses edits.
  useEffect(() => {
    saveRows(rows);
    saveColumns(columns);
  }, [rows, columns]);

  // Debounced push to Firebase on local edits (both rows and custom columns)
  useEffect(() => {
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    if (!remoteApplied.current || !isFirebaseConfigured || !database) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSyncStatus('saving');
    debounceRef.current = window.setTimeout(async () => {
      const ts = Date.now();
      lastOwnTimestamp.current = ts;
      const ok = await pushSchedule(rows, columns, ts);
      setSyncStatus(ok !== null ? 'live' : 'local');
    }, 700);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [rows, columns]);

  const dismissToast = useCallback(() => setToast(null), []);

  const flash = (text: string, kind: 'ok' | 'err' = 'ok', undo?: () => void) => {
    setToast({ id: Date.now(), text, kind, undo });
  };

  /** Restores the whole table (rows + columns) as it was before a bulk change. */
  const snapshotUndo = () => {
    const prevRows = rows;
    const prevColumns = columns;
    return () => {
      setRows(prevRows);
      setColumns(prevColumns);
    };
  };

  const update = (id: string, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const removed = rows[index];
    setRows((prev) => prev.filter((r) => r.id !== id));
    flash('تم حذف الجلسة', 'ok', () => {
      setRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
    });
  };

  const computeNextSaturday = (): Date => {
    let latestSaturday: Date | null = null;
    for (const r of rows) {
      if (isValidISODate(r.date)) {
        const sat = getSaturdayOfWeek(r.date);
        if (!latestSaturday || sat.getTime() > latestSaturday.getTime()) {
          latestSaturday = sat;
        }
      }
    }
    return latestSaturday ? addDays(latestSaturday, 7) : getSaturdayOfWeek(new Date());
  };

  const nextSaturdayDate = computeNextSaturday();
  const nextWeekLabel = formatWeekShort(nextSaturdayDate);

  const existingWeekKeys = Array.from(
    new Set(
      rows
        .filter((r) => isValidISODate(r.date))
        .map((r) => toISODate(getSaturdayOfWeek(r.date))),
    ),
  );

  const handleAddWeek = (saturdayDate: Date) => {
    const newWeekRows = createWeekRows(saturdayDate);
    const weekKey = toISODate(saturdayDate);
    setRows((prev) => [...prev, ...newWeekRows]);
    setSelectedWeekKey(weekKey);
    flash(`تمت إضافة أسبوع ${formatWeekShort(saturdayDate)}`);
  };

  const addSession = (date: string) => {
    setRows((prev) => [...prev, emptyRow(date)]);
  };

  const deleteWeek = (weekKey: string) => {
    const removed = rows.filter((r) => getWeekKey(r.date) === weekKey);
    const removedIds = new Set(removed.map((r) => r.id));
    setRows((prev) => prev.filter((r) => !removedIds.has(r.id)));
    const label = weekKey === 'unassigned' ? 'الجلسات غير محددة التاريخ' : `أسبوع ${formatWeekShort(weekKey)}`;
    flash(`تم حذف ${label}`, 'ok', () => setRows((prev) => [...prev, ...removed]));
  };

  const addColumn = (label: string) => {
    const id = `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newCol: CustomColumn = { id, label };
    setColumns((prev) => {
      const updated = [...prev, newCol];
      saveColumns(updated);
      return updated;
    });
    flash(`تمت إضافة عمود «${label}»`);
  };

  const deleteColumn = (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    const undo = snapshotUndo();
    setColumns((prev) => {
      const updated = prev.filter((c) => c.id !== colId);
      saveColumns(updated);
      return updated;
    });
    setRows((prev) =>
      prev.map((r) => {
        if (!r.customValues || !r.customValues[colId]) return r;
        const next = { ...r.customValues };
        delete next[colId];
        return { ...r, customValues: next };
      }),
    );
    flash(`تم حذف عمود «${col?.label || ''}»`, 'ok', undo);
  };

  const exportCsvFile = () => {
    if (rows.length === 0) {
      flash('لا توجد صفوف للتصدير', 'err');
      return;
    }
    downloadCsv(rows, 'الجدول_الأسبوعي.csv', columns);
    flash('تم تنزيل ملف CSV');
  };

  const template = () => {
    downloadTemplate(columns);
    flash('تم تنزيل قالب CSV');
  };

  const importCsvFile = async (file: File) => {
    const text = await file.text();
    try {
      const { rows: parsed, skipped, detectedColumns } = parseCsv(text, columns);
      if (!window.confirm('سيتم استبدال الجدول الحالي بالمحتوى المستورد. متابعة؟')) return;
      const undo = snapshotUndo();

      setRows(parsed);
      saveRows(parsed);

      setColumns(detectedColumns);
      saveColumns(detectedColumns);

      if (skipped.length) {
        flash(`تم الاستيراد — تم تخطي ${skipped.length} صف (أرقام: ${skipped.join(', ')})`, 'err', undo);
      } else {
        flash('تم استيراد الجدول بنجاح', 'ok', undo);
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'تعذّر استيراد الملف', 'err');
    }
  };

  const clear = () => {
    if (!window.confirm('سيتم مسح كل صفوف الجدول لجميع الزوار. هل أنت متأكد؟')) return;
    const undo = snapshotUndo();
    setRows([]);
    flash('تم مسح الجدول', 'ok', undo);
  };

  const activeLinkRow = rows.find((r) => r.id === activeLinkRowId);

  return (
    <>
      <Masthead />
      <HelpInstructions />

      {syncStatus === 'local' && (
        <div className="notice notice-warn no-print">
          وضع محلي — بدون مزامنة. التعديلات تُحفظ في هذا المتصفح فقط ولن يراها غيرك.
        </div>
      )}

      <Toolbar
        syncStatus={syncStatus}
        onAddWeek={() => setIsAddWeekOpen(true)}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
        onExportCsv={exportCsvFile}
        onImportCsv={importCsvFile}
        onTemplate={template}
        onPrint={() => window.print()}
        onClear={clear}
      />

      <ScheduleTable
        rows={rows}
        columns={columns}
        nextWeekLabel={nextWeekLabel}
        selectedWeekKey={selectedWeekKey}
        onSelectWeekKey={setSelectedWeekKey}
        onUpdate={update}
        onDelete={remove}
        onSetLink={(id) => setActiveLinkRowId(id)}
        onDeleteColumn={deleteColumn}
        onAddSession={addSession}
        onDeleteWeek={deleteWeek}
        onOpenAddWeekModal={() => setIsAddWeekOpen(true)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />

      <LinkModal
        isOpen={activeLinkRowId !== null}
        initialUrl={activeLinkRow?.linkUrl || ''}
        initialLabel={activeLinkRow?.linkLabel || ''}
        onSave={(url, label) => {
          if (activeLinkRowId) {
            update(activeLinkRowId, { linkUrl: url, linkLabel: label });
          }
          setActiveLinkRowId(null);
        }}
        onClose={() => setActiveLinkRowId(null)}
      />

      <AddColumnModal
        isOpen={isAddColumnOpen}
        onAdd={addColumn}
        onClose={() => setIsAddColumnOpen(false)}
      />

      <AddWeekModal
        isOpen={isAddWeekOpen}
        onClose={() => setIsAddWeekOpen(false)}
        onAddWeek={handleAddWeek}
        suggestedSaturday={nextSaturdayDate}
        existingWeekKeys={existingWeekKeys}
        onSelectExistingWeek={(k) => setSelectedWeekKey(k)}
      />
    </>
  );
}
