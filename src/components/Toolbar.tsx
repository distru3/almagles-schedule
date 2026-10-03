import { useEffect, useRef, useState } from 'react';

export type SyncStatus = 'connecting' | 'live' | 'saving' | 'local';

interface Props {
  syncStatus: SyncStatus;
  onAddWeek: () => void;
  onOpenAddColumn: () => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  onTemplate: () => void;
  onPrint: () => void;
  onRemoveBlank: () => void;
  onClear: () => void;
}

const SYNC_LABELS: Record<SyncStatus, { text: string; title: string }> = {
  connecting: { text: 'جارٍ الاتصال…', title: 'جارٍ الاتصال بقاعدة البيانات للمزامنة' },
  live: { text: 'محفوظ ومتزامن', title: 'كل التعديلات محفوظة ويراها الجميع مباشرة' },
  saving: { text: 'جارٍ الحفظ…', title: 'يتم حفظ آخر التعديلات' },
  local: { text: 'وضع محلي', title: 'بدون مزامنة — التعديلات تُحفظ في هذا المتصفح فقط' },
};

export default function Toolbar({
  syncStatus,
  onAddWeek,
  onOpenAddColumn,
  onExportCsv,
  onImportCsv,
  onTemplate,
  onPrint,
  onRemoveBlank,
  onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const runAndClose = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const sync = SYNC_LABELS[syncStatus];

  return (
    <div className="toolbar no-print">
      <div className="toolbar-main">
        <button className="btn-add-week" onClick={onAddWeek} title="تجهيز أسبوع كامل (السبت - الجمعة) بتواريخه الحقيقية">
          📅 إضافة أسبوع
        </button>
        <button className="btn-print" onClick={onPrint} title="تنزيل الجدول PDF أو طباعته">
          ⬇ PDF / طباعة
        </button>
        <button className="btn-column" onClick={onOpenAddColumn} title="إضافة عمود مخصص للجدول">
          ➕ عمود
        </button>

        <div className="toolbar-menu" ref={menuRef}>
          <button
            className="btn-more"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ⋯ المزيد
          </button>
          {menuOpen && (
            <div className="menu-pop" role="menu">
              <button role="menuitem" onClick={runAndClose(onExportCsv)}>
                ⬇ تصدير CSV
              </button>
              <button role="menuitem" onClick={() => {
                  setMenuOpen(false);
                  fileRef.current?.click();
                }}>
                ⬆ استيراد CSV
              </button>
              <button role="menuitem" onClick={runAndClose(onTemplate)}>
                📄 تنزيل قالب CSV
              </button>
              <div className="menu-sep" />
              <button role="menuitem" onClick={runAndClose(onRemoveBlank)}>
                🧹 حذف الجلسات الفارغة
              </button>
              <button role="menuitem" className="menu-danger" onClick={runAndClose(onClear)}>
                🗑 مسح الجدول بالكامل
              </button>
            </div>
          )}
        </div>
      </div>

      <span className={`sync-pill sync-${syncStatus}`} title={sync.title}>
        <span className="sync-dot" />
        {sync.text}
      </span>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportCsv(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
