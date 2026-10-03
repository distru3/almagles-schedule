import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { ScheduleRow, CustomColumn } from './types';
import { emptyRow, parseCsv, downloadCsv, downloadTemplate } from './lib/csv';
import { loadRows, saveRows, loadColumns, saveColumns, loadWeeks, saveWeeks } from './lib/storage';
import { collectWeekKeys, copyWeekRows, findCopySource, isBlankRow } from './lib/rows';
import { isFirebaseConfigured, database } from './lib/firebase';
import { fetchScheduleOnce, pushSchedule, listenToSchedule } from './lib/sync';
import { getSaturdayOfWeek, addDays, toISODate, formatWeekShort, getWeekKey } from './lib/dates';
import Masthead from './components/Masthead';
import HelpInstructions from './components/HelpInstructions';
import Toolbar, { type SyncStatus } from './components/Toolbar';
import Toast, { type ToastMessage } from './components/Toast';
import ScheduleTable from './components/ScheduleTable';
import LinkModal from './components/LinkModal';
import AddColumnModal from './components/AddColumnModal';
import AddWeekModal from './components/AddWeekModal';
import PrintModal from './components/PrintModal';

/** Arabic count of sessions with the right noun form, e.g. "جلستان" / "3 جلسات" / "11 جلسة". */
function sessionsCount(n: number): string {
  if (n === 1) return 'جلسة واحدة';
  if (n === 2) return 'جلستان';
  return n <= 10 ? `${n} جلسات` : `${n} جلسة`;
}

/** A brand-new schedule starts with this week and next week, with empty days. */
function createInitialWeeks(): string[] {
  const thisSaturday = getSaturdayOfWeek(new Date());
  return [toISODate(thisSaturday), toISODate(addDays(thisSaturday, 7))];
}

export default function App() {
  const [rows, setRows] = useState<ScheduleRow[]>(() => loadRows());
  const [weeks, setWeeks] = useState<string[]>(() => {
    const loaded = loadWeeks();
    return loaded.length > 0 || loadRows().length > 0 ? loaded : createInitialWeeks();
  });

  const [columns, setColumns] = useState<CustomColumn[]>(() => loadColumns());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isFirebaseConfigured && database ? 'connecting' : 'local',
  );

  const [activeLinkRowId, setActiveLinkRowId] = useState<string | null>(null);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printWeekKeys, setPrintWeekKeys] = useState<string[] | null>(null);
  const [exportWeekKeys, setExportWeekKeys] = useState<string[] | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
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

        setRows(remote.rows);
        // An empty shared schedule starts with this week and next week.
        setWeeks(remote.rows.length === 0 && remote.weeks.length === 0 ? createInitialWeeks() : remote.weeks);
        setColumns(remote.columns);
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
      setWeeks(remote.rows.length === 0 && remote.weeks.length === 0 ? createInitialWeeks() : remote.weeks);
      setColumns(remote.columns);
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
    saveWeeks(weeks);
  }, [rows, columns, weeks]);

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
      const ok = await pushSchedule(rows, columns, weeks, ts);
      setSyncStatus(ok !== null ? 'live' : 'local');
    }, 700);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [rows, columns, weeks]);

  // Print the chosen weeks: render them, print, then go back to the normal view.
  useEffect(() => {
    if (!printWeekKeys) return;
    const reset = () => setPrintWeekKeys(null);
    window.addEventListener('afterprint', reset);
    const timer = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', reset);
    };
  }, [printWeekKeys]);

  const dismissToast = useCallback(() => setToast(null), []);

  const flash = (text: string, kind: 'ok' | 'err' = 'ok', undo?: () => void) => {
    setToast({ id: Date.now(), text, kind, undo });
  };

  /** Restores the whole table (rows + columns) as it was before a bulk change. */
  const snapshotUndo = () => {
    const prevRows = rows;
    const prevColumns = columns;
    const prevWeeks = weeks;
    return () => {
      setRows(prevRows);
      setColumns(prevColumns);
      setWeeks(prevWeeks);
    };
  };

  const update = (id: string, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /** Makes sure a week stays listed even after its last session is removed. */
  const keepWeek = (weekKey: string) => {
    if (weekKey === 'unassigned') return;
    setWeeks((prev) => (prev.includes(weekKey) ? prev : [...prev, weekKey]));
  };

  const remove = (id: string) => {
    const index = rows.findIndex((r) => r.id === id);
    if (index === -1) return;
    const removed = rows[index];
    keepWeek(getWeekKey(removed.date));
    setRows((prev) => prev.filter((r) => r.id !== id));
    flash('تم حذف الجلسة', 'ok', () => {
      setRows((prev) => {
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
    });
  };

  const weekKeys = collectWeekKeys(rows, weeks);
  const datedWeekKeys = weekKeys.filter((k) => k !== 'unassigned');

  const nextSaturdayDate =
    datedWeekKeys.length > 0
      ? addDays(getSaturdayOfWeek(datedWeekKeys[datedWeekKeys.length - 1]), 7)
      : getSaturdayOfWeek(new Date());
  const nextWeekLabel = formatWeekShort(nextSaturdayDate);

  const handleAddWeek = (saturdayDate: Date) => {
    const weekKey = toISODate(saturdayDate);
    keepWeek(weekKey);
    setSelectedWeekKey(weekKey);
    flash(`تمت إضافة أسبوع ${formatWeekShort(saturdayDate)}`);
  };

  const addSession = (date: string) => {
    setRows((prev) => [...prev, emptyRow(date)]);
  };

  const copyWeek = (fromKey: string, toKey: string) => {
    const copies = copyWeekRows(rows, fromKey, toKey);
    if (copies.length === 0) return;
    const copiedIds = new Set(copies.map((r) => r.id));
    setRows((prev) => [...prev, ...copies]);
    flash(`تم نسخ ${sessionsCount(copies.length)} من أسبوع ${formatWeekShort(fromKey)}`, 'ok', () =>
      setRows((prev) => prev.filter((r) => !copiedIds.has(r.id))),
    );
  };

  const deleteWeek = (weekKey: string) => {
    const removed = rows.filter((r) => getWeekKey(r.date) === weekKey);
    const removedIds = new Set(removed.map((r) => r.id));
    const hadWeek = weeks.includes(weekKey);
    setRows((prev) => prev.filter((r) => !removedIds.has(r.id)));
    setWeeks((prev) => prev.filter((w) => w !== weekKey));
    const label = weekKey === 'unassigned' ? 'الجلسات غير محددة التاريخ' : `أسبوع ${formatWeekShort(weekKey)}`;
    flash(`تم حذف ${label}`, 'ok', () => {
      setRows((prev) => [...prev, ...removed]);
      if (hadWeek) keepWeek(weekKey);
    });
  };

  const removeBlankSessions = () => {
    const blank = rows.filter(isBlankRow);
    if (blank.length === 0) {
      flash('لا توجد جلسات فارغة');
      return;
    }
    const undo = snapshotUndo();
    // Keep their weeks so emptied weeks don't disappear.
    const blankWeeks = blank.map((r) => getWeekKey(r.date)).filter((k) => k !== 'unassigned');
    setWeeks((prev) => Array.from(new Set([...prev, ...blankWeeks])));
    setRows((prev) => prev.filter((r) => !isBlankRow(r)));
    flash(`تم حذف الجلسات الفارغة (${sessionsCount(blank.length)})`, 'ok', undo);
  };

  const addColumn = (label: string) => {
    const id = `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newCol: CustomColumn = { id, label };
    setColumns((prev) => [...prev, newCol]);
    flash(`تمت إضافة عمود «${label}»`);
  };

  const deleteColumn = (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    const undo = snapshotUndo();
    setColumns((prev) => prev.filter((c) => c.id !== colId));
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
      setWeeks([]);
      setColumns(detectedColumns);

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
    setWeeks([]);
    flash('تم مسح الجدول', 'ok', undo);
  };

  const downloadPdf = async (keys: string[]) => {
    if (pdfBusy || keys.length === 0) return;
    setPdfBusy(true);
    try {
      // Loaded on demand so the PDF libraries don't slow down the first page load.
      const { exportWeeksPdf } = await import('./lib/pdfExport');
      const filename =
        keys.length === 1 && keys[0] !== 'unassigned'
          ? `الجدول الأسبوعي - ${formatWeekShort(keys[0])}.pdf`
          : 'الجدول الأسبوعي.pdf';
      await exportWeeksPdf({
        root: document.getElementById('root')!,
        weekKeys: keys,
        showWeek: async (k) => {
          flushSync(() => setExportWeekKeys([k]));
        },
        filename,
      });
      flash('تم تنزيل ملف PDF');
    } catch (err) {
      console.error('[pdf] export failed', err);
      flash('تعذّر إنشاء ملف PDF — جرّب زر «طباعة» بدلاً من ذلك', 'err');
    } finally {
      setExportWeekKeys(null);
      setPdfBusy(false);
    }
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
        onPrint={() => setIsPrintOpen(true)}
        onRemoveBlank={removeBlankSessions}
        onClear={clear}
      />

      <ScheduleTable
        rows={rows}
        columns={columns}
        weekKeys={weekKeys}
        printWeekKeys={exportWeekKeys ?? printWeekKeys}
        nextWeekLabel={nextWeekLabel}
        selectedWeekKey={selectedWeekKey}
        onSelectWeekKey={(k) => {
          setPrintWeekKeys(null);
          setSelectedWeekKey(k);
        }}
        onUpdate={update}
        onDelete={remove}
        onSetLink={(id) => setActiveLinkRowId(id)}
        onDeleteColumn={deleteColumn}
        onAddSession={addSession}
        onDeleteWeek={deleteWeek}
        copySourceFor={(k) => findCopySource(rows, k)}
        onCopyWeek={copyWeek}
        onDownloadPdf={downloadPdf}
        onOpenAddWeekModal={() => setIsAddWeekOpen(true)}
      />

      <Toast toast={toast} onDismiss={dismissToast} />

      {pdfBusy && (
        <div className="pdf-busy" role="status" aria-live="polite">
          <div className="pdf-busy-card">
            <span className="pdf-spinner" />
            جارٍ تجهيز ملف PDF…
          </div>
        </div>
      )}

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

      <PrintModal
        isOpen={isPrintOpen}
        weekKeys={weekKeys}
        defaultSelected={weekKeys.includes(selectedWeekKey) ? [selectedWeekKey] : weekKeys}
        onPrint={(keys) => {
          setIsPrintOpen(false);
          setPrintWeekKeys(keys);
        }}
        onDownload={(keys) => {
          setIsPrintOpen(false);
          void downloadPdf(keys);
        }}
        onClose={() => setIsPrintOpen(false)}
      />

      <AddWeekModal
        isOpen={isAddWeekOpen}
        onClose={() => setIsAddWeekOpen(false)}
        onAddWeek={handleAddWeek}
        suggestedSaturday={nextSaturdayDate}
        existingWeekKeys={datedWeekKeys}
        onSelectExistingWeek={(k) => setSelectedWeekKey(k)}
      />
    </>
  );
}
