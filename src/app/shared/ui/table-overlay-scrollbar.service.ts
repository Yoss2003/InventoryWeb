import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

type Direction = 'vertical' | 'horizontal';

interface OverlayBar {
  track: HTMLDivElement;
  thumb: HTMLDivElement;
  direction: Direction;
  thumbLength: number;
  trackLength: number;
  maximum: number;
}

interface TableRecord {
  target: HTMLElement;
  table: HTMLTableElement;
  vertical: OverlayBar;
  horizontal: OverlayBar;
}

/**
 * Indicadores de scroll superpuestos y accesibles para las tablas.
 * No mueve ni envuelve elementos administrados por Angular.
 * Los scrolls reales siguen siendo nativos: rueda, tactil, trackpad y teclas.
 */
@Injectable({ providedIn: 'root' })
export class TableOverlayScrollbarService {
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly records = new Map<HTMLElement, TableRecord>();
  private mutation?: MutationObserver;
  private resizes?: ResizeObserver;
  private queued = false;
  private started = false;
  private nextId = 0;

  start(): void {
    if (this.started || !isPlatformBrowser(this.platformId)) return;
    this.started = true;

    this.resizes = new ResizeObserver(() => this.schedule());
    this.mutation = new MutationObserver(() => this.schedule());
    this.mutation.observe(this.doc.body, { childList: true, subtree: true });
    this.doc.addEventListener('scroll', this.onScroll, true);
    this.doc.defaultView?.addEventListener('resize', this.onScroll, { passive: true });
    this.schedule();
  }

  private readonly onScroll = (): void => this.schedule();

  private schedule(): void {
    if (this.queued) return;
    this.queued = true;
    this.doc.defaultView?.requestAnimationFrame(() => {
      this.queued = false;
      this.scan();
      for (const record of this.records.values()) this.render(record);
    });
  }

  private scan(): void {
    const candidates = this.doc.querySelectorAll<HTMLElement>(
      '.inv-core-table-wrap, .supplier-table-viewport, .parameter-table-viewport, ' +
      '.table-wrapper, .companies-table, .recovery-table, .history-rates-scroll, ' +
      '.subcategories-wrap'
    );

    for (const target of Array.from(candidates)) {
      const table = target.querySelector<HTMLTableElement>(':scope > table');
      if (!table) continue;
      const previous = this.records.get(target);
      if (previous) {
        if (previous.table !== table) {
          this.resizes?.unobserve(previous.table);
          previous.table = table;
          this.resizes?.observe(table);
        }
        continue;
      }
      const css = getComputedStyle(target);
      if (!/auto|scroll|overlay/.test(`${css.overflowX} ${css.overflowY}`)) continue;
      this.attach(target, table);
    }

    for (const [target, record] of this.records) {
      if (target.isConnected) continue;
      record.vertical.track.remove();
      record.horizontal.track.remove();
      this.resizes?.unobserve(record.target);
      this.resizes?.unobserve(record.table);
      this.records.delete(target);
    }
  }

  private attach(target: HTMLElement, table: HTMLTableElement): void {
    if (!target.id) target.id = `inv-table-scroll-${++this.nextId}`;
    const vertical = this.createBar(target, 'vertical');
    const horizontal = this.createBar(target, 'horizontal');
    this.records.set(target, { target, table, vertical, horizontal });
    target.classList.add('inv-overlay-scroll-target');
    this.doc.body.append(vertical.track, horizontal.track);
    this.resizes?.observe(target);
    this.resizes?.observe(table);
  }

  private createBar(target: HTMLElement, direction: Direction): OverlayBar {
    const track = this.doc.createElement('div');
    track.className = `inv-table-scroll-track inv-table-scroll-track--${direction}`;
    track.setAttribute('role', 'scrollbar');
    track.setAttribute('aria-label', direction === 'vertical'
      ? 'Desplazamiento vertical de la tabla'
      : 'Desplazamiento horizontal de la tabla');
    track.setAttribute('aria-orientation', direction);
    track.setAttribute('aria-controls', target.id);
    track.setAttribute('aria-valuemin', '0');
    track.tabIndex = 0;

    const thumb = this.doc.createElement('div');
    thumb.className = 'inv-table-scroll-thumb';
    track.appendChild(thumb);
    const bar: OverlayBar = { track, thumb, direction, thumbLength: 0, trackLength: 0, maximum: 0 };

    let drag: { pointer: number; origin: number; start: number } | undefined;
    const isY = direction === 'vertical';
    const readPosition = (event: PointerEvent): number => isY ? event.clientY : event.clientX;
    const readScroll = (): number => isY ? target.scrollTop : target.scrollLeft;
    const setScroll = (value: number): void => {
      if (isY) target.scrollTop = value;
      else target.scrollLeft = value;
      this.schedule();
    };

    track.addEventListener('pointerdown', event => {
      if (bar.maximum <= 0 || event.button !== 0) return;
      event.preventDefault();
      const rect = track.getBoundingClientRect();
      const local = readPosition(event) - (isY ? rect.top : rect.left);
      if (event.target !== thumb) {
        const travel = Math.max(1, bar.trackLength - bar.thumbLength);
        setScroll((local - bar.thumbLength / 2) / travel * bar.maximum);
      }
      drag = { pointer: event.pointerId, origin: readPosition(event), start: readScroll() };
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const travel = Math.max(1, bar.trackLength - bar.thumbLength);
      setScroll(drag.start + (readPosition(event) - drag.origin) / travel * bar.maximum);
    });
    const stop = (): void => { drag = undefined; };
    track.addEventListener('pointerup', stop);
    track.addEventListener('pointercancel', stop);
    track.addEventListener('lostpointercapture', stop);
    track.addEventListener('keydown', event => {
      if (bar.maximum <= 0) return;
      const step = 40;
      const page = isY ? target.clientHeight : target.clientWidth;
      let next: number | undefined;
      switch (event.key) {
        case 'ArrowDown': if (isY) next = readScroll() + step; break;
        case 'ArrowUp': if (isY) next = readScroll() - step; break;
        case 'ArrowRight': if (!isY) next = readScroll() + step; break;
        case 'ArrowLeft': if (!isY) next = readScroll() - step; break;
        case 'PageDown': next = readScroll() + page; break;
        case 'PageUp': next = readScroll() - page; break;
        case 'Home': next = 0; break;
        case 'End': next = bar.maximum; break;
      }
      if (next === undefined) return;
      event.preventDefault();
      setScroll(next);
    });
    return bar;
  }

  private render(record: TableRecord): void {
    const { target, table, vertical, horizontal } = record;
    const rect = target.getBoundingClientRect();
    const view = this.doc.defaultView;
    if (!view || rect.width < 20 || rect.height < 25 || !target.getClientRects().length) {
      this.hide(record);
      return;
    }

    // No mostrar scrollbars de la pagina cuando un dialogo esta por encima.
    const modalOpen = Boolean(this.doc.querySelector('.cdk-overlay-container .mat-mdc-dialog-container'));
    if (modalOpen && !target.closest('.cdk-overlay-container')) {
      this.hide(record);
      return;
    }

    let top = Math.max(rect.top, 0);
    let left = Math.max(rect.left, 0);
    let bottom = Math.min(rect.bottom, view.innerHeight);
    let right = Math.min(rect.right, view.innerWidth);
    for (let ancestor = target.parentElement; ancestor && ancestor !== this.doc.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (!/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
      const a = ancestor.getBoundingClientRect();
      top = Math.max(top, a.top);
      left = Math.max(left, a.left);
      bottom = Math.min(bottom, a.bottom);
      right = Math.min(right, a.right);
    }
    if (bottom <= top || right <= left) {
      this.hide(record);
      return;
    }

    const hasVertical = target.scrollHeight - target.clientHeight > 1;
    const hasHorizontal = target.scrollWidth - target.clientWidth > 1;
    const headHeight = table.tHead?.getBoundingClientRect().height ?? 0;
    // La cabecera NO contiene barra: la pista comienza justo debajo de ella.
    const yTop = Math.max(top, rect.top + headHeight);
    const yBottom = bottom - (hasHorizontal ? 10 : 2);
    const xLeft = left + 2;
    const xRight = right - (hasVertical ? 10 : 2);

    this.renderBar(vertical, hasVertical && yBottom - yTop > 32,
      right - 9, yTop + 1, 7, Math.max(0, yBottom - yTop - 2),
      target.scrollTop, target.scrollHeight - target.clientHeight,
      Math.max(1, target.clientHeight - headHeight));

    this.renderBar(horizontal, hasHorizontal && xRight - xLeft > 32,
      xLeft, bottom - 9, Math.max(0, xRight - xLeft), 7,
      target.scrollLeft, target.scrollWidth - target.clientWidth,
      target.clientWidth);
  }

  private renderBar(bar: OverlayBar, show: boolean, left: number, top: number,
    width: number, height: number, value: number, maximum: number, visible: number): void {
    bar.track.style.display = show ? 'block' : 'none';
    if (!show) return;
    Object.assign(bar.track.style, {
      left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`
    });
    bar.trackLength = bar.direction === 'vertical' ? height : width;
    bar.maximum = Math.max(0, maximum);
    bar.thumbLength = Math.min(bar.trackLength,
      Math.max(26, bar.trackLength * visible / (visible + bar.maximum)));
    const travel = Math.max(0, bar.trackLength - bar.thumbLength);
    const offset = bar.maximum ? travel * Math.min(1, Math.max(0, value / bar.maximum)) : 0;
    if (bar.direction === 'vertical') {
      bar.thumb.style.height = `${bar.thumbLength}px`;
      bar.thumb.style.width = '100%';
      bar.thumb.style.transform = `translateY(${offset}px)`;
    } else {
      bar.thumb.style.width = `${bar.thumbLength}px`;
      bar.thumb.style.height = '100%';
      bar.thumb.style.transform = `translateX(${offset}px)`;
    }
    bar.track.setAttribute('aria-valuemax', String(Math.round(bar.maximum)));
    bar.track.setAttribute('aria-valuenow', String(Math.round(Math.max(0, value))));
  }

  private hide(record: TableRecord): void {
    record.vertical.track.style.display = 'none';
    record.horizontal.track.style.display = 'none';
  }
}
