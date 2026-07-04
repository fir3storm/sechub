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

## Run with PM2 (recommended)

```bash
sudo npm install -g pm2

# Web app
pm2 start npm --name sechub-web -- start

# Background ingestion worker
pm2 start npm --name sechub-worker -- run worker

pm2 save
pm2 startup
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
