# 一键部署（宝塔 Linux）

目标环境：

- 阿里云 ECS：`120.79.223.151`
- 主域名 `zhangxianjue.com` → client
- 二级域名 `admin.zhangxianjue.com` → admin
- 宝塔已安装 Node.js、MySQL、PM2、Nginx

脚本：[`deploy.sh`](./deploy.sh)。它负责构建、写环境变量、建库（可选）、迁移、创建管理员（可选）、启动 PM2、写 Nginx 配置并重载。

## 1. 宝塔面板准备

### 1.1 软件版本

在宝塔「软件商店」确认：

- **Node.js 22.12+**（项目使用 `--experimental-transform-types`）
- MySQL 5.7 / 8.0
- PM2（如果命令不存在，在 SSH 执行 `npm i -g pm2`）
- Nginx

### 1.2 建两个站点

宝塔 →「网站」→「添加站点」：

| 域名 | 根目录 | PHP |
| :--- | :--- | :--- |
| `zhangxianjue.com` | `/www/wwwroot/zhangxianjue/apps/client/dist` | 纯静态 |
| `admin.zhangxianjue.com` | `/www/wwwroot/zhangxianjue/apps/admin/dist` | 纯静态 |

> ✅ 建议先在宝塔建站点再跑脚本：这样宝塔有站点记录，后续可以直接在面板申请 SSL。
> 脚本会把两个站点的 Nginx 配置替换成「静态文件 + `/api` / `/uploads` 反代」，
> 覆盖前自动备份；检测到配置里已有 SSL 时会跳过，避免把证书配置冲掉。

### 1.3 安全组 / 防火墙

阿里云安全组与宝塔防火墙放行：

- `80`
- `443`
- `22`（建议只放行自己的 IP）

不要放行 `3000`、`3306`。

## 2. 上传代码

推荐 Git：

```bash
cd /www/wwwroot
git clone <你的仓库地址> zhangxianjue
```

也可以直接用宝塔文件管理把整个仓库上传到 `/www/wwwroot/zhangxianjue`。

最终目录应包含：

```text
/www/wwwroot/zhangxianjue/
├── apps/
├── packages/
├── server/
├── deploy/
├── package.json
└── package-lock.json
```

## 3. 填写部署配置

```bash
cd /www/wwwroot/zhangxianjue
cp deploy/deploy.env.example deploy/deploy.env
chmod 600 deploy/deploy.env
vi deploy/deploy.env
```

至少确认：

```ini
CLIENT_DOMAIN=zhangxianjue.com
ADMIN_DOMAIN=admin.zhangxianjue.com

DB_NAME=zhangxianjue_database
DB_USER=zhangxianjue
DB_ROOT_PASSWORD='宝塔 MySQL root 密码'

# 全新数据库时建议填写，脚本会自动创建管理员
ADMIN_USERNAME=你的管理员用户名
ADMIN_PHONE=你的手机号
ADMIN_PASSWORD='你的管理员密码'
```

说明：

- `DB_PASSWORD`、`JWT_SECRET` 留空会自动生成并写回 `deploy.env`
- `DB_ROOT_PASSWORD` 只用于首次建库，不会写入 `server/.env`
- 已有数据库 / 已有管理员时，`DB_ROOT_PASSWORD` 与管理员的三个字段都可以留空
- `deploy.env` 已被 `.gitignore` 忽略
- `server/.env` 每次部署都会由脚本重新生成；要改端口 / 上传目录 / 数据库等，请改 `deploy/deploy.env`
- `UPLOAD_DIR` 留空时默认是 `<仓库>/server/uploads`。如果用宝塔「上传」覆盖整个代码目录，先把该目录备份；也可以把 `UPLOAD_DIR` 指到代码目录之外，例如 `/www/wwwroot/zhangxianjue-data/uploads`

## 4. 迁移已有数据（可选）

如果要把当前本地内容搬到服务器：

本地 Windows（在仓库根目录）：

```bash
mysqldump -u root -p --single-transaction --routines --triggers \
  zhangxianjue_database > zhangxianjue.sql

scp zhangxianjue.sql root@120.79.223.151:/tmp/zhangxianjue.sql
scp -r server/uploads root@120.79.223.151:/tmp/zhangxianjue-uploads
```

在 `deploy/deploy.env` 中填写：

```ini
IMPORT_SQL=/tmp/zhangxianjue.sql
IMPORT_UPLOADS=/tmp/zhangxianjue-uploads
```

> 脚本只在目标数据库为空时导入 SQL，不会覆盖已有线上数据。

## 5. 一键部署

```bash
cd /www/wwwroot/zhangxianjue
sudo bash deploy/deploy.sh
```

脚本会依次：

1. 探测 Node / npm / PM2 / Nginx / MySQL 与宝塔 Nginx 配置目录
2. 生成缺失的 `JWT_SECRET`、数据库密码
3. 写入 `server/.env` 与两个前端的 `.env.production`
4. 执行 `npm ci`
5. 构建 `packages/*` 与 admin / client
6. 创建数据库与账号（填了 `DB_ROOT_PASSWORD` 时）
7. 导入 `IMPORT_SQL` / `IMPORT_UPLOADS`（可选）
8. 执行 `sequelize db:migrate`
9. 创建或升级管理员（填了 `ADMIN_PASSWORD` 时）
10. 启动 / 重载 PM2
11. 写两个域名的 Nginx 配置并重载
12. 健康检查

成功后会打印：

```text
client： http://zhangxianjue.com
admin：  http://admin.zhangxianjue.com
```

## 6. 申请 HTTPS

推荐在宝塔面板操作：

1. 网站 → `zhangxianjue.com` → SSL → Let's Encrypt → 申请
2. 网站 → `admin.zhangxianjue.com` → SSL → Let's Encrypt → 申请

脚本重新部署时会检测配置中的 `ssl_certificate`，自动跳过 Nginx 覆盖，不会冲掉证书。

如果宝塔没有站点记录，也可以使用 certbot：

```bash
apt install -y certbot
certbot certonly --webroot \
  -w /www/wwwroot/zhangxianjue/apps/client/dist \
  -d zhangxianjue.com

certbot certonly --webroot \
  -w /www/wwwroot/zhangxianjue/apps/admin/dist \
  -d admin.zhangxianjue.com
```

然后手动把 443 server 块加进宝塔 Nginx 配置。

## 7. 日常更新

```bash
cd /www/wwwroot/zhangxianjue
git pull --ff-only
sudo bash deploy/deploy.sh
```

- 依赖没变时可设 `SKIP_INSTALL=1`
- 如果 Nginx 配置被检测到 SSL 而跳过，但你又改了端口 / 根目录，可临时 `FORCE_NGINX=1`
  （会覆盖配置，需重新配置 SSL）

PM2 常用命令：

```bash
pm2 status
pm2 logs zhangxianjue-api
pm2 restart zhangxianjue-api
```

首次启动后执行一次：

```bash
pm2 startup
pm2 save
```

按 PM2 提示复制并执行它输出的那条命令。

## 8. 常见问题

### 502 Bad Gateway

```bash
pm2 logs zhangxianjue-api --lines 100
```

检查：

- `server/.env` 是否存在且 `chmod 600`
- 数据库是否可连
- `server/src/config/config.json` 的 `production` 段不再需要手填密码，`DB_*` 会覆盖

### 数据库连接失败

在宝塔「数据库」页确认数据库与用户已创建，或填写 `DB_ROOT_PASSWORD` 后重跑脚本。

手动 SQL：

```sql
CREATE DATABASE zhangxianjue_database
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zhangxianjue'@'127.0.0.1' IDENTIFIED BY 'deploy.env 中的 DB_PASSWORD';
GRANT ALL PRIVILEGES ON zhangxianjue_database.* TO 'zhangxianjue'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 找不到 Node / PM2

宝塔的 Node 通常在 `/www/server/nodejs/<版本>/bin/`。在 `deploy.env` 指定：

```ini
NODE_BIN=/www/server/nodejs/v22.20.0/bin/node
NPM_BIN=/www/server/nodejs/v22.20.0/bin/npm
PM2_BIN=/www/server/nodejs/v22.20.0/bin/pm2
```

### 上传图片 413

脚本已经设置 `client_max_body_size 10m`。如果改过 Nginx 配置，确认这个值仍然存在。

### 报 `$'\r': command not found`

脚本被 Windows 编辑成了 CRLF，执行一次：

```bash
sed -i 's/\r$//' deploy/deploy.sh deploy/deploy.env.example
```

### 生产环境不要做

- ❌ 不要执行 `db:seed:all`：演示账号密码是公开的
- ❌ 不要开启 `DEV_LOGIN_ENABLED`
- ❌ 不要把 `server/.env`、`deploy/deploy.env` 提交到 Git
- ❌ 不要继续使用本地开发的管理员密码
