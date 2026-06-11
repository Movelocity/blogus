## CLI 使用约定

```bash
pnpm --filter @blogus/cli dev --help
pnpm --filter @blogus/cli dev register -e admin@example.com -p blogus-dev-password
pnpm --filter @blogus/cli dev invite create -c team-code
pnpm --filter @blogus/cli dev register -e writer@example.com -p blogus-dev-password -i team-code
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