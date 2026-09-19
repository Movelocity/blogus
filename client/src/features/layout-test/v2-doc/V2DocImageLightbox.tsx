import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { useCallback, useEffect } from "react";

type V2DocImageLightboxProps = {
  urls: string[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function V2DocImageLightbox({ urls, index, onClose, onIndexChange }: V2DocImageLightboxProps) {
  const open = index !== null && index >= 0 && index < urls.length;
  const current = open ? urls[index!] : "";

  const goPrev = useCallback(() => {
    if (index === null || urls.length === 0) return;
    onIndexChange((index - 1 + urls.length) % urls.length);
  }, [index, onIndexChange, urls.length]);

  const goNext = useCallback(() => {
    if (index === null || urls.length === 0) return;
    onIndexChange((index + 1) % urls.length);
  }, [index, onIndexChange, urls.length]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, goPrev, goNext, onClose]);

  if (!open) return null;

  const showNav = urls.length > 1;

  const imageMaxClass = showNav
    ? "max-h-[min(calc(100dvh-7rem),calc(100vh-7rem))] max-w-[calc(100vw-8rem)]"
    : "max-h-[min(calc(100dvh-5rem),calc(100vh-5rem))] max-w-[calc(100vw-2.5rem)]";

  return (
    <div
      className="v2-lightbox fixed inset-0 z-[100] grid h-dvh w-full place-items-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="图片全屏浏览"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="关闭"
        className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/90 transition hover:bg-white/10"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XIcon className="h-6 w-6" weight="bold" />
      </button>

      {showNav ? (
        <button
          type="button"
          aria-label="上一张"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white/90 transition hover:bg-white/10 md:left-6"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          <CaretLeftIcon className="h-8 w-8" weight="bold" />
        </button>
      ) : null}

      <figure
        className="m-0 grid max-w-full place-items-center gap-3 px-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <img
          alt=""
          className={`block h-auto w-auto object-contain ${imageMaxClass}`}
          src={current}
        />
        {showNav ? (
          <figcaption className="text-sm text-white/70">
            {index! + 1} / {urls.length}
          </figcaption>
        ) : null}
      </figure>

      {showNav ? (
        <button
          type="button"
          aria-label="下一张"
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white/90 transition hover:bg-white/10 md:right-6"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          <CaretRightIcon className="h-8 w-8" weight="bold" />
        </button>
      ) : null}
    </div>
  );
}
