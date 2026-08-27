const fs = require("node:fs");
const path = require("node:path");

const dashboardPath = path.join(__dirname, "..", "views", "admin", "dashboard.ejs");
const stylesPath = path.join(__dirname, "..", "public", "css", "panel.css");
const source = fs.readFileSync(dashboardPath, "utf8");
const styles = fs.readFileSync(stylesPath, "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const root = path.join(__dirname, "..");
const loginSource = fs.readFileSync(path.join(root, "views", "auth", "login.ejs"), "utf8");
const authTemplatePaths = [
  path.join(root, "views", "auth", "login.ejs"),
  path.join(root, "views", "auth", "register.ejs"),
  path.join(root, "html", "login.html"),
  path.join(root, "html", "register.html"),
];

const requiredSnippets = [
  'aria-label="${user.online ? "Online" : "Offline"}"></span>',
  'id="nav-settings"',
  'id="nav-music"',
  '<span class="nav-label">Music</span>',
  'd="M12.22 2h-.44a2 2 0 0 0-2 2v.18',
  'function renderTeamList()',
  'function renderUsersList()',
  '<table class="user-table">',
  '<div class="user-cell">',
  'const MOBILE_SIDEBAR_BREAKPOINT = 820;',
  '--default-wallpaper:',
  'background-image: var(--wallpaper-url), var(--default-wallpaper);',
  'Settings Management',
  'settings-tab-wallpapers',
  'settings-panel-appearance',
  'function switchSettingsTab',
  'function filterWallpaperLibrary',
  'id="wallpaperGrid"',
  'id="musicTrackList"',
  'id="musicTransportPlayBtn"',
  'id="musicMuteBtn"',
  'music-player-strip',
  'id="musicEnabledToggle"',
  'function loadMusicSettings',
  'function saveMusicSettings',
  'function skipMusicTrack(direction)',
  'function toggleMusicMute()',
  'class="music-icon-svg"',
  'music-track-art',
  'onvolumechange="syncMusicControls()"',
  'id="generalPanelName"',
  'id="generalWelcomeMessage"',
  'function saveGeneralSettings',
  'id="barsAdminStatsToggle"',
  'id="barsVersionToggle"',
  'function saveBarsSettings',
  '.badge-member {',
  'background: rgba(59, 130, 246, 0.16);',
  '.badge-admin {',
  'const PRESENCE_REFRESH_MS = 5000;',
  'async function refreshPresence()',
  'fetchTeam({ silent: true })',
  'fetchUsers({ silent: true })',
  'document.addEventListener("visibilitychange"',
  'src="/gemini-svg.svg"',
  'href="/gemini-svg.svg"'
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing rendered-row markup: ${snippet}`);
  }
}
for (const removedTab of [
  "settings-tab-security",
  "settings-tab-vm",
  "settings-tab-smtp",
  "settings-panel-security",
  "settings-panel-vm",
  "settings-panel-smtp",
]) {
  if (source.includes(removedTab)) {
    throw new Error(`Removed settings control is still present: ${removedTab}`);
  }
}
if (!source.includes('const SETTINGS_TABS = ["appearance", "wallpapers", "general", "music", "bars"]')) {
  throw new Error("Remaining settings tab allowlist is incorrect");
}
for (const removedBannerMarker of ["settings-status", "Settings are ready to customize."]) {
  if (source.includes(removedBannerMarker)) {
    throw new Error(`Removed settings status banner is still present: ${removedBannerMarker}`);
  }
}
for (const removedRoleMarker of ["Your Role", "dash-role-card"]) {
  if (source.includes(removedRoleMarker)) {
    throw new Error(`Removed role card is still present: ${removedRoleMarker}`);
  }
}

const malformedPresenceMarkup = 'aria-label="${user.online ? "Online" : "Offline"}></span>';
if (source.includes(malformedPresenceMarkup)) {
  throw new Error("Malformed avatar presence aria-label detected");
}

const settingsSection = source.match(/id="nav-settings"[\s\S]*?<\/button>/)?.[0] ?? "";
if (!settingsSection.includes('d="M12.22 2h-.44')) {
  throw new Error("Incomplete Settings gear SVG path detected");
}
if (settingsSection.includes('d="M19.4 15a1.65')) {
  throw new Error("Old malformed Settings gear SVG path detected");
}

const homeToSettingsBoundary = source.match(/id="view-home"[\s\S]*?<!-- Settings View -->/)?.[0] ?? "";
if (!homeToSettingsBoundary.includes("              </div>\n            </div>\n          </div>\n        </div>\n\n        <!-- Settings View -->")) {
  throw new Error("Home view containers are not closed before Settings view");
}

if (styles.includes('@media (min-width: 601px) and (max-width: 820px)')) {
  throw new Error("Obsolete full-sidebar tablet override is still present");
}
if (!styles.includes('@media (max-width: 600px)')) {
  throw new Error("Narrow-screen sidebar breakpoint is missing");
}
for (const responsiveSnippet of [
  '.mobile-sidebar-backdrop.active',
  '.sidebar.mobile-open',
  '.header-menu-btn',
  '.settings-management > .settings-tabs > .settings-tab',
  '.wallpaper-grid',
  '@media (max-width: 380px)',
]) {
  if (!styles.includes(responsiveSnippet)) {
    throw new Error(`Responsive layout rule is missing: ${responsiveSnippet}`);
  }
}
if (styles.includes("/* Card-free authentication pages */")) {
  throw new Error("Authentication glass card override is stripping responsive card styling");
}
for (const relativePath of [
  "views/admin/dashboard.ejs",
  "views/auth/login.ejs",
  "views/auth/register.ejs",
  "public/css/panel.css",
  "public/js/panel.js",
  "html/dashboard.html",
  "html/login.html",
  "html/register.html",
  "scripts/build.js",
  "public/gemini-svg.svg",
  "views/errors/404.ejs",
  "vercel.json",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing organized project file: ${relativePath}`);
  }
}
if (!serverSource.includes('res.render("admin/dashboard")')) {
  throw new Error("Server route is not rendering admin/dashboard");
}
if (!serverSource.includes('res.status(404).render("errors/404")')) {
  throw new Error("Branded website 404 fallback is missing");
}
for (const hostedSnippet of ["const IS_VERCEL", "const RUNTIME_ROOT", "function ensureHostedOwner", "ensureHostedOwner();"]) {
  if (!serverSource.includes(hostedSnippet)) {
    throw new Error(`Hosted runtime support is incomplete: ${hostedSnippet}`);
  }
}
if (/value=["']admin(?:12345)?["']/.test(loginSource)) {
  throw new Error("Login page must not ship hard-coded administrator credentials");
}
if (!fs.readFileSync(path.join(root, "src/server.js"), "utf8").includes("module.exports = app")) {
  throw new Error("Server entry point is not exportable for hosted deployment");
}
for (const emailAuthSnippet of [
  'normalizeUsername(user.email) === normalizeUsername(email)',
  'message: "That email is already in use."',
  'normalizeUsername(candidate.email) === identifier',
]) {
  if (!serverSource.includes(emailAuthSnippet)) {
    throw new Error(`Email authentication validation is incomplete: ${emailAuthSnippet}`);
  }
}
for (const musicSnippet of [
  'const MUSIC_FILE = path.join(DATA_DIR, "music.json")',
  'app.get("/api/music", authRequired',
  'app.get("/settings", (req, res) => {',
  'app.get(["/team", "/users", "/account", "/music"]',
  'app.post("/api/music/track", adminRequired',
  'app.post("/api/music/upload", adminRequired',
  'app.delete("/api/music/:id", adminRequired',
]) {
  if (!serverSource.includes(musicSnippet)) {
    throw new Error(`Music persistence or route support is incomplete: ${musicSnippet}`);
  }
}
const forbiddenMusicGlyphs = [0x266b, 0x25b6, 0x1f50a, 0x1f507, 0x275a].map((codePoint) => String.fromCodePoint(codePoint));
if (forbiddenMusicGlyphs.some((glyph) => source.includes(glyph))) {
  throw new Error("Music controls must use inline SVG icons instead of emoji or text glyphs");
}
for (const playbackSnippet of [
  'function startMusicPlayback()',
  'musicSettings.enabled && shouldPlay',
  'Click Play selected to start audio in this browser.',
]) {
  if (!source.includes(playbackSnippet)) {
    throw new Error(`User-gesture-safe music playback is incomplete: ${playbackSnippet}`);
  }
}
if (source.includes('(shouldPlay || musicSettings.autoplay)')) {
  throw new Error("Music autoplay must not call audio.play() during page or settings initialization");
}
for (const settingsSnippet of [
  'const GENERAL_FILE = path.join(DATA_DIR, "general.json")',
  'const BARS_FILE = path.join(DATA_DIR, "bars.json")',
  'app.get("/api/general", authRequired',
  'app.post("/api/general", adminRequired',
  'app.get("/api/bars", authRequired',
  'app.post("/api/bars", adminRequired',
  'function sanitizeGeneral(input)',
  'function sanitizeBars(input)',
]) {
  if (!serverSource.includes(settingsSnippet)) {
    throw new Error(`General/Bars persistence or route support is incomplete: ${settingsSnippet}`);
  }
}
for (const profileSnippet of [
  "function normalizedProfilePic(value)",
  'profilePic: normalizedProfilePic(safe.profilePic)',
  'app.get("/profile/:name", (req, res, next) =>',
  'return res.status(204).end()',
]) {
  if (!serverSource.includes(profileSnippet)) {
    throw new Error(`Missing profile-image resilience logic: ${profileSnippet}`);
  }
}
for (const view of ["auth/login", "auth/register"]) {
  if (!serverSource.includes(`res.render("${view}", { initialTheme: loadTheme() })`)) {
    throw new Error(`Server route is not hydrating the initial theme for ${view}`);
  }
}
for (const authPath of authTemplatePaths) {
  const authSource = fs.readFileSync(authPath, "utf8");
  for (const snippet of [
    "function applyThemeValues",
    "fetch(\"/api/theme\")",
    "glassOpacity",
    "--auth-input-bg",
    "--auth-input-border",
    'document.documentElement.style.setProperty("--glass-border"',
    ".auth-shell label",
    "min-height: 40px",
    "max-width: 340px",
    "color: #ffffff",
    "glassBlur",
    "borderRadius",
    'const accent = settings.accentColor || "#d00000"',
    'const glassTint = settings.glassTint || "#000000"',
  ]) {
    if (!authSource.includes(snippet)) {
      throw new Error(`Cross-page theme support missing from ${path.relative(root, authPath)}: ${snippet}`);
    }
  }
  if (authSource.includes('JSON.parse(stored), wallpaperUrl: ""')) {
    throw new Error(`Saved wallpaper is being cleared on ${path.relative(root, authPath)}`);
  }
}
for (const authEjsPath of [path.join(root, "views", "auth", "login.ejs"), path.join(root, "views", "auth", "register.ejs")]) {
  const authEjsSource = fs.readFileSync(authEjsPath, "utf8");
  if (!authEjsSource.includes("const INITIAL_THEME = <%- JSON.stringify(initialTheme || {}).replace(/</g")) {
    throw new Error(`Initial server theme hydration is missing from ${path.relative(root, authEjsPath)}`);
  }
}
if (source.includes('data = { ...parsed, wallpaperUrl: "" }')) {
  throw new Error("Dashboard theme loader is clearing the saved wallpaper");
}
if (!source.includes('data = { ...data, ...json };')) {
  throw new Error("Dashboard theme loader is not merging API theme data with cached theme data");
}

const teamRows = source.match(/function renderTeamList\(\)[\s\S]*?async function fetchTeam\b/)?.[0] ?? "";
const userRows = source.match(/function renderUsersList\(\)[\s\S]*?async function fetchUsers\b/)?.[0] ?? "";
for (const [name, block] of [["team", teamRows], ["user", userRows]]) {
  if (!block.includes("<tr>") || !block.includes("<tbody>${rows}</tbody>")) {
    throw new Error(`Incomplete ${name} rendered-row template`);
  }
}

console.log("Rendered-row markup validation passed.");
