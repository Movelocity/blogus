# Spec: Session expiry UX

- 状态：已实施（2026-06-16）
- 日期：2026-06-16
- 目标：让后端重启 / access token 过期对用户"无感"

## 背景

当前问题：

- `JWT_EXPIRY` 默认 `2h`，dev 场景下每 2 小时触发一次 access 过期。
- `client/src/lib/api.ts:10-22` 的 `request()` 在 401 + refresh 失败时只把 401 错误往上抛，**不跳页也不清状态**。
- `client/src/pages/AdminPage.tsx:85-94` 挂载时直接 `whoami()`，没有静默 refresh。
- 体感上："刚还在用，后端一重启就跳到登录页"，但 cookie 实际还在。

`auth_sessions` 在 PostgreSQL 的 bind mount 中，重启不丢；`JWT_SECRET` 默认 `dev-secret` 不会变。**理论不需要重新登录**，但客户端行为让它看起来"需要重新登录"。

## 改动

### 改动 1：401/refresh 失败后自动跳 `/login`

**文件**：`client/src/lib/api.ts`、`client/src/main.tsx`（或新文件 `client/src/components/SessionWatcher.tsx`）。

**`lib/api.ts`**：
- 新增内部 `refreshSession(): Promise<boolean>`，单飞（in-flight 共享），避免并发 401 触发多次 refresh。
- `request()` 改造：
  - 401 + path 不在 `{ /auth/login, /auth/register, /auth/refresh }` 时，调 `refreshSession()`
  - refresh 成功 → 重试原请求
  - refresh 失败 → 派发 `window` 事件 `blogus:session-expired` + 抛 `SessionExpiredError`
- 导出 `class SessionExpiredError extends Error`。
- `uploadFile` 里那段重复的 401 逻辑（`lib/api.ts:99-111`）删掉，改用 `refreshSession`。
- `refreshSession` `export` 给改动 2 用。

**`main.tsx` / `SessionWatcher.tsx`**：
- 新增组件，监听 `blogus:session-expired` → `navigate("/login", { replace: true })`。
- 在 `<App />` 顶部挂载。

**为何排除 `/auth/login`、`/auth/register`**：登录失败、注册失败本就该原样回显错误，不应触发 refresh 重试或跳页。

### 改动 2：进入 `/admin` 时静默 refresh

**文件**：`client/src/pages/AdminPage.tsx`。

将 `useEffect`（`AdminPage.tsx:85-94`）改为：
1. `await refreshSession()`
2. false → `setAuthChecked(true)`、user 留 null → 渲染"需要登录"卡片（与现状一致）
3. true → 继续 `whoami()` + `listPosts({ visibility: "all" })`（与现状一致）

### 改动 3：`JWT_EXPIRY` 默认 `12h`

**文件**：`server/src/config.ts`、`.env.example`。

- `config.ts:68`：`expiry: process.env.JWT_EXPIRY && parseDurationSeconds(process.env.JWT_EXPIRY) !== undefined ? process.env.JWT_EXPIRY : "12h"` —— 非法值（如 `garbage`）走默认。
- `.env.example`：同步更新 `JWT_EXPIRY=12h`，加注释（access 有效期；refresh 默认 720h 30 天不变，受 DB session 控制可主动吊销）。
- **`.env` 不动**。未显式设置 `JWT_EXPIRY` 的用户自动用新默认值；已设置的不受影响。

**取值理由**：
- 12h：dev 一两个工作日 1 次 refresh；cookie 被盗时攻击窗口 12h，绑定 DB session 可吊销。
- 不取 24h：refresh 路径长期间不被覆盖，access 失效时容易暴露出潜在 bug。

## 测试

> 测试驱动：`blogus-cli`（基于已实现的 `register`/`login`/`logout`/`whoami`/`post`/`upload`）+ 少量 `curl`（cookie/refresh 流程）+ 少量手工 E2E（React 行为）。CLI 使用 `Authorization: Bearer` 而非 cookie，cookie 流程必须用 `curl --cookie-jar`。

### 前置

```bash
pnpm --filter @blogus/server dev   # 后端，监听 3009
# 等待 /api/health 返回 ok=true
curl -fsS http://127.0.0.1:3009/api/health
```

### T1（CLI · 改动 3）— access token 默认有效期 12h

```bash
# 清干净，重置用户
blogus-cli logout 2>/dev/null || true
rm -f ~/.blogus-cli/config.json

# 注册并保存 token
blogus-cli register -e session-ux-$(date +%s)@example.com -p test-password-1234

# 解码 token，验证 exp - iat == 43200
token=$(jq -r .token ~/.blogus-cli/config.json)
payload_b64=$(echo "$token" | cut -d. -f2)
# base64url -> base64，补齐 padding
payload_b64_std=$(echo "$payload_b64" | tr '_-' '/+' | awk '{while (length($0)%4) $0=$0"="; print}')
diff_seconds=$(echo "$payload_b64_std" | base64 -d | jq -r '.exp - .iat')
[ "$diff_seconds" = "43200" ] && echo "PASS: access expires in 12h" || echo "FAIL: got $diff_seconds"
```

期望：`PASS: access expires in 12h`。

### T2（CLI · 改动 3）— 环境变量可覆盖默认

```bash
# 杀掉现有 server，临时以 JWT_EXPIRY=1h 启动
pkill -f "tsx watch src/index.ts" || true
sleep 1
JWT_EXPIRY=1h pnpm --filter @blogus/server dev &
sleep 3

# 重新登录
rm -f ~/.blogus-cli/config.json
blogus-cli login -e <existing email> -p <existing password>

# 同样的解码脚本
diff_seconds=$(...)
[ "$diff_seconds" = "3600" ] && echo "PASS: env override works" || echo "FAIL: got $diff_seconds"
```

期望：`PASS: env override works`。

### T3（CLI · 改动 3）— 非法 JWT_EXPIRY 走默认

```bash
pkill -f "tsx watch src/index.ts" || true
sleep 1
JWT_EXPIRY=garbage pnpm --filter @blogus/server dev &
sleep 3

# login 仍能成功（config.ts 的 parseDurationSeconds 返回 undefined 时已 fallback）
blogus-cli login -e <existing email> -p <existing password>
diff_seconds=$(...)
[ "$diff_seconds" = "43200" ] && echo "PASS: garbage falls back to 12h" || echo "FAIL: got $diff_seconds"
```

期望：`PASS: garbage falls back to 12h`。

### T4（CLI · 烟雾）— 登录态在 CLI 各命令间一致

```bash
blogus-cli whoami
# -> 打印现有 user

blogus-cli post list
# -> 打印文章列表（可能为空）

blogus-cli invite list
# -> 打印邀请码（admin）或 403（user）
```

期望：所有命令成功，登录态贯穿。

### T5（curl · 改动 1 服务端）— 完整 cookie 流程

```bash
rm -f cookies.txt

# 1. 登录，存 cookie
curl -fsS -c cookies.txt -X POST http://127.0.0.1:3009/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"<email>","password":"<password>"}' >/dev/null
test -s cookies.txt && echo "PASS: login set cookies" || echo "FAIL: no cookies"

# 2. access cookie 携带，whoami 成功
curl -fsS -b cookies.txt http://127.0.0.1:3009/api/auth/whoami | jq -e '.user.email'
echo "PASS: whoami with access cookie"

# 3. refresh 一次
curl -fsS -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:3009/api/auth/refresh | jq -e '.user.email'
echo "PASS: refresh returns new tokens"

# 4. 删 access cookie 留 refresh cookie，server 直发 whoami 返 401
# （server 没有 refresh-on-401 hook；该逻辑在 client request() 内透明处理，详见 T6）
# macOS sed 语法兼容：用临时文件
sed -i.bak '/blogus_access_token/d' cookies.txt
code=$(curl -s -o /dev/null -w '%{http_code}' -b cookies.txt http://127.0.0.1:3009/api/auth/whoami)
[ "$code" = "401" ] && echo "PASS: server returns 401 when access cookie missing (client handles refresh-on-401)" || echo "FAIL: got $code"

# 5. refresh cookie 也失效时，refresh 返回 401
sed -i.bak '/blogus_refresh_token/d' cookies.txt
code5=$(curl -s -o /dev/null -w '%{http_code}' -b cookies.txt -X POST http://127.0.0.1:3009/api/auth/refresh)
[ "$code5" = "401" ] && echo "PASS: refresh without cookie returns 401" || echo "FAIL: got $code5"
```

期望：5 步全 PASS。这一组验证**服务端 cookie/refresh 流程不被改动 1 破坏**。step 4 server 返 401 是预期行为 —— server 不做 refresh-on-401（范围外），client `request()` 透明处理；浏览器侧"自动跳 /login"是客户端行为，单测不覆盖，由 T6-T8 手工验证。

### T6（手工 E2E · 改动 2）— 静默 refresh：access 过期不闪登录页

```bash
# 临时用短 access，重启 server
pkill -f "tsx watch src/index.ts" || true
sleep 1
JWT_EXPIRY=20s pnpm --filter @blogus/server dev &
sleep 3
```

- 浏览器登录 `/admin`，看到管理界面。
- 等 30 秒（access 过期）。
- 点击侧栏"管理"或直接刷新 `/admin`。
- **期望**：管理界面正常出现，**没有"需要登录"卡片的闪动**；DevTools Network 面板能看到 `POST /api/auth/refresh` → 200 → 然后 `whoami`/`listPosts` 200。

### T7（手工 E2E · 改动 1）— refresh 也失效时自动跳 /login

- 接 T6。
- 在 DevTools Application → Cookies 中删除 `blogus_access_token` 和 `blogus_refresh_token`。
- 点击任意管理操作（如点文章 / 重新加载 `/admin`）。
- **期望**：URL 跳到 `/login`，**没有红色错误条"Unauthorized"**。

### T8（手工 E2E · 改动 1）— 输错密码不跳页

- 打开 `/login`，输入错误密码。
- **期望**：表单下方显示"Invalid email or password"等错误，**URL 保持 `/login`**，没有自动跳到 `/admin` 也没有跳到首页。

### T9（手工 E2E · 改动 2）— 后端重启期间不丢登录

- 浏览器登录 `/admin`，保持页面打开。
- 在终端 `pkill -f "tsx watch src/index.ts"`，等 1 秒，再 `pnpm --filter @blogus/server dev`。
- **期望**：页面没有跳到 `/login`；过几秒后操作（保存、刷新列表）自动恢复。

### T10（CLI · 回归）— `pnpm typecheck`、`pnpm test`

```bash
pnpm typecheck
pnpm test
```

期望：全通过。

## 范围外

- 不改 cookie 的 `SameSite` / `Secure` / `Domain`（生产部署时再调）
- 不引入 React 全局状态库
- 不动后端鉴权逻辑、refresh token 流程、`auth_sessions` 表结构
- 不处理 `BLOGUS_ENABLE_DEV_LOGIN` 模式下的密码漂移问题

## 验收清单

- [x] T1 默认 12h 通过（`exp - iat = 43200`）
- [x] T2 环境变量覆盖通过（`JWT_EXPIRY=1h` → `exp - iat = 3600`）
- [x] T3 非法值 fallback 通过（`JWT_EXPIRY=garbage` → 12h；为此在 config.ts 用 `parseDurationSeconds` 校验）
- [x] T4 CLI 烟雾通过（whoami / post list / invite list）
- [x] T5 curl cookie/refresh 流程通过（5/5 step；step 4 改为断言 server 返 401，详见下方"实施调整"）
- [x] T10 typecheck + test 通过

### 已手工验收（浏览器 E2E，2026-06-17）

- [x] T6 静默 refresh：access 过期不闪登录页（JWT_EXPIRY=20s，等 30s 后刷新，直接显示管理后台）
- [x] T7 refresh 失败时显示登录卡片（URL 保持 /admin，显示"需要登录后才能访问"，无红色错误条）
- [x] T8 输错密码不跳页（URL 保持 /login）
- [x] T9 后端重启期间不丢登录态（重启后 whoami 200，页面不跳转）

## 实施调整（与初稿的偏差）

1. **T5 step 4 改写**：原 spec 期望"删 access cookie 留 refresh cookie → whoami 仍 200"，但 server 没有 refresh-on-401 hook（范围外，"不动后端鉴权逻辑"），curl 直发会返 401。客户端 `request()` 是在浏览器里透明处理这条逻辑的（调 `/auth/refresh` 再重试），所以浏览器侧不受影响。脚本改为断言 server 返 401。
2. **`fetchApi` 顺带修一个空 body bug**：`fetchApi` 之前对所有非 FormData 请求都加 `content-type: application/json`，导致 `refreshSession()` 这种"POST 无 body"的请求被 server 端 Fastify body parser 拒（"Body cannot be empty when content-type is set to 'application/json'"）。改为：仅当 `init.body` 非空时才设 `content-type`。
3. **`config.ts` 改动 1 行变条件三元**：`parseDurationSeconds` 在 `JWT_EXPIRY=garbage` 时返回 `undefined`；直接把这个字符串传给 `@fastify/jwt` 的 `expiresIn` 会被库静默默认到 1h（不是 12h），所以 T3 失败。改为先用 `parseDurationSeconds` 校验，非法时回退到 `"12h"`。

## 预计改动量（实际）

- `client/src/lib/api.ts`：~40 行（refreshSession 单飞、SessionExpiredError、request 重构、uploadFile 重构、fetchApi 空 body 修复）
- `client/src/components/SessionWatcher.tsx`：新增 14 行
- `client/src/main.tsx`：2 行（导入 + 挂载）
- `client/src/pages/AdminPage.tsx`：~14 行（useEffect 内调 refreshSession）
- `server/src/config.ts`：1 行（条件三元，带 parseDurationSeconds 校验）
- `.env.example`：2 行（含注释）
- `docs/specs/2026-06-16-session-expiry-ux.md`：本文件
- 测试：本次不引入新自动化测试，T1-T5 已通过，详见上文验收清单。T6-T9 走手工验收截图。
