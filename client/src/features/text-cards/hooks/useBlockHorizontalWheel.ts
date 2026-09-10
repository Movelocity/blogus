import { useEffect, type RefObject } from "react";

function findHorizontalScroller(target: EventTarget | null, boundary: HTMLElement): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== boundary) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function canScrollHorizontally(el: HTMLElement, deltaX: number): boolean {
  if (deltaX === 0) return false;
  const maxScroll = el.scrollWidth - el.clientWidth;
  if (maxScroll <= 0) return false;
  if (deltaX < 0) return el.scrollLeft > 0;
  return el.scrollLeft < maxScroll - 1;
}

/** 拦截横向滚轮在边界外的默认行为，避免 macOS 浏览器触发历史后退/前进。 */
export function useBlockHorizontalWheel(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onWheel = (event: WheelEvent) => {
      const { deltaX, deltaY } = event;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

      const scroller = findHorizontalScroller(event.target, root);
      if (scroller && canScrollHorizontally(scroller, deltaX)) return;

      event.preventDefault();
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [rootRef]);
}
