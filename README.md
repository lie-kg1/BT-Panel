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

For an interactive launcher covering installation, owner setup, building, checks, and starting the server, run it from the BT Panel project directory:

```bash
./menu.sh
```

If you need to copy the latest launcher from GitHub into an existing checkout:

```bash
curl -fsSL https://raw.githubusercontent.com/lie-kg1/BT-Panel/refs/heads/main/menu.sh -o menu.sh
chmod +x menu.sh
bash menu.sh
```

You may also launch the downloaded script directly from the current directory with:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/lie-kg1/BT-Panel/refs/heads/main/menu.sh)"
```

The direct command uses the current working directory. Therefore, run it after changing into the cloned BT Panel directory:

```bash
cd /path/to/BT-Panel
bash -c "$(curl -fsSL https://raw.githubusercontent.com/lie-kg1/BT-Panel/refs/heads/main/menu.sh)"
```

The menu options are:

| Option | Action |
| ---: | --- |
| `1` | Install or update Node.js, npm dependencies, and runtime directories. |
| `2` | Create or update the owner account. |
| `3` | Run `npm run build`. |
| `4` | Run `npm run check`. |
| `5` | Start the production server with `npm start`. |
| `6` | Start the development server with `npm run dev`. |
| `7` | Exit the menu. |

The launcher validates that `package.json` and `install.sh` are present before options `1` through `6`. If it is run from another directory, change into the BT Panel directory and run it again.

If Node.js and the dependencies are already installed, you can start the server directly:

```bash
npm start
```

The owner script uses `admin` / `admin12345` / `admin@gmail.com` as its default owner username, password, and email when no overrides are supplied. For production or non-interactive setup, set `OWNER_USERNAME`, `OWNER_PASSWORD`, and `OWNER_EMAIL` environment variables; always replace the sample password before exposing the panel publicly. If `OWNER_PASSWORD` is omitted in an interactive terminal, the script prompts for it without echoing the password and asks for confirmation.

Open <http://localhost:3000/>. The `/` route serves the dashboard for authenticated users and redirects signed-out visitors to `/login`. New accounts can be created at `/register`.

### Troubleshooting menu launch

If you see `BASH_SOURCE[0]: unbound variable`, use the latest `menu.sh` and launch it with the direct command shown above. The launcher now handles execution through `bash -c` safely. If npm reports that `package.json` or a menu script cannot be found, the command was started outside the BT Panel directory; run `cd /path/to/BT-Panel` first. Do not append `7` to the shell command. Enter `7` only after the menu is displayed.

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
