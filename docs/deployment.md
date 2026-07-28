# 部署指南

## 前置要求

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

## 快速部署（推荐）

后端直接托管前端构建产物，单进程即可运行：

```bash
# 1. 克隆并安装
git clone <repo-url> blogus && cd blogus
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置：
#   DATABASE_URL=postgres://user:pass@host:5432/blogus
#   JWT_SECRET=$(openssl rand -hex 32)
#   NODE_ENV=production
#   SERVE_CLIENT=true

# 3. 构建并启动
make serve
```

服务启动后访问 `http://<host>:3009`，API 和前端由同一端口提供。

也可以分步执行：

```bash
make build    # 构建
make start    # 启动
```

## 进程管理

### PM2

```bash
npm i -g pm2

# ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "blogus",
    script: "server/dist/index.js",
    cwd: "/path/to/blogus",
    env: {
      NODE_ENV: "production",
      SERVE_CLIENT: "true",
      JWT_SECRET: "<密钥>",
      DATABASE_URL: "postgres://..."
    }
  }]
};

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 开机自启
```

### systemd

```ini
# /etc/systemd/system/blogus.service
[Unit]
Description=Blogus
After=network.target postgresql.service

[Service]
Type=simple
User=blogus
WorkingDirectory=/opt/blogus
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=SERVE_CLIENT=true
Environment=JWT_SECRET=<密钥>
Environment=DATABASE_URL=postgres://...

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now blogus
```

## 反向代理（可选）

如果需要 HTTPS 或自定义域名，可以在前端加 nginx：

```nginx
server {
    listen 443 ssl;
    server_name blog.example.com;

    ssl_certificate     /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3009;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

此时 `SERVE_CLIENT=true` 仍然有效，nginx 只做 TLS 终结和域名路由。

## 更新流程

```bash
cd /opt/blogus
git pull
pnpm install
make build
# 重启进程管理器
pm2 restart blogus    # 或 systemctl restart blogus
```

## 健康检查

```bash
curl http://127.0.0.1:3009/api/health
```

返回 `{ "ok": true, "db": "connected", "storage": { "ok": true, "driver": "local" } }` 表示正常。

## 环境变量参考

| 变量 | 必须 | 说明 |
|------|------|------|
| `NODE_ENV` | 是 | 设为 `production` |
| `JWT_SECRET` | 是 | 随机密钥，禁止使用 `dev-secret` |
| `DATABASE_URL` | 是 | PostgreSQL 连接地址 |
| `SERVE_CLIENT` | 推荐 | `true` 时后端托管前端，单端口部署 |
| `HOST` | 否 | 监听地址，默认 `127.0.0.1`，外网访问设 `0.0.0.0` |
| `PORT` | 否 | 监听端口，默认 `3009` |
| `STORAGE_DRIVER` | 否 | `local`（默认）或 `minio` |
| `UPLOAD_DIR` | 否 | 本地上传目录，默认 `./uploads` |
| `REDIS_URL` | 否 | Redis 连接地址（当前未实际使用） |
| `MINIO_*` | 否 | MinIO 配置，仅 `STORAGE_DRIVER=minio` 时需要 |
