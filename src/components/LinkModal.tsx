import { useState, useEffect, useRef } from 'react';

interface Props {
  isOpen: boolean;
  initialUrl: string;
  initialLabel: string;
  onSave: (url: string, label: string) => void;
  onClose: () => void;
}

export default function LinkModal({ isOpen, initialUrl, initialLabel, onSave, onClose }: Props) {
  if (!isOpen) return null;
  return (
    <LinkModalDialog
      initialUrl={initialUrl}
      initialLabel={initialLabel}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

function LinkModalDialog({
  initialUrl,
  initialLabel,
  onSave,
  onClose,
}: {
  initialUrl: string;
  initialLabel: string;
  onSave: (url: string, label: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl || '');
  const [label, setLabel] = useState(initialLabel || '');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url.trim(), label.trim() || 'فتح الرابط');
  };

  const handleClear = () => {
    onSave('', '');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔗 إعداد الرابط</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-field">
              <span>رابط الجلسة (URL)</span>
              <input
                ref={urlRef}
                type="url"
                dir="ltr"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>

            <label className="modal-field">
              <span>النص الظاهر للرابط</span>
              <input
                type="text"
                placeholder="مثال: رابط البث / المادة العلمية"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="submit" className="modal-btn-primary">
              ✓ حفظ الرابط
            </button>
            {initialUrl && (
              <button type="button" className="modal-btn-danger" onClick={handleClear}>
                🗑 إزالة الرابط
              </button>
            )}
            <button type="button" className="modal-btn-cancel" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
