#!/usr/bin/env bash
# 一键部署：Node 22 + PM2 + MySQL + Nginx（宝塔环境适配）
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CONFIG_FILE="$SCRIPT_DIR/deploy.env"
EXAMPLE_FILE="$SCRIPT_DIR/deploy.env.example"

log()  { printf '\033[32m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[deploy]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[deploy]\033[0m %s\n' "$*" >&2; exit 1; }

trap 'printf "\033[31m[deploy]\033[0m 部署失败，位置：第 %s 行\n" "$LINENO" >&2' ERR

# ===== 0. root / 配置 =====
if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo bash "$SCRIPT_DIR/$(basename "$0")" "$@"
fi

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  die "缺少 $EXAMPLE_FILE"
fi
if [[ ! -f "$CONFIG_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  log "已生成 $CONFIG_FILE"
fi

# 兼容 Windows 编辑后上传的 CRLF 配置文件
sed -i 's/\r$//' "$CONFIG_FILE"

set -a
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-zhangxianjue_database}"
DB_USER="${DB_USER:-zhangxianjue}"
DB_ROOT_USER="${DB_ROOT_USER:-root}"
SERVER_PORT="${SERVER_PORT:-3000}"
PM2_NAME="${PM2_NAME:-zhangxianjue-api}"
CLIENT_DOMAIN="${CLIENT_DOMAIN:-zhangxianjue.com}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.zhangxianjue.com}"
UPLOAD_DIR="${UPLOAD_DIR:-$SERVER_DIR/uploads}"
if [[ "$UPLOAD_DIR" != /* ]]; then
  UPLOAD_DIR="$ROOT_DIR/$UPLOAD_DIR"
fi
FORCE_NGINX="${FORCE_NGINX:-0}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

[[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || die "DB_NAME 只能包含字母、数字、下划线"
[[ "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]] || die "DB_USER 只能包含字母、数字、下划线"
[[ "$PM2_NAME" =~ ^[A-Za-z0-9_-]+$ ]] || die "PM2_NAME 只能包含字母、数字、下划线、连字符"
[[ "$SERVER_PORT" =~ ^[0-9]+$ ]] || die "SERVER_PORT 必须为数字"
[[ "$CLIENT_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "CLIENT_DOMAIN 格式不正确"
[[ "$ADMIN_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || die "ADMIN_DOMAIN 格式不正确"

case "${DB_PASSWORD:-}" in
  *"'"*|*"\\"*) die "DB_PASSWORD 不能包含单引号或反斜杠；留空由脚本自动生成即可" ;;
esac

save_var() {
  local key="$1" value="$2"
  local escaped
  escaped="$(printf '%s' "$value" | sed -e 's/[&|]/\\&/g')"
  if grep -q "^${key}=" "$CONFIG_FILE"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$CONFIG_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$CONFIG_FILE"
  fi
}

gen_hex()      { "$NODE_BIN" -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }
gen_password() { "$NODE_BIN" -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"; }

# ===== 1. 探测命令 =====
detect_commands() {
  if [[ -z "${NODE_BIN:-}" ]]; then
    NODE_BIN="$(ls -d /www/server/nodejs/*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
  fi
  if [[ -z "${NODE_BIN:-}" || ! -x "$NODE_BIN" ]]; then
    NODE_BIN="$(command -v node || true)"
  fi
  [[ -n "$NODE_BIN" ]] || die "未找到 Node.js。请先在宝塔「软件商店」安装 Node 22"

  "$NODE_BIN" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)' \
    || die "Node 版本过低：$("$NODE_BIN" -v)，需要 >= 22.12（项目使用 --experimental-transform-types）"

  if [[ -z "${NPM_BIN:-}" || ! -x "$NPM_BIN" ]]; then
    NPM_BIN="$(dirname "$NODE_BIN")/npm"
  fi
  if [[ ! -x "$NPM_BIN" ]]; then
    NPM_BIN="$(command -v npm || true)"
  fi
  [[ -n "$NPM_BIN" ]] || die "未找到 npm"

  if [[ -z "${PM2_BIN:-}" || ! -x "$PM2_BIN" ]]; then
    PM2_BIN="$(command -v pm2 || true)"
  fi
  if [[ -z "${PM2_BIN:-}" || ! -x "$PM2_BIN" ]]; then
    PM2_BIN="$(dirname "$NODE_BIN")/pm2"
  fi
  [[ -x "$PM2_BIN" ]] || die "未找到 pm2。请执行：$NPM_BIN install -g pm2"

  if [[ -z "${NGINX_BIN:-}" || ! -x "$NGINX_BIN" ]]; then
    NGINX_BIN="/www/server/nginx/sbin/nginx"
  fi
  if [[ ! -x "$NGINX_BIN" ]]; then
    NGINX_BIN="$(command -v nginx || true)"
  fi
  [[ -n "$NGINX_BIN" ]] || die "未找到 Nginx"

  if [[ -z "${MYSQL_BIN:-}" || ! -x "$MYSQL_BIN" ]]; then
    MYSQL_BIN="/www/server/mysql/bin/mysql"
  fi
  if [[ ! -x "$MYSQL_BIN" ]]; then
    MYSQL_BIN="$(command -v mysql || true)"
  fi

  if [[ -d /www/server/panel/vhost/nginx ]]; then
    NGINX_CONF_DIR="/www/server/panel/vhost/nginx"
  elif [[ -d /etc/nginx/conf.d ]]; then
    NGINX_CONF_DIR="/etc/nginx/conf.d"
  else
    die "未找到 Nginx 站点配置目录"
  fi
}

detect_commands
PATH="$(dirname "$NODE_BIN"):$PATH"
export PATH

# ===== 2. 生成缺失的密钥 =====
if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET="$(gen_hex)"
  save_var JWT_SECRET "$JWT_SECRET"
  log "已生成 JWT_SECRET 并写入 $CONFIG_FILE"
fi
if [[ -z "${DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$(gen_password)"
  save_var DB_PASSWORD "$DB_PASSWORD"
  log "已生成数据库密码并写入 $CONFIG_FILE"
fi

mkdir -p "$UPLOAD_DIR"
chmod 750 "$UPLOAD_DIR"

# ===== 3. 写入生产环境文件 =====
write_env_files() {
  if [[ -f "$SERVER_DIR/.env" ]]; then
    cp -a "$SERVER_DIR/.env" "$SERVER_DIR/.env.bak.$(date +%Y%m%d%H%M%S)"
  fi

  umask 077
  cat > "$SERVER_DIR/.env" <<EOF
NODE_ENV=production
PORT=$SERVER_PORT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
UPLOAD_DIR=$UPLOAD_DIR
UPLOAD_MAX_SIZE_MB=5
DEV_LOGIN_ENABLED=false
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
EOF
  chmod 600 "$SERVER_DIR/.env"

  for app in admin client; do
    cat > "$ROOT_DIR/apps/$app/.env.production" <<'EOF'
VITE_API_BASE_URL=/api
VITE_DEV_AUTO_LOGIN=false
VITE_DEV_AUTO_LOGIN_PHONE=
VITE_DEV_AUTO_LOGIN_PASSWORD=
EOF
  done
  umask 022
  log "已写入 server/.env 与两个前端的 .env.production"
}

# ===== 4. 构建 =====
DEV_ENV_BACKUPS=()
restore_dev_envs() {
  local file
  for file in "${DEV_ENV_BACKUPS[@]:-}"; do
    if [[ -n "$file" && -f "$file.deploy-bak" ]]; then
      mv -f "$file.deploy-bak" "$file"
    fi
  done
}
hide_dev_envs() {
  local app name file
  for app in admin client; do
    for name in .env .env.local .env.production.local; do
      file="$ROOT_DIR/apps/$app/$name"
      if [[ -f "$file" ]]; then
        mv -f "$file" "$file.deploy-bak"
        DEV_ENV_BACKUPS+=("$file")
      fi
    done
  done
}
trap 'restore_dev_envs; printf "\033[31m[deploy]\033[0m 部署失败，位置：第 %s 行\n" "$LINENO" >&2' ERR

build_all() {
  cd "$ROOT_DIR"

  if [[ "$SKIP_INSTALL" != "1" ]]; then
    log "安装依赖（npm ci）..."
    # 显式 --include=dev：某些服务器全局 NODE_ENV=production 会跳过构建依赖
    "$NPM_BIN" ci --include=dev --no-audit --no-fund
  fi

  log "构建内部组件库..."
  "$NPM_BIN" run build:markdown
  "$NPM_BIN" run build:markmap

  log "构建 admin / client..."
  hide_dev_envs
  "$NPM_BIN" run build -w admin
  "$NPM_BIN" run build -w client
  restore_dev_envs
  DEV_ENV_BACKUPS=()

  [[ -f "$ROOT_DIR/apps/admin/dist/index.html" ]] || die "admin 构建产物不存在"
  [[ -f "$ROOT_DIR/apps/client/dist/index.html" ]] || die "client 构建产物不存在"

  # Nginx 通常以 www 用户运行，需要能穿过仓库目录读到 dist
  chmod a+rx "$ROOT_DIR" "$ROOT_DIR/apps" "$ROOT_DIR/apps/admin" "$ROOT_DIR/apps/client" 2>/dev/null || true
  chmod -R a+rX "$ROOT_DIR/apps/admin/dist" "$ROOT_DIR/apps/client/dist"

  # 防止开发自动登录凭据进入生产包
  local app phone
  for app in admin client; do
    phone="$(grep -E '^VITE_DEV_AUTO_LOGIN_PHONE=' "$ROOT_DIR/apps/$app/.env" 2>/dev/null | cut -d= -f2- || true)"
    if [[ -n "$phone" ]] && grep -Rq "$phone" "$ROOT_DIR/apps/$app/dist" 2>/dev/null; then
      warn "⚠️ $app 的 dist 中发现开发自动登录手机号，请删除该 app 的 .env 后重新构建"
    fi
  done
}

# ===== 5. 数据库 =====
mysql_app_ok() {
  [[ -n "${MYSQL_BIN:-}" && -x "$MYSQL_BIN" ]] || return 1
  MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
    -e "USE \`$DB_NAME\`" >/dev/null 2>&1
}

mysql_root_ok() {
  local password="$1"
  MYSQL_PWD="$password" "$MYSQL_BIN" -h localhost -uroot -e "SELECT 1" >/dev/null 2>&1 \
    || MYSQL_PWD="$password" "$MYSQL_BIN" -h 127.0.0.1 -uroot -e "SELECT 1" >/dev/null 2>&1
}

# 尝试从宝塔本机文件读取 MySQL root 密码
#
# 不同宝塔版本存放位置不一致，这里按候选依次尝试；读到的值会再用
# mysql root 登录验证，验证失败自动忽略，不会把错误值带到后续流程。
bt_mysql_root_candidates() {
  local file value
  local files=(
    /www/server/panel/data/default.pl
    /www/server/panel/data/mysql_root.pass
    /www/server/panel/data/mysql_root_pass.pl
    /www/server/panel/data/mysql_root.pl
  )
  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    value="$(head -c 1024 "$file" 2>/dev/null | tr -d '\r\n' || true)"
    [[ -n "$value" ]] && printf '%s\n' "$value"
  done

  local jsons=(
    /www/server/panel/data/default.pl
    /www/server/panel/config/mysql.json
    /www/server/panel/config/config.json
  )
  for file in "${jsons[@]}"; do
    [[ -f "$file" ]] || continue
    "$NODE_BIN" -e '
      try {
        const j = require(process.argv[1]);
        const v = j.mysql_root || j.root_password || j.mysql_root_password || j.password || "";
        if (v) process.stdout.write(String(v) + "\n");
      } catch {}
    ' "$file" 2>/dev/null || true
  done
}

ensure_database() {
  if mysql_app_ok; then
    log "数据库连接正常（$DB_NAME）"
    return
  fi

  if [[ -n "${MYSQL_BIN:-}" && -x "$MYSQL_BIN" ]]; then
    if [[ -n "${DB_ROOT_PASSWORD:-}" && ( "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ) ]] && ! mysql_root_ok "$DB_ROOT_PASSWORD"; then
      warn "配置的 DB_ROOT_PASSWORD 无法登录本机 MySQL root，尝试从宝塔配置读取"
      DB_ROOT_PASSWORD=""
    fi

    # 先尝试从宝塔本机配置读取 root 密码；读到的值必须能登录成功才会采用
    if [[ -z "${DB_ROOT_PASSWORD:-}" && ( "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ) ]]; then
      local candidate
      while IFS= read -r candidate; do
        [[ -n "$candidate" ]] || continue
        if mysql_root_ok "$candidate"; then
          DB_ROOT_PASSWORD="$candidate"
          log "已从宝塔本机配置读取 MySQL root 密码"
          break
        fi
      done < <(bt_mysql_root_candidates)
    fi

    if [[ -z "${DB_ROOT_PASSWORD:-}" && -t 0 ]]; then
      read -rsp "MySQL root 密码（用于自动建库，直接回车则跳过）: " DB_ROOT_PASSWORD
      echo
    fi

    if [[ -n "${DB_ROOT_PASSWORD:-}" ]]; then
      local user_host="127.0.0.1"
      local root_host_args=(-h "$DB_HOST" -P "$DB_PORT")
      if [[ "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ]]; then
        # 宝塔的 root@localhost 通常走 socket；若只允许 TCP 则退回 127.0.0.1
        if MYSQL_PWD="$DB_ROOT_PASSWORD" "$MYSQL_BIN" -h localhost -uroot -e "SELECT 1" >/dev/null 2>&1; then
          root_host_args=(-h localhost)
        else
          root_host_args=(-h 127.0.0.1 -P "$DB_PORT")
        fi
      else
        user_host="%"
      fi
      log "使用 $DB_ROOT_USER 创建数据库与账号..."
      MYSQL_PWD="$DB_ROOT_PASSWORD" "$MYSQL_BIN" \
        "${root_host_args[@]}" -u "$DB_ROOT_USER" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'$user_host' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'$user_host' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'$user_host';
FLUSH PRIVILEGES;
SQL
      if mysql_app_ok; then
        log "数据库与账号已就绪"
        return
      fi
    fi
  fi

  cat >&2 <<EOF

❌ 无法连接数据库，请任选一种方式处理：

方式一：在宝塔「数据库」页创建数据库与用户：
  数据库名：$DB_NAME
  用户名：  $DB_USER
  密码：    已写入 $CONFIG_FILE 的 DB_PASSWORD

方式二：在 $CONFIG_FILE 填入 DB_ROOT_PASSWORD 后重新运行脚本。

手动 SQL：
  CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '<$CONFIG_FILE 中的 DB_PASSWORD>';
  GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
EOF
  exit 1
}

import_existing_data() {
  [[ -n "${IMPORT_SQL:-}" ]] || return 0
  [[ -f "$IMPORT_SQL" ]] || die "IMPORT_SQL 文件不存在：$IMPORT_SQL"
  [[ -n "${MYSQL_BIN:-}" && -x "$MYSQL_BIN" ]] || die "导入 SQL 需要 mysql 客户端"

  local table_count
  table_count="$(MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -B \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME'" 2>/dev/null || echo 0)"
  if [[ "$table_count" != "0" ]]; then
    warn "数据库非空（已有 $table_count 张表），跳过 IMPORT_SQL"
    return 0
  fi

  log "导入已有数据库：$IMPORT_SQL"
  MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" < "$IMPORT_SQL"

  if [[ -n "${IMPORT_UPLOADS:-}" && -d "$IMPORT_UPLOADS" ]]; then
    log "复制已有上传文件：$IMPORT_UPLOADS -> $UPLOAD_DIR"
    cp -a "$IMPORT_UPLOADS/." "$UPLOAD_DIR/"
  fi
}

run_migrations() {
  local sequelize_bin="$ROOT_DIR/node_modules/.bin/sequelize-cli"
  if [[ ! -x "$sequelize_bin" ]]; then
    sequelize_bin="$SERVER_DIR/node_modules/.bin/sequelize-cli"
  fi
  [[ -x "$sequelize_bin" ]] || die "未找到 sequelize-cli，请先执行 npm ci"
  log "执行数据库迁移..."
  # 显式传路径，避免宝塔文件管理漏传 .sequelizerc 时找不到配置
  (cd "$SERVER_DIR" && NODE_ENV=production "$sequelize_bin" \
    --config "$SERVER_DIR/src/config/config.cjs" \
    --migrations-path "$SERVER_DIR/src/migrations" \
    --seeders-path "$SERVER_DIR/src/seeders" \
    --models-path "$SERVER_DIR/src/models" \
    db:migrate)
}

admin_exists() {
  [[ -n "${MYSQL_BIN:-}" && -x "$MYSQL_BIN" ]] || return 1
  local count
  count="$(MYSQL_PWD="$DB_PASSWORD" "$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -N -B \
    -e "SELECT COUNT(*) FROM Users u JOIN Roles r ON u.role_id = r.id WHERE r.code = 'admin'" 2>/dev/null || echo 0)"
  [[ "$count" != "0" ]]
}

ensure_admin() {
  if admin_exists; then
    log "管理员账号已存在，跳过创建"
    return 0
  fi

  ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
  if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
    ADMIN_PASSWORD="$(gen_password)"
    save_var ADMIN_USERNAME "$ADMIN_USERNAME"
    save_var ADMIN_PASSWORD "$ADMIN_PASSWORD"
    log "未发现管理员，已自动创建账号「$ADMIN_USERNAME」并把密码写入 $CONFIG_FILE"
  fi
  [[ -n "$ADMIN_USERNAME" ]] || die "ADMIN_USERNAME 不能为空"

  log "检查 / 创建管理员账号..."
  (
    cd "$SERVER_DIR"
    DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
    ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_PHONE="${ADMIN_PHONE:-}" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    "$NODE_BIN" --input-type=module <<'NODE'
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

try {
  const [adminRows] = await conn.execute(
    "SELECT u.id FROM Users u JOIN Roles r ON u.role_id = r.id WHERE r.code = 'admin' LIMIT 1",
  );
  if (adminRows.length > 0) {
    console.log("管理员已存在，跳过");
  } else {
    const [roleRows] = await conn.execute("SELECT id FROM Roles WHERE code = 'admin' LIMIT 1");
    if (roleRows.length === 0) {
      throw new Error("admin 角色不存在，请确认迁移已执行");
    }
    const roleId = roleRows[0].id;
    const username = process.env.ADMIN_USERNAME;
    const phone = process.env.ADMIN_PHONE || null;
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    const [existing] = await conn.execute(
      "SELECT id FROM Users WHERE username = ? OR (phone IS NOT NULL AND phone = ?) LIMIT 1",
      [username, phone],
    );

    if (existing.length > 0) {
      await conn.execute(
        "UPDATE Users SET role_id = ?, password = ?, status = 1, updatedAt = NOW() WHERE id = ?",
        [roleId, passwordHash, existing[0].id],
      );
      console.log("已把现有账号升级为管理员并重置密码");
    } else {
      await conn.execute(
        "INSERT INTO Users (username, phone, avatar, password, role_id, membership_expires_at, status, createdAt, updatedAt) VALUES (?, ?, '', ?, ?, NULL, 1, NOW(), NOW())",
        [username, phone, passwordHash, roleId],
      );
      console.log("管理员账号已创建");
    }
  }
} finally {
  await conn.end();
}
NODE
  )
}

# ===== 6. PM2 =====
write_pm2_config() {
  cat > "$ROOT_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "$PM2_NAME",
      cwd: "$SERVER_DIR",
      script: "src/app.ts",
      interpreter: "$NODE_BIN",
      node_args: "--experimental-transform-types",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
EOF
}

start_server() {
  write_pm2_config
  log "启动 / 重载 PM2 进程 $PM2_NAME..."
  "$PM2_BIN" startOrReload "$ROOT_DIR/ecosystem.config.cjs" --update-env
  "$PM2_BIN" save >/dev/null
}

# ===== 7. Nginx =====
site_conf_path() { printf '%s/%s.conf' "$NGINX_CONF_DIR" "$1"; }

write_site_conf() {
  local domain="$1" server_names="$2" root_dir="$3"
  local file
  file="$(site_conf_path "$domain")"

  if [[ -f "$file" ]]; then
    if grep -qE 'ssl_certificate|listen[[:space:]]+443' "$file" && [[ "$FORCE_NGINX" != "1" ]]; then
      warn "检测到 $file 已启用 HTTPS，跳过覆盖（需要重建请设置 FORCE_NGINX=1，但会移除现有 SSL 配置）"
      return 0
    fi
    cp -a "$file" "$file.bak.$(date +%Y%m%d%H%M%S)"
  fi

  cat > "$file" <<EOF
server {
    listen 80;
    server_name $server_names;

    root "$root_dir";
    index index.html;
    client_max_body_size 10m;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$SERVER_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$SERVER_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  log "已写入 Nginx 配置：$file"
}

configure_nginx() {
  mkdir -p "$NGINX_CONF_DIR"

  write_site_conf "$CLIENT_DOMAIN" "$CLIENT_DOMAIN" "$ROOT_DIR/apps/client/dist"
  write_site_conf "$ADMIN_DOMAIN" "$ADMIN_DOMAIN" "$ROOT_DIR/apps/admin/dist"

  log "检查并重载 Nginx..."
  "$NGINX_BIN" -t
  "$NGINX_BIN" -s reload
}

# ===== 8. 健康检查 =====
health_check() {
  if ! command -v curl >/dev/null 2>&1; then
    warn "未安装 curl，跳过健康检查"
    return 0
  fi

  local i ok=0
  for i in $(seq 1 30); do
    if curl -fsS --max-time 5 "http://127.0.0.1:$SERVER_PORT/api/library/book" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 1
  done
  if [[ "$ok" != "1" ]]; then
    "$PM2_BIN" logs "$PM2_NAME" --lines 40 --nostream || true
    die "后端健康检查失败，请查看上方日志"
  fi
  log "后端健康检查通过"
}

# ===== 9. 主流程 =====
log "仓库目录：$ROOT_DIR"
log "Node：$NODE_BIN"
log "Nginx 配置目录：$NGINX_CONF_DIR"

write_env_files
build_all
ensure_database
import_existing_data
run_migrations
ensure_admin
start_server
configure_nginx
health_check

cat <<EOF

============================================================
✅ 部署完成

client： http://$CLIENT_DOMAIN
admin：  http://$ADMIN_DOMAIN
API：    http://$CLIENT_DOMAIN/api/library/book

下一步：
1. 在阿里云安全组 / 宝塔防火墙放行 80、443
2. 在宝塔面板给两个域名申请 SSL（Let's Encrypt）
3. 如首次使用 PM2，执行一次：$PM2_BIN startup
4. 查看日志：$PM2_BIN logs $PM2_NAME
5. 修改管理员密码，并确认 server/.env 的 DEV_LOGIN_ENABLED=false

管理员：首次部署时若未配置 ADMIN_PASSWORD，脚本会自动生成 admin 账号，
        密码见 $CONFIG_FILE 的 ADMIN_PASSWORD 字段
上传目录：$UPLOAD_DIR
数据库：  $DB_NAME @ $DB_HOST:$DB_PORT
============================================================
EOF
