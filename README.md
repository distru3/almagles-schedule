# رجال الأمة — منشئ الجدول الأسبوعي

تطبيق واجهة أمامية فقط (Front-end) لتجهيز **الجدول الأسبوعي** وإخراجه بطريقة جميلة ومُحاياة لألوان المنتدى — مع إمكانية التصدير إلى PDF أو CSV.

مبني باستخدام **React + TypeScript + Vite** مع مزامنة مباشرة عبر **Firebase Realtime Database** — يمكن نشره مجانًا على Vercel.

## المزايا

- **إنشاء الجدول من الموقع مباشرة:** أضِف صفوفًا، واكتب في الخانات (التاريخ، الوقت، القسم، العنوان، ملاحظات، الرابط)، واحذف صفًا في أي وقت.
- **مزامنة مباشرة:** تُحفظ التعديلات في Firebase ويراها كل من يفتح الموقع فورًا (متزامن مباشرة ✓).
- **تواريخ هجرية:** تُعرض التواريخ بالهجري مع الميلادي في كل مكان، بالعربية.
- **تصدير PDF:** زر **«طباعة / حفظ PDF»** يُنتج نسخة أنيقة بتصميم الموقع (A4 عريض).
- **تصدير / استيراد CSV:** نزّل الجدول لتعديله في Excel أو Google Sheets، ثم أعد تحميله. يدعم أيضًا تنزيل **قالب جاهز**.
- **تعليمات داخلية:** تظهر في الصفحة طريقة تنسيق ملف CSV.

## التطوير محليًا

```bash
npm install
npm run dev      # تشغيل محلي (http://localhost:5173)
npm run build    # بناء نسخة النشر في dist/
```

## النشر على Vercel

1. ارفع هذا المستودع إلى GitHub.
2. من لوحة Vercel: **Add New Project** ← استورد المستودع.
3. أضف متغيرات البيئة التالية في **Settings → Environment Variables** (وهي متغيّرات عامة تُقرأ عند البناء):
   ```
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_DATABASE_URL
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   ```
   > نفس القيم الموجودة محليًا في ملف `.env.local` (لا يُرفَع إلى Git). بدونها يعمل الموقع بوضع محلي دون مزامنة.
4. الإطار: تُكتشف تلقائيًا (Vite)، أمر البناء `npm run build` والمخرجات `dist`.
5. اضغط **Deploy** — سيظهر موقعك على رابط مجاني مثل `almagles-schedule.vercel.app`.

## إعداد Firebase (المزامنة)

- أنشئ مشروعًا في [console.firebase.google.com](https://console.firebase.google.com) وفعّل **Realtime Database** (أي منطقة).
- من **Project settings → Your apps → Web** انسخ القيم وضَعها في `.env.local` (أو في Vercel) بالمتغيرات أعلاه بدءًا بـ `VITE_FIREBASE_`.
- اذهب إلى **Realtime Database → Rules** وضَع القاعدة لفتح القراءة والكتابة:
  ```json
  { "rules": { ".read": true, ".write": true } }
  ```
  > هذا يجعل أي زائر قادرًا على تعديل الجدول (مشاركة مفتوحة).

## تنسيق ملف CSV

رأس الأعمدة يجب أن يكون:

```
date,time,section,title,notes,link
```

- `date` — التاريخ `YYYY-MM-DD`
- `time` — الوقت أو الميعاد (نص حر)
- `section` — القسم
- `title` — عنوان الجلسة
- `notes` — ملاحظات أو فوائد
- `link` — رابط اختياري (ضع الرابط فقط)

> يمكنك ترك الأعمدَة فارغة حسب الحاجة. لا تُعدّل رأس الأعمدة.
