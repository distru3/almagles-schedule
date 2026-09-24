import { useState, useRef, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onAdd: (label: string) => void;
  onClose: () => void;
}

export default function AddColumnModal({ isOpen, onAdd, onClose }: Props) {
  if (!isOpen) return null;
  return <AddColumnDialog onAdd={onAdd} onClose={onClose} />;
}

function AddColumnDialog({ onAdd, onClose }: { onAdd: (label: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(label.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ إضافة عمود جديد للجدول</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-field">
              <span>اسم العمود</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="مثال: المحاضر، المكان، الحالة…"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="submit" className="modal-btn-primary">
              ➕ إضافة العمود
            </button>
            <button type="button" className="modal-btn-cancel" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
