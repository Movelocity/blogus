import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_DELTA_MIN = 4;
/** 与顶栏过渡时长对齐，过渡期间忽略滚动方向判定 */
const SCROLL_HIDE_PAUSE_MS = 540;

/**
 * 向下滚动超过 threshold 时隐藏，向上滚动时显示。
 * 默认监听 window；将 scrollRef 绑定到滚动容器后监听其 scrollTop。
 * 顶栏显隐应仅通过 transform 实现，勿改动 scroll 容器布局，以免打断阅读位置。
 */
export function useScrollHide(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const pausedUntil = useRef(0);

  const scrollRef = useCallback((el: HTMLElement | null) => {
    setScrollEl(el);
  }, []);

  useEffect(() => {
    pausedUntil.current = Date.now() + SCROLL_HIDE_PAUSE_MS;
  }, [hidden]);

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      if (Date.now() < pausedUntil.current) {
        ticking.current = false;
        return;
      }

      const y = scrollEl?.scrollTop ?? window.scrollY;
      const delta = y - lastY.current;

      if (Math.abs(delta) >= SCROLL_DELTA_MIN) {
        if (delta > 0 && y > threshold) {
          setHidden(true);
        } else if (delta < 0) {
          setHidden(false);
        }
        lastY.current = y;
      }

      ticking.current = false;
    });
  }, [scrollEl, threshold]);

  useEffect(() => {
    const target: HTMLElement | Window = scrollEl ?? window;
    lastY.current = scrollEl?.scrollTop ?? window.scrollY;
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [onScroll, scrollEl]);

  return { hidden, scrollRef };
}
