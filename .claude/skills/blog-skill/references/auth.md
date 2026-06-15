## 认证

```bash
# 登录（非交互式）
blogus-cli login -e <email> -p <password>

# 环境变量方式（避免密码出现在进程列表）
BLOGUS_PASSWORD=<password> blogus-cli login -e <email>

# 使用已有 token
blogus-cli login -t <access-token>

# 检查当前身份
blogus-cli whoami

# 退出
blogus-cli logout
```

配置存储于 `~/.blogus-cli/config.json`，token 自动附加到后续请求。