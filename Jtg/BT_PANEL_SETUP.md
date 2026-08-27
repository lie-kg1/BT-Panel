# JTG Panel — BT Panel Deployment Guide

The repository is a **full-stack Node.js application**, not a static HTML-only site. `index.html` is the frontend entry point; `server.ts` provides the API, Socket.IO, authentication, Docker integration, and production static-file serving. The project’s build script creates the frontend and bundled server, and production defaults to port `6767`.[1]

## Delivered archives

| Archive | Contents | Recommended use |
| --- | --- | --- |
| `Jtg-BT-Panel-Deploy.zip` | Complete tracked project, including `src/`, `public/`, `index.html`, server code, configuration, scripts, and package manifests. | Use this for a complete BT Panel deployment. |
| `Jtg-src-html.zip` | `src/`, `public/`, `index.html`, and the configuration required to build the project. | Use this only when you specifically need the source and HTML files. |

Neither archive includes `node_modules`, generated `dist/`, runtime `.data/`, or runtime backups. These should be created on the target server.

## BT Panel installation

Install a current Node.js version, preferably Node.js 20 or 22, together with Docker and PM2. Upload `Jtg-BT-Panel-Deploy.zip` to a directory such as `/www/wwwroot/jtg-panel`, extract it, and run:

```bash
cd /www/wwwroot/jtg-panel
cp .env.example .env
nano .env
npm ci
npm run build
npm run createuser
pm2 start ecosystem.config.cjs --update-env
pm2 save
```

During `npm run createuser`, enter the first administrator username and password. The PM2 configuration starts the application in production mode on port `6767` unless `PORT` is changed.

## Minimum production `.env`

Replace the JWT secret with a long, random value. Do not expose `.env` publicly.

```dotenv
NODE_ENV=production
PORT=6767
JWT_SECRET=replace-with-a-long-random-secret
VITE_ENABLE_DEVELOPER_PANEL=false
DOCKER_SOCKET_PATH=/var/run/docker.sock
```

If Docker uses a different socket path, update `DOCKER_SOCKET_PATH` and make sure the PM2 process can access that socket.

## Domain and reverse proxy

Create a BT Panel website for the domain and configure a reverse proxy to:

```text
http://127.0.0.1:6767
```

Enable WebSocket support because the panel uses Socket.IO for live console and server updates. Enable HTTPS before exposing the login page publicly.

The project also has a built-in SFTP service. Its production default is port `6868`; open that port only if the SFTP feature is required, and restrict access with the server firewall.[1]

## Updating an existing installation

Back up `.data/` and `backups/` before updating, then rebuild and restart PM2:

```bash
cd /www/wwwroot/jtg-panel
git pull --ff-only
npm ci
npm run build
pm2 restart jtg-panel --update-env
```

I prepared the source packages and instructions, but I did not log in to or modify your BT Panel server. The actual upload and installation must be performed on a server you own or are authorized to administer.

> Review the upstream code, dependencies, and licensing before deploying or redistributing the panel. Test on a staging server first.

## Reference

[1]: https://github.com/JishnuTheGamer/Jtg "JTG Panel GitHub repository"

Prepared by **Manus AI** on 2026-08-27.
