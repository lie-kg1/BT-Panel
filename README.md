# BT Panel

A self-contained Express dashboard with login, registration, session authentication, theme persistence, team management, user administration, background media uploads, profile pictures, password changes, and role-aware Music controls.

## Install and run

Clone the repository and enter the project directory before running any BT Panel command:

```bash
git clone https://github.com/lie-kg1/BT-Panel.git
cd BT-Panel
npm install
cp .env.example .env
npm start
```

Then open <http://localhost:3000/>. The `/` route serves the dashboard for authenticated users; signed-out visitors are redirected to `/login`. New accounts can be created at `/register`.

The interactive menu can be launched locally from the project directory:

```bash
bash menu.sh
```

If the repository has not been cloned yet, the remote menu can be launched with:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/lie-kg1/BT-Panel/main/menu.sh)"
```

Run these as separate commands. Do not append a menu option, `git clone`, `cd`, or `README` text to the installer command. Wait for the menu to appear, then enter the requested option. If the launcher reports `BASH_SOURCE[0]: unbound variable`, pull the latest `menu.sh` and run it with `bash menu.sh` from the repository directory.

## Latest release

The latest packaged release is [BT Panel v2.1.1](https://github.com/lie-kg1/BT-Panel/releases/tag/v2.1.1). Download the source archive directly from [BT-Panel-v2.1.1.zip](https://github.com/lie-kg1/BT-Panel/releases/download/v2.1.1/BT-Panel-v2.1.1.zip).

## General, Music, and Bars settings

Administrators can open **Settings → General** to configure the panel name, sidebar branding, browser title, welcome heading, welcome message, and the short subtitle beside the Home card heading. Values are sanitized, stored in `data/general.json`, and applied to the dashboard after saving. The General panel also includes a live preview so changes can be reviewed before they are persisted.

**Settings → Bars** controls which Home dashboard indicators are shown. Administrators can independently show or hide admin statistics, the panel version card, the signed-in role phrase, and the top-header account control. These choices are stored in `data/bars.json` and are applied both when the Home view renders and when the dashboard refreshes presence data.

Both settings panels retain the dark glassmorphism treatment used by the supplied Settings reference: rounded translucent cards, violet active controls, muted helper text, and dashed preview surfaces.

The General and Bars API surface is:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/general` | Read the authenticated panel identity and welcome settings. |
| `POST /api/general` | Administrator-only save for panel identity and welcome settings. |
| `GET /api/bars` | Read the authenticated Home indicator visibility settings. |
| `POST /api/bars` | Administrator-only save for Home indicator visibility settings. |

### Music settings

Authenticated users can open **Music** to use the playback controls. Administrators can manage ambient audio for the panel through the track library, including direct HTTP(S) audio URLs and local uploads for common formats such as MP3, WAV, OGG, OPUS, AAC, FLAC, M4A, and WEBM. Uploaded files are stored in `media/music/` and are excluded from source control by the repository ignore rules.

The Music view provides selected-track playback, enable/disable control, autoplay, loop, volume, and local preference reset for Members. Administrators additionally have track upload, URL add, deletion, and saved-preference controls. Browser autoplay policies may require the user to click Play once before a track can start. Music preferences and track metadata are stored in `data/music.json`; authenticated users can read playback settings, while mutation endpoints remain administrator-only.

The API surface is:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/music` | Read the current authenticated-user music settings and track library. |
| `POST /api/music` | Administrator-only save for playback preferences and the selected track. |
| `POST /api/music/track` | Administrator-only add for a direct HTTP(S) audio URL. |
| `POST /api/music/upload` | Administrator-only upload for a local audio file up to 50 MB. |
| `DELETE /api/music/:id` | Administrator-only removal of a track and its local uploaded file when applicable. |

The owner script uses `admin` and `admin@gmail.com` as convenience defaults for the owner username and email when no overrides are supplied, but it does not ship with a default password. For production or non-interactive setup, set `OWNER_USERNAME`, `OWNER_PASSWORD`, and `OWNER_EMAIL` environment variables. If `OWNER_PASSWORD` is omitted in an interactive terminal, the script prompts for it without echoing the password and asks for confirmation.

### Troubleshooting menu launch

If you see `BASH_SOURCE[0]: unbound variable`, use the latest `menu.sh` and launch it with the direct command shown above. The launcher now handles execution through `bash -c` safely. If npm reports that `package.json` or a menu script cannot be found, the command was started outside the BT Panel directory; run `cd /path/to/BT-Panel` first. Do not append `7` to the shell command. Enter `7` only after the menu is displayed.

## Configuration

Copy `.env.example` to `.env` and set a strong `SESSION_SECRET` before using the app outside local development. Uploaded background files are stored in `media/`, profile pictures in `profile/`, and JSON data is stored in `data/`.

## Vercel deployment

The repository includes `vercel.json` and an exportable Express entry point for Vercel. Before deploying, set `OWNER_USERNAME`, `OWNER_EMAIL`, and `OWNER_PASSWORD` in the Vercel project’s Production environment variables. The password must be at least eight characters and should be unique to this deployment. On the first hosted invocation, BT Panel creates the owner from those variables; it does not ship a hard-coded administrator password.

Vercel Functions use a writable temporary runtime directory for JSON state and uploads. That filesystem is ephemeral, so users, sessions, General/Bars/Music settings, and uploaded media are not durable across cold starts. Use a persistent Node host for the complete stateful panel, or add external database and object storage integrations before using Vercel for production data.

