import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

export function EditorContent() {
  return (
    <RichTextPlugin
      contentEditable={
        <ContentEditable
          className="re-editor-input"
          aria-label="富文本编辑区"
          spellCheck
        />
      }
      placeholder={
        <div className="re-placeholder">粘贴富文本开始，或按 / 插入块</div>
      }
      ErrorBoundary={LexicalErrorBoundary}
    />
  );
}
