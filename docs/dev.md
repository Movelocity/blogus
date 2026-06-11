## CLI 使用约定

```bash
pnpm --filter @blogus/cli dev --help
pnpm --filter @blogus/cli dev register -e admin@example.com -p blogus-dev-password
pnpm --filter @blogus/cli dev invite create -c team-code
pnpm --filter @blogus/cli dev register -e writer@example.com -p blogus-dev-password -i team-code
pnpm --filter @blogus/cli dev post list
pnpm --filter @blogus/cli dev post create -t "Hello Blogus" -f ./draft.md -e "短摘要" --tags "blogus,release"
pnpm --filter @blogus/cli dev post edit <post-id> --cover /uploads/2026/06/cover.png --tags "blogus,release"
pnpm --filter @blogus/cli dev post publish <post-id>
pnpm --filter @blogus/cli dev upload ./cover.png
```

## 阶段 3 内容编辑约定

- 管理端 `/admin` 支持文章列表、创建草稿、编辑 Markdown、预览、安全渲染、上传封面、上传插图、发布、撤回和删除。
- 前台文章详情页使用 `/posts/:slug`，公开请求只读取已发布文章；管理态读取草稿需要登录并传 `visibility=all`。
- 文章元数据包含 `excerpt`、`coverImageUrl` 和 `tags`。CLI 的标签用英文逗号分隔，最多保留 12 个。
- 上传默认使用 `STORAGE_DRIVER=local`，文件保存到 `UPLOAD_DIR` 并通过 `UPLOAD_PUBLIC_PATH` 返回可访问 URL。
- 需要 S3 兼容存储时再设置 `STORAGE_DRIVER=minio` 和 `MINIO_*`；MinIO 是可选后端，不作为默认开发依赖。

## 阶段 4 前台体验约定

- 前台公开导航只展示文章和归档，不暴露管理端入口；管理端仍可通过 `/admin` 直接访问。
- 首页 `/` 只请求已发布文章，并提供加载态、空站点状态和接口错误状态。
- 归档页 `/archive` 按发布时间月份分组，只展示已发布文章。
- 文章详情页 `/posts/:slug` 保持 slug 直达，展示发布时间、阅读时长、标签、摘要和安全 Markdown 正文。

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
