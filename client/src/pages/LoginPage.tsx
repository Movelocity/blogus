import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight } from "@phosphor-icons/react";
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
    // 骨架屏：形状与最终布局一致，不用动画以兼容 prefers-reduced-motion
    return (
      <section aria-busy="true" className="grid border border-foreground/10 lg:min-h-[72vh] lg:grid-cols-2">
        <div className="flex flex-col justify-between gap-10 bg-muted/60 p-8 lg:p-16">
          <div className="h-3 w-20 bg-foreground/10" />
          <div className="grid gap-4">
            <div className="h-12 w-3/4 bg-foreground/10" />
            <div className="h-12 w-1/2 bg-foreground/10" />
          </div>
          <div className="hidden h-3 w-48 bg-foreground/10 lg:block" />
        </div>
        <div className="flex flex-col justify-center gap-6 p-8 lg:p-16">
          <div className="h-8 w-24 bg-foreground/10" />
          <div className="h-11 w-full bg-foreground/10" />
          <div className="h-11 w-full bg-foreground/10" />
          <div className="h-12 w-32 rounded-full bg-foreground/10" />
        </div>
      </section>
    );
  }

  return (
    <section className="grid fade-in border border-foreground/10 lg:min-h-[72vh] lg:grid-cols-2">
      {/* 左侧品牌面板：延续 Landing 的大字排版与 accent 铺色 */}
      <div className="flex flex-col justify-between gap-10 bg-accent p-8 text-accent-foreground lg:p-16">
        <span className="font-mono text-xs tracking-widest uppercase">
          {isRegister ? "首次设置" : "管理后台"}
        </span>
        <h1 className="m-0 max-w-md font-display text-[clamp(2.75rem,5vw,4.5rem)] font-bold leading-[1.02] tracking-tight">
          {isRegister ? "从这里开始。" : "Login"}
        </h1>
        <p className="m-0 hidden max-w-xs font-mono text-sm leading-6 opacity-80 lg:block">
          Keep it simple, keep it runnable.
        </p>
      </div>

      {/* 右侧表单列：无卡片盒子，下划线输入，形状规则为按钮胶囊、其余直角 */}
      <div className="flex flex-col justify-center p-8 lg:p-16">
        <form className="grid gap-7" onSubmit={handleSubmit}>
          <h2 className="m-0 font-display text-2xl font-bold tracking-tight text-foreground">
            {isRegister ? "注册管理员账号" : "登录"}
          </h2>
          {isRegister ? (
            <p className="m-0 -mt-4 text-sm text-muted-foreground">
              系统尚未初始化，先创建第一个管理员账号。
            </p>
          ) : null}
          {isRegister ? (
            <label className="grid gap-2">
              <span className="font-mono text-xs text-muted-foreground">昵称（可选）</span>
              <input
                autoComplete="nickname"
                className="border-b border-foreground/20 bg-transparent py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
                name="nickname"
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
              className="border-b border-foreground/20 bg-transparent py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="font-mono text-xs text-muted-foreground">密码</span>
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="border-b border-foreground/20 bg-transparent py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
              name="password"
              placeholder={isRegister ? "至少 8 位" : "输入密码"}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            className="mt-1 inline-flex items-center gap-2 self-start rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? (isRegister ? "注册中..." : "登录中...") : isRegister ? "创建账号" : "进入后台"}
            <ArrowRight size={16} weight="bold" aria-hidden />
          </button>
          {error ? (
            <p className="m-0 font-mono text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
