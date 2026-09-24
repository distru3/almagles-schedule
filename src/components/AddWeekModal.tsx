import { useState } from 'react';
import { getSaturdayOfWeek, formatWeekRange, toISODate, isValidISODate, formatGregorianShort, formatHijri } from '../lib/dates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddWeek: (saturdayDate: Date) => void;
  suggestedSaturday: Date;
  existingWeekKeys: string[];
  onSelectExistingWeek?: (weekKey: string) => void;
}

export default function AddWeekModal({
  isOpen,
  onClose,
  onAddWeek,
  suggestedSaturday,
  existingWeekKeys,
  onSelectExistingWeek,
}: Props) {
  // Default custom date to 2 weeks ahead or suggested
  const [customDate, setCustomDate] = useState<string>('');

  if (!isOpen) return null;

  const suggestedLabel = formatWeekRange(suggestedSaturday);

  const parsedCustomSat = isValidISODate(customDate) ? getSaturdayOfWeek(customDate) : null;
  const parsedCustomIso = parsedCustomSat ? toISODate(parsedCustomSat) : '';
  const isAlreadyExists = parsedCustomIso ? existingWeekKeys.includes(parsedCustomIso) : false;

  const handleAddSuggested = () => {
    onAddWeek(suggestedSaturday);
    onClose();
  };

  const handleAddCustom = () => {
    if (!parsedCustomSat) return;
    onAddWeek(parsedCustomSat);
    onClose();
  };

  const handleJumpToExisting = () => {
    if (parsedCustomIso && onSelectExistingWeek) {
      onSelectExistingWeek(parsedCustomIso);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div className="modal-card modal-card-week" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 إضافة أسبوع إلى الجدول</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Quick Option 1: Next Sequential Week */}
          <div className="week-option-card">
            <div className="week-option-badge">الخيار 1: متسلسل</div>
            <div className="week-option-title">إضافة الأسبوع التالي مباشرة</div>
            <div className="week-option-range">{suggestedLabel}</div>
            <button
              type="button"
              className="btn-modal-action btn-add-suggested"
              onClick={handleAddSuggested}
            >
              📅 إضافة هذا الأسبوع التالي
            </button>
          </div>

          <div className="modal-divider">
            <span>أو اختر أي أسبوع تريده (حتى لو كان بعيداً)</span>
          </div>

          {/* Option 2: Custom Date / Far Ahead */}
          <div className="week-option-card">
            <div className="week-option-badge">الخيار 2: مخصص</div>
            <div className="week-option-title">اختيار تاريخ محدد لأسبوع قادم أو بعيد</div>
            <div className="modal-field">
              <span>حدد أي يوم داخل الأسبوع المطلوب:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                autoFocus
              />
            </div>

            {parsedCustomSat && (
              <div className="week-preview-box">
                <div className="preview-heading">الأسبوع المحسوب (يبدأ بالسبت وينتهي بالجمعة):</div>
                <div className="preview-range">
                  السبت {formatGregorianShort(parsedCustomIso)} — الجمعة {formatGregorianShort(toISODate(new Date(parsedCustomSat.getTime() + 6 * 86400000)))} م
                </div>
                <div className="preview-hijri">
                  {formatHijri(parsedCustomIso)}
                </div>

                {isAlreadyExists && (
                  <div className="week-exists-alert">
                    <span>⚠️ هذا الأسبوع موجود بالفعل في الجدول.</span>
                    {onSelectExistingWeek && (
                      <button
                        type="button"
                        className="btn-jump-existing"
                        onClick={handleJumpToExisting}
                      >
                        الانتقال إليه وعرضه
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn-modal-action btn-add-custom"
              disabled={!parsedCustomSat}
              onClick={handleAddCustom}
            >
              ➕ تجهيز وإضافة هذا الأسبوع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
