---
argument-hint: [--auto] [--all] [--amend]
description: 分析暂存区变更，生成符合项目风格的 commit message 并提交
---

# Commit Message

分析当前 git 变更，生成符合项目风格的 commit message 并提交。

## 参数

- `--auto`: 自动识别是否需要自动暂存，遇到默认忽略的改动出现(pycache, node_modules)时，遇到特殊配置文件询问用户；自动暂存并生成message后提交
- `--all`：自动暂存所有已跟踪文件的修改（不含未跟踪文件）
- `--amend`：修改上一次 commit 的 message

## 流程

### 1. 检查状态

```bash
git status
git diff --cached --stat
git diff --stat
```

如果没有暂存文件且未传 `--all`，提示用户先 `git add`。

### 2. 分析变更

```bash
git diff --cached
```

理解变更内容，判断：
- 变更类型（feat/fix/refactor/chore/docs/style/perf/test）
- 是否涉及多个不相关逻辑（建议拆分）
- 是否需要 body 补充说明

### 3. 生成 commit message

**格式**：
```
<type>: <简短描述>

<body（可选，仅在变更复杂时添加）>
```

**规则**：
- 第一行不超过 72 字符
- 描述语言与代码/注释风格一致（中文优先，英文变更可用英文）
- 不加 emoji 前缀
- 可选 scope（如 `feat(auth):`）
- **不加 Co-Authored-By 行**
- body 用中文，列点说明变更细节，解释 **为什么** 而非怎么做
- type 对照：

| type | 含义 |
|------|------|
| feat | 新功能 |
| fix | 修复 bug |
| docs | 仅文档变更 |
| style | 格式/样式调整，不影响逻辑 |
| refactor | 重构，既非新功能也非修复 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具/配置等杂项 |

### 4. 提交

用 HEREDOC 格式提交，确保多行消息正确传递：

```bash
git commit -m "$(cat <<'EOF'
<type>: <描述>

<body>
EOF
)"
```

### 5. 输出结果

提交后执行 `git log --oneline -1` 确认，输出一行总结。

## 注意

- 暂存区有多种变更时，评估是否应拆成多个 commit，向用户建议
- 用户可在 args 中追加文本作为额外上下文（如 `/commit-message 修复登录问题`），生成 message 时参考
