# SecHub

Cybersecurity news aggregation and AI-powered advisory platform.

## Requirements (Ubuntu 22.04 VPS)

- Node.js 20 LTS
- PostgreSQL 14+
- Redis 6+

## Ubuntu setup

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER sechub WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "CREATE DATABASE sechub OWNER sechub;"

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

## App setup

```bash
git clone <your-repo> sechub
cd sechub
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, AUTH_SECRET, SETTINGS_ENCRYPTION_KEY

npm install
npx prisma generate
npx prisma db push
npm run db:seed

npm run build
```

## Run with PM2 (recommended — stays on + survives reboot)

```bash
sudo npm install -g pm2
cd /opt/sechub
npm run build
npm run pm2:setup
```

`pm2:setup` starts **sechub-web** and **sechub-worker**, runs `pm2 save`, and prints a
**one-time** `sudo env PATH=... pm2 startup` command — run that command so processes
auto-start after a VPS reboot.

Set `PORT` in `.env` if not using the default `3002` (must match your Nginx `proxy_pass`).

```bash
# After code updates
cd /opt/sechub && git pull && npm ci && npm run build && npm run pm2:restart

# Check status
pm2 status
pm2 logs sechub-web --lines 30
```

### Why did it stop?

| Cause | Fix |
|-------|-----|
| VPS rebooted | Run `pm2 startup` once (see `npm run pm2:setup`) |
| Process crashed (OOM / error) | PM2 auto-restarts — check `pm2 logs` |
| Started manually in SSH only | Use `npm run pm2:setup` instead of bare `npm start` |
| Deploy without restart | `npm run pm2:restart` after each deploy |

Also ensure system services survive reboot:

```bash
sudo systemctl enable postgresql redis-server nginx
```

## Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use Certbot for HTTPS: `sudo apt install certbot python3-certbot-nginx`

## Default login (after seed)

- Email: `admin@sechub.local`
- Password: `admin123`

Change this immediately in production.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Random 32+ char secret for sessions |
| `AUTH_URL` | Public URL, e.g. `https://your-domain.com` |
| `SETTINGS_ENCRYPTION_KEY` | 64-char hex string (32 bytes) for encrypting DeepSeek API key |

DeepSeek API key is configured in the app under **Settings → AI Settings**.

## Manual ingestion

Admins can trigger feed ingestion from **Settings → Feed Sources**, or via API:

```bash
curl -X POST https://your-domain.com/api/ingest/trigger \
  -H "Cookie: <session-cookie>"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run worker` | Start BullMQ ingestion worker |
| `npm run db:seed` | Seed admin user, categories, feeds |
