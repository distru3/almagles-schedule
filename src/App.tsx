import { useEffect, useRef, useState } from 'react';
import type { ScheduleRow } from './types';
import { emptyRow, parseCsv, downloadCsv, downloadTemplate } from './lib/csv';
import { loadRows, saveRows } from './lib/storage';
import { isFirebaseConfigured, database } from './lib/firebase';
import { fetchScheduleOnce, pushSchedule, listenToSchedule } from './lib/sync';
import Masthead from './components/Masthead';
import HelpInstructions from './components/HelpInstructions';
import Toolbar from './components/Toolbar';
import ScheduleTable from './components/ScheduleTable';

type SyncStatus = 'connecting' | 'live' | 'local';

export default function App() {
  const [rows, setRows] = useState<ScheduleRow[]>(() => loadRows());
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isFirebaseConfigured && database ? 'connecting' : 'local',
  );

  const skipPush = useRef(false);
  const remoteApplied = useRef(false);
  const debounceRef = useRef<number | null>(null);

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
        setRows(remote);
        saveRows(remote);
      } else {
        remoteApplied.current = true;
      }
      setSyncStatus('live');
    });

    const unsub = listenToSchedule((remote) => {
      if (!active) return;
      skipPush.current = true;
      remoteApplied.current = true;
      setRows(remote);
      saveRows(remote);
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

  // Debounced push to Firebase on local edits.
  useEffect(() => {
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    if (!remoteApplied.current || !isFirebaseConfigured || !database) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const ok = await pushSchedule(rows);
      setSyncStatus(ok ? 'live' : 'local');
    }, 700);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [rows]);

  const flash = (text: string, kind: 'ok' | 'err' = 'ok') => {
    setMessage({ text, kind });
    window.setTimeout(() => setMessage((m) => (m?.text === text ? null : m)), 3500);
  };

  const update = (id: string, patch: Partial<ScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    if (!window.confirm('هل تريد حذف هذا الصف؟')) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const setLink = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const url = window.prompt('ألصق الرابط هنا:', row.linkUrl || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      update(id, { linkUrl: '', linkLabel: '' });
      return;
    }
    const label = window.prompt('عنوان يظهر للرابط:', row.linkLabel || 'فتح الرابط');
    update(id, { linkUrl: url.trim(), linkLabel: label && label.trim() ? label.trim() : 'فتح الرابط' });
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      flash('لا توجد صفوف للتصدير', 'err');
      return;
    }
    downloadCsv(rows, 'الجدول_الأسبوعي.csv');
    flash('تم تنزيل ملف CSV');
  };

  const template = () => {
    downloadTemplate();
    flash('تم تنزيل قالب CSV');
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    try {
      const { rows: parsed, skipped } = parseCsv(text);
      if (!window.confirm('سيتم استبدال الجدول الحالي بالمحتوى المستورد. متابعة؟')) return;
      setRows(parsed);
      if (skipped.length) {
        flash(`تم الاستيراد — تم تخطي ${skipped.length} صف (أرقام: ${skipped.join(', ')})`, 'err');
      } else {
        flash('تم استيراد الجدول بنجاح');
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'تعذّر استيراد الملف', 'err');
    }
  };

  const clear = () => {
    if (!window.confirm('سيتم مسح كل صفوف الجدول لجميع الزوار. هل أنت متأكد؟')) return;
    setRows([]);
    flash('تم مسح الجدول');
  };

  return (
    <>
      <Masthead />
      <HelpInstructions />

      {syncStatus === 'local' && (
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto 14px',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
            color: 'var(--danger)',
            background: '#fdecea',
            border: '1px solid #f0c2bf',
          }}
          className="no-print"
        >
          وضع محلي — بدون مزامنة. التعديلات تُحفظ في هذا المتصفح فقط. تحقّق من إعدادات Firebase.
        </div>
      )}
      {syncStatus === 'connecting' && (
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto 14px',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
            color: '#6c6249',
            background: 'var(--parchment)',
            border: '1px solid var(--line)',
          }}
          className="no-print"
        >
          جارٍ الاتصال للتحقق من المزامنة…
        </div>
      )}

      {message && (
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto 14px',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
            color: message.kind === 'ok' ? '#0b6b3f' : 'var(--danger)',
            background: message.kind === 'ok' ? '#eaf7ef' : '#fdecea',
            border: `1px solid ${message.kind === 'ok' ? '#b7e2c4' : '#f0c2bf'}`,
          }}
          className="no-print"
        >
          {message.text}
        </div>
      )}

      <Toolbar
        onAddRow={addRow}
        onExportCsv={exportCsv}
        onImportCsv={importCsv}
        onTemplate={template}
        onPrint={() => window.print()}
        onClear={clear}
      />
      <ScheduleTable rows={rows} onUpdate={update} onDelete={remove} onSetLink={setLink} />
      <div className="row-count no-print">
        عدد صفوف الجدول: {rows.length}
        {syncStatus === 'live' && <span style={{ marginInlineStart: 12, color: '#0b6b3f' }}>· متزامن مباشرة ✓</span>}
      </div>
    </>
  );
}
