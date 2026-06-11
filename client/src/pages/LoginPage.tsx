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
      <section className="mb-6">
        <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900">登录</h1>
        <p className="m-0 text-slate-600">使用邮箱和密码进入写作后台。</p>
      </section>
      <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6" onSubmit={handleSubmit}>
        <label className="grid gap-2 font-semibold">
          邮箱
          <input
            autoComplete="email"
            className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-2 font-semibold">
          密码
          <input
            autoComplete="current-password"
            className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            placeholder="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          className="justify-self-start rounded-md bg-teal-700 px-4 py-2 font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={loading}
          type="submit"
        >
          {loading ? "登录中..." : "登录"}
        </button>
        {error ? <p className="text-red-700">{error}</p> : null}
      </form>
    </>
  );
}
