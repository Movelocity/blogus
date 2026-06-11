import { FormEvent, useState } from "react";
import { createPost } from "../lib/api";

export function AdminPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await createPost({ title, content, status: "draft" });
    setMessage(`草稿已创建：${result.post.title}`);
    setTitle("");
    setContent("");
  }

  return (
    <>
      <section className="page-heading">
        <h1>文章管理</h1>
        <p>创建草稿并通过 API 或 CLI 继续编辑发布。</p>
      </section>

      <form className="form-panel" onSubmit={handleSubmit}>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          正文
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <button className="primary-button" type="submit">
          创建草稿
        </button>
        {message ? <p>{message}</p> : null}
      </form>
    </>
  );
}
