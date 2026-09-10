/** 富文本页顶栏高度，与 header h-14 一致 */
export const EDITOR_HEADER_HEIGHT = "3.5rem";

/** 工具条高度 CSS 变量，由 Toolbar ResizeObserver 写入 */
export const EDITOR_TOOLBAR_HEIGHT_VAR = "--re-toolbar-height";

/** 工具条未测量前的 fallback，与 Toolbar 单行高度接近 */
export const EDITOR_TOOLBAR_HEIGHT_FALLBACK = "2.75rem";

export const CHROME_TRANSITION_MS = 500;

export const CHROME_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";

/** 顶栏显隐仅改 transform，勿动滚动容器布局 */
export const chromeMotionStyle = {
  transitionProperty: "transform",
  transitionDuration: `${CHROME_TRANSITION_MS}ms`,
  transitionTimingFunction: CHROME_EASING,
} as const;

/** 滚动区顶部留白：顶栏 + 工具条，不随显隐变化 */
export const editorScrollInset = `calc(${EDITOR_HEADER_HEIGHT} + var(${EDITOR_TOOLBAR_HEIGHT_VAR}, ${EDITOR_TOOLBAR_HEIGHT_FALLBACK}))`;
