# 账号服务部署说明（第一期）

作用：登录、总后台开子账号 / 设权限 / 停用 / 重置密码，并且可以**顺带托管前端页面**（推荐：前后端放同一台服务器、同一个域名，这样没登录的人拿不到页面）。

## 1. 需要什么
- 一台 Linux 服务器（Ubuntu 22.04 即可），装 **Node.js 22.5 或更高**（`node -v` 检查）。
- 一个域名（手机浏览器必须 https，没有 https 登录会被拦）。没有域名可以先用免费的 DuckDNS 等，指到服务器 IP。
- 不需要装数据库软件：数据存在一个 SQLite 文件里（Node 自带），默认 `./data/accounts.db`，**要定期备份这个文件**。
- 零第三方依赖，不用 `npm install`。

## 2. 环境变量
| 变量 | 必填 | 说明 |
|---|---|---|
| `AUTH_SECRET` | 是 | 签发登录凭证的密钥，≥24 位随机字符串。`openssl rand -hex 32` 生成。换了它所有人都要重新登录 |
| `ADMIN_PHONE` | 首次 | 总账号手机号（你自己的号码）。只有数据库里还没有总账号时才会用 |
| `ADMIN_PASSWORD` | 首次 | 总账号初始密码，≥6 位。登录后建议立刻在后台改掉 |
| `PORT` | 否 | 默认 8787 |
| `HOST` | 否 | 默认 127.0.0.1（只让本机的 Caddy/Nginx 转发）。想直接对外就设 0.0.0.0 |
| `DB_PATH` | 否 | 数据库文件，默认 `./data/accounts.db` |
| `STATIC_DIR` | 推荐 | 前端打包目录（见第 3 步）。设了就由本服务托管页面 |
| `ALLOWED_ORIGINS` | 否 | 前端和后端不在同一域名时才需要，逗号分隔，如 `https://xxx.github.io` |
| `TRUST_PROXY` | 否 | 放在 Caddy/Nginx 后面时设 `1`，登录限频才能按真实 IP 统计 |
| `TOKEN_DAYS` | 否 | 登录有效天数，默认 30 |

## 3. 前端怎么打包（带账号功能的版本）
账号功能默认**关闭**（GitHub Pages 上现在的网站不受影响）。要启用，构建时加环境变量：
```bash
VITE_AUTH_ENABLED=1 pnpm -F @fake-world/web build      # 前后端同域名：API 走相对路径，不用设 VITE_API_BASE
# 前后端不同域名时再加：VITE_API_BASE=https://api.你的域名
```
产物在 `packages/web/dist`。把整个 `dist` 目录上传到服务器，例如 `/opt/fake-world/dist`，`STATIC_DIR` 指向它。
> 也可以在 GitHub 的 Actions 里手动运行 “Build auth bundle”，下载产物，不用在服务器上装 pnpm。

## 4. 启动
```bash
cd /opt/fake-world/server
export AUTH_SECRET=$(openssl rand -hex 32)   # 只第一次生成，要保存起来，下次启动还用同一个
export ADMIN_PHONE=你的手机号  ADMIN_PASSWORD=初始密码
export STATIC_DIR=/opt/fake-world/dist HOST=127.0.0.1 PORT=8787 TRUST_PROXY=1
node --disable-warning=ExperimentalWarning index.mjs
```
### 用 systemd 常驻（推荐）
`/etc/systemd/system/fake-world.service`：
```ini
[Unit]
Description=fake-world accounts
After=network.target
[Service]
WorkingDirectory=/opt/fake-world/server
EnvironmentFile=/opt/fake-world/server.env
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning index.mjs
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
```
`/opt/fake-world/server.env`（权限设为 600）：
```
AUTH_SECRET=……
ADMIN_PHONE=……
ADMIN_PASSWORD=……
STATIC_DIR=/opt/fake-world/dist
HOST=127.0.0.1
PORT=8787
TRUST_PROXY=1
```
然后 `systemctl enable --now fake-world`。

### https（Caddy，自动申请证书）
`/etc/caddy/Caddyfile`：
```
你的域名 {
    reverse_proxy 127.0.0.1:8787
}
```

## 5. 用法
1. 浏览器打开你的域名 → 用 `ADMIN_PHONE` / `ADMIN_PASSWORD` 登录（总账号，原来的数据都在）。
2. 「我 → 设置」里有 **总后台（账号与权限）**：新建账号、给剧情账号开关各项权限、重置密码、停用。
3. 子账号（比如你的安卓手机）用开通的手机号和密码登录。**每个账号的本机数据互相隔离**，不会互相覆盖。
4. 停用 / 重置密码后，对方已登录的设备下次请求立刻失效。

## 6. 要知道的限制
- 权限开关控制的是界面功能（改余额、编辑模式、AI 等）。页面代码在对方手机上运行，**挡得住普通人，挡不住会改代码的人**。要真正防扩散：把 GitHub 仓库设为 Private，并且只通过这台服务器发放页面（不要再用公开的 GitHub Pages 网址）。
- 真实账号（role=real）第一期只显示“账号已开通”的落地页；真实好友和实时聊天在第二期。
- 登录失败 8 次会锁 10 分钟（按 IP + 手机号）。
- 没有“忘记密码”：由总账号在后台重置。
