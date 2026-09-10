import { useEffect } from "react";
import { defaultDocumentTitle } from "../lib/documentTitle";

/** 在组件挂载期间设置 document.title，卸载时恢复默认站名。 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (!title) {
      return;
    }

    document.title = title;
    return () => {
      document.title = defaultDocumentTitle;
    };
  }, [title]);
}
