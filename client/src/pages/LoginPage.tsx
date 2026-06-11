import { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { login } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      navigate("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>登录</h1>
        <p>使用管理员邮箱和密码进入写作后台。</p>
      </section>
      <form className="form-panel" onSubmit={handleSubmit}>
        <label>
          邮箱
          <input
            autoComplete="email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            placeholder="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "登录中..." : "登录"}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </>
  );
}
