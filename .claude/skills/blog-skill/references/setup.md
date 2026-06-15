
# blogus-cli 操作指南

## 安装

```bash
# 检查是否已安装
which blogus-cli || echo "未安装"
```

未安装时，进入项目目录执行：

```bash
# 项目根目录下
make install-cli
```

该命令会构建 CLI 并通过 `npm link` 全局链接，之后 `blogus-cli` 即可全局使用。

如需更新（代码有改动后重新执行同一命令即可）：

```bash
make install-cli
```

前提条件：项目依赖已安装（`make install`），Node.js 和 pnpm 可用。