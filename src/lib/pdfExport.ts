import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';

/**
 * Builds the PDF inside the browser instead of going through the print dialog, so the
 * result is the same everywhere: some PDF printers (e.g. "Microsoft Print to PDF") drop
 * clickable links and can mirror right-to-left pages.
 *
 * Each week is captured as an image of its print layout (so Arabic/RTL renders exactly as
 * on screen) and placed on landscape A4 pages; every link gets a clickable area on top.
 */

const PAGE_W = 297; // mm, A4 landscape
const PAGE_H = 210;
const MARGIN = 8;
/** Layout width (CSS px) used while capturing — roughly the printable width of A4 landscape. */
const LAYOUT_WIDTH = 1062;
const PIXEL_RATIO = 2;

const EXPORT_STYLE_ID = 'pdf-export-style';

/**
 * Applies the @media print rules to the screen so the capture matches the printed layout,
 * and switches off the phone-width rules so a PDF made on a phone looks the same as on a PC.
 */
function enterExportLayout(): () => void {
  let css = '';
  const disabled: { media: MediaList; original: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet (Google Fonts) — nothing print-specific in it
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule)) continue;
      const text = rule.media.mediaText;
      if (text.includes('print')) {
        for (const inner of Array.from(rule.cssRules)) css += `${inner.cssText}\n`;
      } else if (text.includes('width')) {
        // Matches both "(max-width: 768px)" and the "(width<=768px)" form the production build emits.
        disabled.push({ media: rule.media, original: text });
        rule.media.mediaText = 'not all';
      }
    }
  }
  css += `
    html, body { width: ${LAYOUT_WIDTH}px !important; min-width: ${LAYOUT_WIDTH}px !important; overflow-x: hidden !important; }
    #root { width: ${LAYOUT_WIDTH}px !important; padding: 0 !important; }
  `;
  const style = document.createElement('style');
  style.id = EXPORT_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
  return () => {
    style.remove();
    for (const { media, original } of disabled) media.mediaText = original;
  };
}

/** Waits for layout to settle. Falls back to a timer because rAF pauses in background tabs. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 60);
    requestAnimationFrame(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });

interface LinkBox {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function collectLinks(root: HTMLElement): LinkBox[] {
  const origin = root.getBoundingClientRect();
  const boxes: LinkBox[] = [];
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    // A link can wrap onto several lines; give each line its own clickable area.
    for (const r of Array.from(a.getClientRects())) {
      if (r.width === 0 || r.height === 0) continue;
      boxes.push({ url: a.href, x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
    }
  });
  return boxes;
}

/** Y positions (CSS px from the top of root) where a page may be cut without slicing through a row. */
function collectCutPoints(root: HTMLElement): number[] {
  const top = root.getBoundingClientRect().top;
  const cuts = Array.from(root.querySelectorAll('tbody tr'))
    .map((tr) => tr.getBoundingClientRect())
    .filter((r) => r.height > 0)
    .map((r) => r.bottom - top);
  return Array.from(new Set(cuts)).sort((a, b) => a - b);
}

interface ExportOptions {
  /** The element to capture (the app root). */
  root: HTMLElement;
  weekKeys: string[];
  /** Renders only the given week and resolves once React has committed it. */
  showWeek: (weekKey: string) => Promise<void>;
  filename: string;
}

export async function exportWeeksPdf({ root, weekKeys, showWeek, filename }: ExportOptions): Promise<void> {
  const leaveExportLayout = enterExportLayout();
  try {
    await document.fonts?.ready;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const contentW = PAGE_W - MARGIN * 2;
    const contentH = PAGE_H - MARGIN * 2;
    let firstPage = true;

    for (const weekKey of weekKeys) {
      await showWeek(weekKey);
      await nextFrame();
      await nextFrame();

      const rootW = root.scrollWidth;
      const rootH = root.scrollHeight;
      const links = collectLinks(root);
      const cuts = collectCutPoints(root);

      const canvas = await toCanvas(root, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: '#ffffff',
        width: rootW,
        height: rootH,
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains('pdf-busy')),
      });

      const mmPerPx = contentW / rootW;
      const pageHeightPx = contentH / mmPerPx;

      // Split tall weeks over several pages, cutting only between table rows.
      let sliceTop = 0;
      while (sliceTop < rootH - 1) {
        let sliceBottom = rootH;
        if (rootH - sliceTop > pageHeightPx) {
          const fitting = cuts.filter((c) => c > sliceTop && c - sliceTop <= pageHeightPx);
          sliceBottom = fitting.length > 0 ? fitting[fitting.length - 1] : sliceTop + pageHeightPx;
        }
        const sliceH = sliceBottom - sliceTop;

        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.ceil(sliceH * PIXEL_RATIO);
        const ctx = slice.getContext('2d');
        if (!ctx) throw new Error('canvas unavailable');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, -sliceTop * PIXEL_RATIO);

        if (!firstPage) pdf.addPage();
        firstPage = false;
        // High-quality JPEG keeps text crisp at 2x while staying far smaller than PNG.
        pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', MARGIN, MARGIN, contentW, sliceH * mmPerPx);

        for (const link of links) {
          const mid = link.y + link.h / 2;
          if (mid < sliceTop || mid >= sliceBottom) continue;
          pdf.link(
            MARGIN + link.x * mmPerPx,
            MARGIN + (link.y - sliceTop) * mmPerPx,
            link.w * mmPerPx,
            link.h * mmPerPx,
            { url: link.url },
          );
        }
        sliceTop = sliceBottom;
      }
    }

    pdf.save(filename);
  } finally {
    leaveExportLayout();
  }
}
