# AGENTS.md

本文件记录在 Blogus 仓库中协作时须遵守的约束，避免 Agent 做出不符合维护习惯或用户预期的操作。

## 语言与沟通

- 默认使用中文回复。
- 执行有副作用的操作前，先说明将要做什么。
- 遇到用户明确表达“不接受这种写法/流程”时，可以先提供方案选择，选好再继续，避免做无用功。

## 状态检查与执行前置

- 执行构建镜像、启动容器、停止容器、重启容器、拉取镜像等非纯代码任务前，先检查当前状态，避免重复启动、端口冲突或打断用户已有服务。

## CLI 使用约定

```bash
pnpm --filter @blogus/cli dev --help
pnpm --filter @blogus/cli dev login -e dev@example.com -p blogus-dev-password
pnpm --filter @blogus/cli dev post list
```

## 开发与验证

- 每个阶段完成前至少运行：

```bash
pnpm typecheck
```

- 服务端测试使用：

```bash
pnpm --filter @blogus/server test
```

- 如果测试工具因沙箱限制无法创建本地 IPC、临时 socket 或访问 localhost，应说明失败原因，并按工具权限流程请求提升权限后重跑。
- 如果测试需要依赖服务，先检查服务是否已经运行；没有运行且启动不会造成冲突时，可以按项目脚本启动。

## 文档维护

- 修改脚本或推荐命令后，同步更新 `README.md` 和 `docs/*` 系列文档。
