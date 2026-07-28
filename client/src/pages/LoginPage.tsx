import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getSystemStatus, login, register } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [initialized, setInitialized] = useState(true);

  useEffect(() => {
    getSystemStatus()
      .then(({ initialized }) => setInitialized(initialized))
      .catch(() => setInitialized(true))
      .finally(() => setCheckingStatus(false));
  }, []);

  const isRegister = !initialized;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register({ email, password, name: name.trim() || undefined });
      } else {
        await login({ email, password });
      }
      navigate("/admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : isRegister ? "注册失败" : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="mx-auto grid max-w-md gap-10 pt-8">
        <p className="text-center text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-10 pt-8">
      <header className="grid gap-4 text-center">
        <span className="mx-auto inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
          <span className="h-px w-8 bg-foreground/30" />
          {isRegister ? "Setup" : "Authentication"}
          <span className="h-px w-8 bg-foreground/30" />
        </span>
        <h1 className="m-0 font-display text-5xl tracking-tight text-foreground">
          {isRegister ? "创建管理员账号" : "登录"}
        </h1>
        <p className="m-0 text-muted-foreground">
          {isRegister
            ? "系统未初始化，请先注册管理员账号。"
            : "使用邮箱和密码进入写作后台。"}
        </p>
      </header>

      <form className="grid gap-5 border border-foreground/10 bg-card p-8" onSubmit={handleSubmit}>
        {isRegister ? (
          <label className="grid gap-2">
            <span className="font-mono text-xs text-muted-foreground">昵称（可选）</span>
            <input
              className="border border-foreground/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/10"
              placeholder="你的昵称"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : null}
        <label className="grid gap-2">
          <span className="font-mono text-xs text-muted-foreground">邮箱</span>
          <input
            autoComplete="email"
            className="border border-foreground/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/10"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="font-mono text-xs text-muted-foreground">密码</span>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="border border-foreground/10 bg-background px-4 py-3 text-foreground outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/10"
            placeholder={isRegister ? "至少 8 位" : "password"}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          disabled={loading}
          type="submit"
        >
          {loading ? (isRegister ? "注册中..." : "登录中...") : isRegister ? "注册" : "登录"}
        </button>
        {error ? (
          <p className="m-0 text-center font-mono text-sm text-destructive">{error}</p>
        ) : null}
      </form>
    </div>
  );
}
