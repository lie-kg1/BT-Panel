# Bot Panel

A self-contained Express dashboard with login, registration, session authentication, theme persistence, team management, user administration, background media uploads, profile pictures, and password changes.

## Run locally

Use the included installer on a Debian or Ubuntu host. It installs or upgrades to Node.js 20+, installs dependencies, creates the runtime directories, and initializes the local users file:

```bash
./install.sh
```

To create or update the owner account securely, run:

```bash
./owner.sh
```

For an interactive launcher covering installation, owner setup, building, checks, and starting the server, run:

```bash
./menu.sh
```

If Node.js and the dependencies are already installed, you can start the server directly:

```bash
npm start
```

The owner script uses `admin` / `admin12345` / `admin@gmail.com` as its default owner username, password, and email when no overrides are supplied. For production or non-interactive setup, set `OWNER_USERNAME`, `OWNER_PASSWORD`, and `OWNER_EMAIL` environment variables; always replace the sample password before exposing the panel publicly. If `OWNER_PASSWORD` is omitted in an interactive terminal, the script prompts for it without echoing the password and asks for confirmation.

Open <http://localhost:3000/>. The `/` route serves the dashboard for authenticated users and redirects signed-out visitors to `/login`. New accounts can be created at `/register`.

## Configuration

Copy `.env.example` to `.env` and set a strong `SESSION_SECRET` before using the app outside local development. Uploaded background files are stored in `media/`, profile pictures in `profile/`, and JSON data is stored in `data/`.

## Included routes

| Route | Purpose |
| --- | --- |
| `/` | Authenticated dashboard index |
| `/login` | Login page |
| `/register` | Registration page |
| `/api/me` | Current authenticated user |
| `/api/theme` | Read or save the appearance theme |
| `/api/team` | Read-only team list |
| `/api/users` | Admin user management |
| `/api/media/*` | Admin background media management |
| `/api/profile/pic` | Authenticated PNG profile upload |
| `/api/me/password` | Authenticated password update |
| `/logout` | Destroy the current session |

The project includes the supplied dashboard markup under `views/admin/dashboard.ejs`, the panel stylesheet at `public/css/panel.css`, the browser helper at `public/js/panel.js`, and the root-compatible Express implementation at `app.js` exposed through `src/server.js`.

## Organized project layout

The project now includes a conventional Express layout alongside the backwards-compatible root entry point:

- `build/` contains generated build output and its manifest.
- `html/` contains static HTML source copies.
- `views/` contains EJS page templates and reserved view namespaces.
- `src/` contains source-layer entry points and reserved application modules.
- `scripts/` contains JavaScript build/account helpers and the Python structure validator.
- `public/css/panel.css` contains the panel stylesheet.
- `public/js/panel.js` contains shared panel browser helpers.
- `public/vendor/` is reserved for third-party browser assets.

Run `npm run build` to refresh `build/`. The server renders the EJS files from `views/` while continuing to expose the existing public asset routes.

## vpanel-pro compatibility update

The project now follows the repository organization used by [vpanel-pro](https://github.com/nobita329/vpanel-pro): Express renders namespaced EJS views, `src/server.js` is the primary start entry, `scripts/build.js` owns the build step, and panel assets are grouped under `public/css`, `public/js`, and `public/vendor`. Compatible terminal vendor assets and an adapted PM2 configuration are included. vpanel-pro-specific QEMU, SSH, VM, and noVNC service code was not copied into Bot Panel because those services require a different runtime and data model.
