export function LoginPage() {
  return (
    <>
      <section className="page-heading">
        <h1>登录</h1>
        <p>浏览器登录和 CLI 授权流程将在鉴权实现阶段接入。</p>
      </section>
      <div className="form-panel">
        <label>
          邮箱
          <input placeholder="you@example.com" />
        </label>
        <label>
          密码
          <input placeholder="password" type="password" />
        </label>
        <button className="primary-button" type="button">
          登录
        </button>
      </div>
    </>
  );
}
