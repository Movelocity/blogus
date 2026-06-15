---
name: blog-skill
description: edit, publish blog posts
---

## 前置流程

先执行指令检测登录情况
```bash
blogus-cli whoami
```

CLI 未安装时，进入项目目录执行：

```bash
# 项目根目录下
make install-cli
```

## 文章生命周期

```
draft ──publish──→ published ──unpublish──→ draft
                       │
                       └──archive──→ archived ──unarchive──→ draft

任意状态 ──delete──→ 硬删除
```

关键语义：
- 归档仅对 published 文章有效，草稿不可归档
- 取消归档回到 draft，不会自动重新发布
- archived 文章对访客不可见（直链 404）

## 文章命令

### 列表

```bash
blogus-cli post list                # 全部文章
blogus-cli post list -s published   # 仅已发布
blogus-cli post list -s draft       # 仅草稿
blogus-cli post list -s archived    # 仅归档
```

输出格式（tab 分隔）：`<id>\t<status>\t<slug>\t<title>`

### 创建

```bash
# 从文件创建草稿
blogus-cli post create -t "标题" -f content.md

# 创建并直接发布
blogus-cli post create -t "标题" -f content.md -p

# 带摘要、封面、标签
blogus-cli post create -t "标题" -f content.md -e "摘要" -c "https://example.com/cover.jpg" --tags "tag1,tag2"
```

- `-f` 接收 Markdown 文件路径，非内联内容
- 创建成功输出文章 ID，后续命令以此 ID 操作

### 编辑

```bash
# 替换正文
blogus-cli post edit <id> -f new-content.md

# 修改标题
blogus-cli post edit <id> -t "新标题"

# 修改状态（等同于专用命令）
blogus-cli post edit <id> -s archived

# 组合修改
blogus-cli post edit <id> -f new-content.md -t "新标题" --tags "a,b"
```

### 状态变更

```bash
blogus-cli post publish <id>     # 草稿 → 已发布
blogus-cli post unpublish <id>   # 已发布 → 草稿（撤回）
blogus-cli post archive <id>     # 已发布 → 已归档
blogus-cli post unarchive <id>   # 已归档 → 草稿
blogus-cli post delete <id>      # 硬删除（不可恢复）
```

### 图片上传

```bash
blogus-cli upload ./image.png
# 输出图片 URL，可直接用于 Markdown: ![](url)
```

## 典型发布流程

```bash
# 1. 写好 Markdown 文件
# 2. 创建草稿
POST_ID=$(blogus-cli post create -t "文章标题" -f article.md)

# 3. 预览列表确认
blogus-cli post list -s draft

# 4. 发布
blogus-cli post publish "$POST_ID"

# 5. 后续归档
blogus-cli post archive "$POST_ID"
```

## 注意事项

- 所有命令依赖登录状态，未登录会报 401
- `post list` 的 `-s` 筛选在服务端执行，不做前端过滤
- `post edit` 的 `-f` 会替换整个正文，非追加
- 环境变量 `BLOGUS_API_URL` 可覆盖默认服务地址（默认 `http://127.0.0.1:3009`）

## 相关文档 

- `./references/auth.md` 认证方式
- `./references/setup.md` CLI 安装指导
