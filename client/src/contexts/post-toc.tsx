import { createContext, useContext } from "react";
import type { HeadingItem } from "../lib/markdown";

interface TocContextValue {
  setHeadings: (headings: HeadingItem[]) => void;
}

/** 独立模块，避免 PostPage lazy chunk 与 PostLayout 各持有一份 context。 */
export const PostTocContext = createContext<TocContextValue>({ setHeadings: () => {} });

export function useToc() {
  return useContext(PostTocContext);
}
