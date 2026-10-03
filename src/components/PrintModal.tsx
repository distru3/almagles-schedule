import { useState } from 'react';
import { useEscape } from '../lib/useEscape';
import { formatWeekShort, relativeWeekLabel } from '../lib/dates';

interface Props {
  isOpen: boolean;
  weekKeys: string[];
  defaultSelected: string[];
  onPrint: (weekKeys: string[]) => void;
  onDownload: (weekKeys: string[]) => void;
  onClose: () => void;
}

export default function PrintModal(props: Props) {
  if (!props.isOpen) return null;
  return <PrintDialog {...props} />;
}

function weekLabel(k: string): string {
  if (k === 'unassigned') return 'جلسات بدون تاريخ محدد';
  const rel = relativeWeekLabel(k);
  return rel ? `${formatWeekShort(k)} (${rel})` : formatWeekShort(k);
}

function PrintDialog({ weekKeys, defaultSelected, onPrint, onDownload, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  useEscape(onClose);

  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Keep chronological order regardless of click order.
  const chosen = weekKeys.filter((k) => selected.has(k));

  return (
    <div className="modal-backdrop no-print" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⬇ تنزيل PDF / طباعة</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="print-pick-head">
            <span>اختر الأسابيع (كل أسبوع في صفحة مستقلة):</span>
            <div className="print-pick-quick">
              <button type="button" onClick={() => setSelected(new Set(weekKeys))}>
                الكل
              </button>
              <button type="button" onClick={() => setSelected(new Set())}>
                لا شيء
              </button>
            </div>
          </div>
          <div className="print-week-list">
            {weekKeys.map((k) => (
              <label key={k} className={`print-week-item${selected.has(k) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} />
                <span>{weekLabel(k)}</span>
              </label>
            ))}
          </div>
          <p className="print-hint">
            <b>«تنزيل PDF»</b> يُنشئ الملف مباشرة بنفس الشكل على أي جهاز، والروابط فيه قابلة للنقر. استخدم «طباعة» للطباعة
            على ورق. الأيام الفارغة لا تظهر.
          </p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn-primary"
            disabled={chosen.length === 0}
            onClick={() => onDownload(chosen)}
          >
            ⬇ تنزيل PDF {chosen.length > 1 ? `(${chosen.length} أسابيع)` : ''}
          </button>
          <button
            type="button"
            className="modal-btn-secondary"
            disabled={chosen.length === 0}
            onClick={() => onPrint(chosen)}
          >
            🖨 طباعة
          </button>
          <button type="button" className="modal-btn-cancel" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
