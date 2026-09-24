import { useRef } from 'react';

interface Props {
  onAddWeek: () => void;
  onAddRow: () => void;
  onOpenAddColumn: () => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  onTemplate: () => void;
  onPrint: () => void;
  onClear: () => void;
}

export default function Toolbar({
  onAddWeek,
  onAddRow,
  onOpenAddColumn,
  onExportCsv,
  onImportCsv,
  onTemplate,
  onPrint,
  onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="toolbar no-print">
      <button className="btn-add-week" onClick={onAddWeek} title="تجهيز أسبوع كامل (السبت - الجمعة) بتواريخه الحقيقية">
        📅 إضافة أسبوع
      </button>
      <button className="btn-add" onClick={onAddRow} title="إضافة صف/جلسة منفردة">
        ➕ إضافة صف
      </button>
      <button className="btn-column" onClick={onOpenAddColumn} title="إضافة عمود مخصص للجدول">
        ➕ إضافة عمود
      </button>
      <button className="btn-save" onClick={onExportCsv}>
        ⬇ تصدير CSV
      </button>
      <button className="btn-save" onClick={() => fileRef.current?.click()}>
        ⬆ استيراد CSV
      </button>
      <button className="btn-save" onClick={onTemplate}>
        ⬇ قالب CSV
      </button>
      <button className="btn-print" onClick={onPrint}>
        🖨 طباعة / حفظ PDF
      </button>
      <button className="btn-danger" onClick={onClear}>
        🗑 مسح الجدول
      </button>
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
