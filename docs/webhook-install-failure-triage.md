# Webhook 自动部署 install 步骤偶发失败 —— 排查交接文档

> 状态：**修复已落地，待下一次真实部署验证**（根因高度收敛于 H1，deploy.sh 已上双保险）
> 最后更新：2026-08-18（本地复核补充，见第十一节）
> 涉及版本：v0.2.0（首次记录）、v0.2.1（再次复现）
> 服务器：`hollway@175.178.197.203`

---

## 一、问题现象

发版流程 `git tag vX.Y.Z && git push origin vX.Y.Z` 触发服务器 webhook 自动部署时，`deploy.sh` 中的 `pnpm install --frozen-lockfile` 步骤**偶发失败**：

- `deploy.log` 中出现 `!!! INSTALL FAILED for <TAG>`，脚本在此 `exit 1` 终止，后续 build 与 pm2 restart 未执行。
- 已确认 v0.2.0、v0.2.1 两次复现，均需**手动 SSH 补跑** `pnpm install && pnpm build && pm2 restart blogus` 才能完成部署。
- 手动补跑时一切正常，说明代码、依赖、锁文件本身没有问题。

## 二、部署链路架构

```
GitHub tag push
    │  webhook (X-Hub-Signature-256 验签)
    ▼
python3 webhook-server.py (端口 9000, pm2 托管, 名 blogus-webhook)
    │  subprocess.Popen(["bash", deploy.sh, tag],
    │      stdout=DEVNULL, stderr=DEVNULL, start_new_session=True)
    ▼
scripts/deploy.sh  [本仓库 docs 中无收录，见服务器]
    │  1. flock 防并发 → 2. git fetch/checkout → 3. pnpm install → 4. pnpm build → 5. pm2 restart blogus
    ▼
pm2 应用 blogus (node server/dist/index.js, 监听 3009)
```

**关键环境差异**：webhook 触发的 deploy.sh 运行在**无 TTY、无交互、stdout/stderr 重定向到 deploy.log** 的子进程中（`start_new_session=True`）；手动 SSH 补跑则通常有 TTY/交互上下文。install 的失败表现与这个环境差异强相关。

## 三、关键文件与路径（均在服务器上）

| 文件 | 路径 |
|---|---|
| 部署脚本 | `~/projects/blogus/scripts/deploy.sh` |
| webhook 服务 | `~/projects/blogus/scripts/webhook-server.py` |
| webhook 启动包装 | `~/projects/blogus/scripts/blogus-webhook.sh` |
| pm2 配置 | `~/projects/blogus/scripts/ecosystem.config.cjs` |
| 部署日志 | `~/projects/blogus/deploy.log`（240 行，含历次记录） |
| node/pnpm 位置 | `~/.local/node/bin`（**非交互 shell 不加载，需手动 export PATH**） |
| 服务端口 | blogus=3009，webhook=9000 |

## 四、证据时间线

### v0.2.0（2026-08-13）
```
=== Deploy v0.2.0 started at Thu Aug 13 06:24:23 PM CST 2026 ===
...checkout 成功...
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 1.3s
   ╭────────────── Update available! 9.15.4 → 11.21.0 ──────────────╮
   ╰─────────────────────────────────────────────────────────────────╯
!!! INSTALL FAILED for v0.2.0
```
后经手动补跑完成（deploy.log 有补记）。

### v0.2.1（2026-08-18，本次）
```
=== Deploy v0.2.1 started at Tue Aug 18 10:29:55 AM CST 2026 ===
error: RPC failed; curl 16 Error in the HTTP2 framing layer
fatal: expected flush after ref listing
!!! FETCH timeout/failed for v0.2.1, fallback to shallow tag fetch   ← fetch 问题已走兜底，非本次根因
Checked out v0.2.1 (91f2a25)
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 1.8s
   ╭────────────── Update available! 9.15.4 → 11.22.0 ──────────────╮
   ╰─────────────────────────────────────────────────────────────────╯
!!! INSTALL FAILED for v0.2.1 at Tue Aug 18 10:30:31 AM CST 2026
```

## 五、已完成排查（关键结论）

1. **install 实际是成功的**：日志中 pnpm 已完整输出 `Done in 1.8s` / `Already up to date`，说明 install 执行完毕且无实质错误，但**进程退出码非 0**，触发 `deploy.sh` 的 `||` 失败分支。
2. **手动跑退出码为 0**：SSH 下 `pnpm install --frozen-lockfile`（输出重定向到文件，非 TTY）`EXIT_CODE=0`，未复现。
3. **pnpm 版本 9.15.4**，两次失败日志均伴随 `Update available! 9.15.4 → 11.x` 的升级提示——**提示出现与失败强相关**（手动跑时提示未出现）。
4. `git fetch` 的 HTTP2 挂死是**独立的历史问题**，已有超时+浅拉兜底修复（deploy.sh 内注释说明），本次 fetch 失败后兜底成功，与 install 失败无关。

## 六、根因假设（按可能性排序）

| # | 假设 | 依据 | 验证方式 |
|---|---|---|---|
| H1 | **pnpm 9.15.4 的 update-notifier 在无 TTY 环境下输出升级提示后返回非 0 退出码**（写入 stderr/重定向到文件时 SIGPIPE 或内部错误） | 两次失败日志都伴随 "Update available!"；手动跑（无提示）退出码 0 | 禁用 notifier 后重测（见步骤 1、2） |
| H2 | `subprocess.Popen` 子进程环境变量（HOME/PATH/CI 等）与手动 SSH 不同，pnpm 行为受影响 | webhook 由 pm2 启动的 python 继承 pm2 环境 | 对比 `pm2 env blogus-webhook` 与交互 shell 的 env |
| H3 | pnpm 在进程组隔离（`start_new_session=True`）+ 无 TTY 下向 stderr 写提示时被中断，退出码异常 | 与 H1 相关，机制略有不同 | 用 `setsid` 复现（见步骤 3） |

> **2026-08-18 复核**：H2 基本可排除——两次失败日志均干净（无任何 install 错误输出），若环境差异导致 install 本身失败必有报错；且 deploy.sh 已自行 `export PATH`。H1 与 H3 本质是同一机制（update-notifier 在非交互会话下的缺陷），合并为一条处理，详见第十一节。

## 七、下一步排查步骤（按顺序执行）

> 服务器操作，建议先备份 `deploy.sh`，所有改动前记录原文件。

1. **确认退出码**：在 `deploy.sh` 的 install 行加退出码采集，临时改为：
   ```bash
   pnpm install --frozen-lockfile >> "$LOG" 2>&1
   INSTALL_EXIT=$?
   echo "install exit code: $INSTALL_EXIT" >> "$LOG"
   [ $INSTALL_EXIT -eq 0 ] || { echo "!!! INSTALL FAILED for $TAG at $(date)" >> "$LOG"; exit 1; }
   ```
   再打一个测试 tag（或手动触发 webhook）复现，拿到真实退出码（非 0 的具体值）。

2. **验证 H1（最快路径）**：禁用 pnpm 升级提示后再触发一次部署：
   ```bash
   export PATH=$HOME/.local/node/bin:$PATH
   pnpm config set update-notifier false
   # 或部署脚本开头加: export NO_UPDATE_NOTIFIER=1
   ```
   若不再失败，根因即 H1。

3. **复现无 TTY 环境**（不依赖真实 webhook）：
   ```bash
   export PATH=$HOME/.local/node/bin:$PATH
   cd ~/projects/blogus
   setsid bash scripts/deploy.sh v0.2.1 < /dev/null > /tmp/repro.log 2>&1
   grep -E 'INSTALL|Done|Update available' /tmp/repro.log
   ```
   对比有无 `Update available!` 提示时的退出码差异。

4. **对比环境变量**：`pm2 env blogus-webhook` 与 `env` 的差异，重点看 `HOME`、`CI`、`TERM`、`PATH`。

## 八、候选修复方案（确认根因后选用）

> **2026-08-18**：方案 1 + 2 已组合落地到 `scripts/deploy.sh`（见第十一节），不再需要"确认根因后再选"。

1. **禁用 update-notifier（最小改动）✅ 已采用**：`deploy.sh` 开头加 `export NO_UPDATE_NOTIFIER=1` 或 `pnpm config set update-notifier false`。若 H1 成立，一行修复。
2. **install 加失败重试（与 build 现有策略一致）✅ 已采用**：deploy.sh 中 build 已有"失败后 sleep 3 重试一次"的先例，install 同样处理：
   ```bash
   if ! pnpm install --frozen-lockfile >> "$LOG" 2>&1; then
     echo "!!! INSTALL attempt 1 failed for $TAG, retrying..." >> "$LOG"
     sleep 3
     pnpm install --frozen-lockfile >> "$LOG" 2>&1 || { echo "!!! INSTALL FAILED (after retry) for $TAG at $(date)" >> "$LOG"; exit 1; }
   fi
   ```
3. **升级 pnpm**：9.15.4 → 11.x（日志一直在提示）。注意先小范围验证（升级会影响 CI 与本地，需回归 `pnpm install` 与 `pnpm build`）。
4. **容忍式跳过（激进，不建议首选）**：install 失败但 `node_modules` 完整且 lockfile 未变化时跳过 install 继续 build。风险高，需谨慎。

## 九、注意事项

- **发版流程遵循项目约定**：push `main` 不触发部署，只有 `v*.*.*` tag 触发。发版命令 `git tag v<版本号> && git push origin v<版本号>`。
- **不要改部署主链路时用 `main` 直接验证**：改动 deploy.sh 属于服务器文件（不在 git 仓库内？—— 注意：`scripts/deploy.sh` 在仓库中有收录，见 `scripts/` 目录；如修改应一并提交，遵循 AGENTS.md「修改脚本后同步更新 README/AGENTS.md/docs」）。
- deploy.log 中 `WEBHOOK_SECRET` 明文出现在 `blogus-webhook.sh`，**勿外传此文件**；排查日志如涉及密钥注意脱敏。
- 手动补跑命令（应急用）：
  ```bash
  export PATH=$HOME/.local/node/bin:$PATH
  cd ~/projects/blogus && pnpm install --frozen-lockfile && pnpm build && pm2 restart blogus
  ```

## 十、相关背景（历史问题参考）

- v0.1.8：`git fetch` 挂死（HTTP2 层），已加超时 + 浅拉兜底。
- v0.1.9：webhook 未触发，当时修复后恢复。
- v0.2.0 / v0.2.1：install 退出码异常（本文档主题）。

## 十一、2026-08-18 本地复核补充（结论与已落地修复）

### 1. 36 秒滞留是新的关键证据

v0.2.1 从 `started at 10:29:55` 到 `INSTALL FAILED at 10:30:31` 共 **36 秒**，而 install 日志显示本体 `Done in 1.8s`。fetch 兜底（浅拉单 tag）仅数秒。剩余约 20s+ 是 pnpm 进程在**输出完成后仍未退出**——与 update-notifier 异步检查 registry（网络慢/超时）的窗口吻合，最终以非 0 退出。

> 日志干净 + 退出码非 0 + 伴随 `Update available!` 提示，三条证据闭环，指向 pnpm 自身的收尾流程（update-notifier），而非 install 本身。

### 2. 缓存窗口解释"为何手动补跑必成功"

pnpm 的更新检查有约 24h 间隔缓存。webhook 失败那次已完成检查并缓存（提示已打印），**手动补跑发生在缓存窗口内 → 不再检查 → 无提示 → exit 0**。

推论（重要）：**文档第七节步骤 3 的 `setsid` 复现不能立刻做**——缓存未过期时不复现。需等约 24h，或先清掉 pnpm 更新检查缓存（`~/.config/pnpm` 下相关缓存文件）后再复现。

### 3. 同族已知 bug 佐证

pnpm 官方存在多起"install 成功但退出码 1"的 issue（如 #9449、#8859，strictPeerDependencies 场景，pnpm 10.x 修复），证实这是 pnpm 自身的行为缺陷家族，而非本项目代码/锁文件问题。本项目场景（lockfile 未变 + Already up to date）与 #9449 的 clean-install 场景不同，但同属"成功但非 0 退出"。

### 4. 已落地修复（`scripts/deploy.sh`）

- `export NO_UPDATE_NOTIFIER=1`（deploy.sh 第 10 行 PATH export 旁）——禁用升级提示，成本与风险均为 0，无论 H1 具体是哪个机制都能覆盖。
- install 失败重试一次（与 build 现有策略一致，sleep 3 后重试）——**重试时处于缓存窗口内，等效"手动补跑"场景（历史上手动 100% 成功）**，双保险。
- 重试日志中记录首次失败的真实退出码（`cmd || INSTALL_EXIT=$?` 技巧，注意 `if ! cmd` 会丢失原始退出码），便于后续排查。

### 5. 传播路径注意事项

服务器每次部署先 `git checkout $TAG`：正在执行的**旧** deploy.sh 会把新 tag 里的 deploy.sh 文件更新到磁盘，但**本次运行仍是旧逻辑**。因此新脚本要等下一次部署才生效：

- 若 v0.2.2 部署时 install 又失败 → 属于旧脚本预期行为，手动补跑即可（服务器代码已切换为新 tag）。
- v0.2.3 起跑的就是新 deploy.sh，预期不再复现；若仍失败，deploy.log 里会有 `INSTALL attempt 1 failed (exit=N)` 的真实退出码。
