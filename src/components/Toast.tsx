import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'ok' | 'err';
  /** When set, the toast shows an "undo" button that runs this and closes the toast. */
  undo?: () => void;
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: Props) {
  // Hovering the toast pauses the countdown so the undo button can't vanish under the cursor.
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!toast || hovered) return;
    // Give people more time to reach the undo button.
    const timer = window.setTimeout(onDismiss, toast.undo ? 7000 : 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, hovered]);

  if (!toast) return null;

  return (
    <div key={toast.id} className={`toast toast-${toast.kind} no-print`} role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => {
            toast.undo?.();
            setHovered(false);
            onDismiss();
          }}
        >
          ↶ تراجع
        </button>
      )}
      <button type="button" className="toast-close" onClick={() => {
          setHovered(false);
          onDismiss();
        }}
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  );
}
