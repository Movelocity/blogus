# AGENTS.md

本文件记录在 Blogus 仓库中协作时须遵守的约束，避免 Agent 做出不符合维护习惯或用户预期的操作。

## 语言与沟通

- 默认使用中文回复。
- 长期主义，不做短期有效但有损项目长期开发的事。
- 发现隐患，或不得已使用过度方案时，请告知用户。
- 执行有副作用的操作前，先说明将要做什么。
- 遇到用户明确表达“不接受这种写法/流程”时，可以先提供复数个方案供选择，选好再继续，避免做无用功。

## 状态检查与执行前置

- 执行构建镜像、启动容器、停止容器、重启容器、拉取镜像等非纯代码任务前，先检查当前状态，避免重复启动、端口冲突或打断用户已有服务。

## 文档维护

- 开发阶段的脚本命令可以看 [DEV.md](./DEV.md)
- 修改脚本或推荐命令后，同步更新 `README.md`(给人看)、`AGENTS.md`(给Coding Agent看) 和 `docs/*` 系列文档。

## 前端工具页

- 图片编辑器路由为 `/tools/image-editor`，必须保持 React lazy 独立加载，不得引入博客正文布局或后端图片接口。
- 卡片笔记路由为 `/tools/text-cards`，同样 lazy 独立 chunk、全屏画布工具页、不套 `BlogLayout`；数据经 `/api/text-cards` 持久化，需登录。
- 工具入口只放在共享页脚，不加入 `Navigation.tsx`；图片内容仅在浏览器内存中处理；「卡片笔记」仅登录后在页脚显示。

## 发版流程

- push `main` 不触发部署，只有打 `v*.*.*` tag 才自动部署
- 推荐发版：`make release-patch`（自动递增 patch 并推送 tag）；或 `make release VERSION=v0.3.12` 指定版本
- `make release-next` 可预览下一 patch 版本号，不执行发布
- 底层等价于：`git push origin main && git tag v<版本号> && git push origin v<版本号>`
- 服务器 webhook 在 9000 端口，由 pm2 管理（`blogus-webhook`）
- 部署日志在服务器 `~/projects/blogus/deploy.log`
- webhook 部署失败时，SSH 到服务器补跑：`make deploy TAG=v<版本号>`（等价于 `bash scripts/deploy.sh`）
- 日常发版优先用 tag 触发 webhook，仅在自动部署失败时手动补跑
