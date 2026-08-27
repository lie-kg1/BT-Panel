require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CATEGORIES, getWallpapers } = require("./src/services/wallpaperService");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const IS_VERCEL = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const RUNTIME_ROOT = IS_VERCEL
  ? path.resolve(process.env.BT_PANEL_RUNTIME_DIR || path.join("/tmp", "bt-panel"))
  : ROOT;
const PUBLIC_DIR = path.join(ROOT, "public");
const VIEWS_DIR = path.join(ROOT, "views");
const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const MEDIA_DIR = process.env.MEDIA_DIR
  ? path.resolve(ROOT, process.env.MEDIA_DIR)
  : path.join(RUNTIME_ROOT, "media");
const PROFILE_DIR = path.join(RUNTIME_ROOT, "profile");
const BACKGROUND_DIR = path.join(RUNTIME_ROOT, "Background");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const THEME_FILE = path.join(DATA_DIR, "theme.json");
const MUSIC_FILE = path.join(DATA_DIR, "music.json");
const GENERAL_FILE = path.join(DATA_DIR, "general.json");
const BARS_FILE = path.join(DATA_DIR, "bars.json");
const INFRA_FILE = path.join(DATA_DIR, "infrastructure.json");
const MUSIC_DIR = path.join(MEDIA_DIR, "music");
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "botpanel.sid";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret";
const OWNER_USERNAME = String(process.env.OWNER_USERNAME || "admin").trim();
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim();
const OWNER_PASSWORD = String(process.env.OWNER_PASSWORD || "");
const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;
const onlineSessions = new Map();

function markOnline(userId, sessionId) {
  if (!userId || !sessionId) return;
  const entry = onlineSessions.get(userId) || { sessions: new Set(), lastSeen: 0 };
  entry.sessions.add(sessionId);
  entry.lastSeen = Date.now();
  onlineSessions.set(userId, entry);
}

function markOffline(userId, sessionId) {
  if (!userId || !sessionId) return;
  const entry = onlineSessions.get(userId);
  if (!entry) return;
  entry.sessions.delete(sessionId);
  if (entry.sessions.size === 0) onlineSessions.delete(userId);
}

function isOnline(userId) {
  const entry = onlineSessions.get(userId);
  return Boolean(entry && entry.sessions.size > 0 && Date.now() - entry.lastSeen <= PRESENCE_TIMEOUT_MS);
}

for (const dir of [PUBLIC_DIR, DATA_DIR, MEDIA_DIR, MUSIC_DIR, PROFILE_DIR, BACKGROUND_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DEFAULT_THEME = {
  wallpaperUrl: "",
  bgBlur: 0,
  bgOpacity: 100,
  accentColor: "#d00000",
  glassTint: "#000000",
  navText: "#9da3b4",
  navTextActive: "#e7e9f0",
  glassBlur: 0,
  glassSaturate: 180,
  borderRadius: 24,
  glassOpacity: 22,
  showTeam: true,
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(temp, file);
}

let cachedHostedOwner = null;

function getHostedOwner() {
  if (!IS_VERCEL || !OWNER_PASSWORD || !validUsername(OWNER_USERNAME) || !validEmail(OWNER_EMAIL) || OWNER_PASSWORD.length < 8) return null;
  if (!cachedHostedOwner) {
    cachedHostedOwner = {
      id: `hosted-owner-${crypto.createHash("sha256").update(`${OWNER_USERNAME.toLowerCase()}|${OWNER_EMAIL.toLowerCase()}`).digest("hex").slice(0, 24)}`,
      username: OWNER_USERNAME,
      email: OWNER_EMAIL,
      passwordHash: bcrypt.hashSync(OWNER_PASSWORD, 10),
      role: "owner",
      status: "active",
      profilePic: "",
      bio: "",
      createdAt: Date.now(),
      lastLogin: null,
      twoFactorEnabled: false,
    };
  }
  return cachedHostedOwner;
}

function loadUsers() {
  const data = readJson(USERS_FILE, { __version__: 2, users: [] });
  if (!Array.isArray(data.users)) data.users = [];
  const hostedOwner = getHostedOwner();
  if (hostedOwner && !data.users.some((user) => user.id === hostedOwner.id)) data.users.unshift({ ...hostedOwner });
  return data;
}

function saveUsers(data) {
  writeJson(USERS_FILE, { __version__: 2, users: data.users });
}

function normalizedProfilePic(value) {
  const filename = String(value || "").trim();
  if (!filename || filename !== path.basename(filename) || !/^[a-zA-Z0-9._-]+$/.test(filename)) return "";
  return fs.existsSync(path.join(PROFILE_DIR, filename)) ? filename : "";
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return {
    ...safe,
    profilePic: normalizedProfilePic(safe.profilePic),
    status: safe.status || "active",
  };
}

function currentUser(req) {
  if (!req.session.userId) return null;
  const data = loadUsers();
  return data.users.find((user) => user.id === req.session.userId) || null;
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(String(value || "").trim());
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function ensureHostedOwner() {
  const owner = getHostedOwner();
  if (!owner) {
    if (IS_VERCEL && OWNER_PASSWORD) console.warn("OWNER_USERNAME, OWNER_EMAIL, and OWNER_PASSWORD must be valid for hosted owner bootstrap.");
    return;
  }
  const data = loadUsers();
  if (!data.users.some((user) => user.id === owner.id)) {
    data.users.unshift({ ...owner });
    saveUsers(data);
  }
}

ensureHostedOwner();
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "getnada.com",
  "guerrillamail.com",
  "inboxbear.com",
  "maildrop.cc",
  "mailinator.com",
  "moakt.com",
  "sharklasers.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);
function isDisposableEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  const domain = email.split("@").pop() || "";
  return Array.from(DISPOSABLE_EMAIL_DOMAINS).some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
  );
}

function validHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function booleanSetting(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function sanitizeWallpaperUrl(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, 500);
  if (candidate.startsWith("/media/")) return candidate;
  if (candidate.startsWith("/wallpapers/")) return candidate;
  if (candidate.startsWith("/Background/")) return `/media/${candidate.slice("/Background/".length)}`;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch (_) {
    return "";
  }
}

function sanitizeTheme(input) {
  const theme = input || {};
  return {
    wallpaperUrl: sanitizeWallpaperUrl(theme.wallpaperUrl),
    bgBlur: clampInt(theme.bgBlur, 0, 100, DEFAULT_THEME.bgBlur),
    bgOpacity: clampInt(theme.bgOpacity, 0, 100, DEFAULT_THEME.bgOpacity),
    accentColor: validHex(theme.accentColor, DEFAULT_THEME.accentColor),
    glassTint: validHex(theme.glassTint, DEFAULT_THEME.glassTint),
    navText: validHex(theme.navText, DEFAULT_THEME.navText),
    navTextActive: validHex(theme.navTextActive, DEFAULT_THEME.navTextActive),
    glassBlur: clampInt(theme.glassBlur, 0, 40, DEFAULT_THEME.glassBlur),
    glassSaturate: clampInt(theme.glassSaturate, 100, 220, DEFAULT_THEME.glassSaturate),
    borderRadius: clampInt(theme.borderRadius, 0, 24, DEFAULT_THEME.borderRadius),
    glassOpacity: clampInt(theme.glassOpacity, 0, 100, DEFAULT_THEME.glassOpacity),
    showTeam: booleanSetting(theme.showTeam, DEFAULT_THEME.showTeam),
  };
}

function loadTheme() {
  const raw = readJson(THEME_FILE, DEFAULT_THEME);
  return { ...DEFAULT_THEME, ...sanitizeTheme(raw) };
}

function saveTheme(theme) {
  writeJson(THEME_FILE, sanitizeTheme(theme));
}

const DEFAULT_MUSIC = {
  enabled: false,
  autoplay: false,
  loop: true,
  volume: 0.35,
  selectedTrackId: "",
  tracks: [],
};

function sanitizeMusicUrl(value) {
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, 1000);
  if (candidate.startsWith("/media/")) return candidate;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch (_) {
    return "";
  }
}

function sanitizeMusicTrack(input, fallbackId = crypto.randomUUID()) {
  const track = input || {};
  const url = sanitizeMusicUrl(track.url);
  if (!url) return null;
  const rawId = String(track.id || fallbackId).trim().slice(0, 80);
  const id = /^[a-zA-Z0-9_-]+$/.test(rawId) ? rawId : fallbackId;
  const name = String(track.name || track.title || "Untitled track").trim().slice(0, 120) || "Untitled track";
  const source = track.source === "upload" || url.startsWith("/media/music/") ? "upload" : "external";
  return { id, name, url, source, createdAt: Number(track.createdAt) || Date.now() };
}

function sanitizeMusic(input) {
  const music = input || {};
  const tracks = [];
  const seen = new Set();
  for (const candidate of Array.isArray(music.tracks) ? music.tracks : []) {
    const track = sanitizeMusicTrack(candidate);
    if (!track || seen.has(track.url)) continue;
    seen.add(track.url);
    tracks.push(track);
  }
  const requestedVolume = Number(music.volume);
  const volume = Number.isFinite(requestedVolume)
    ? Math.min(1, Math.max(0, requestedVolume > 1 ? requestedVolume / 100 : requestedVolume))
    : DEFAULT_MUSIC.volume;
  const requestedSelected = String(music.selectedTrackId || "");
  const selectedTrackId = tracks.some((track) => track.id === requestedSelected)
    ? requestedSelected
    : tracks[0]?.id || "";
  return {
    enabled: booleanSetting(music.enabled, DEFAULT_MUSIC.enabled),
    autoplay: booleanSetting(music.autoplay, DEFAULT_MUSIC.autoplay),
    loop: booleanSetting(music.loop, DEFAULT_MUSIC.loop),
    volume,
    selectedTrackId,
    tracks,
  };
}

function loadMusic() {
  return sanitizeMusic(readJson(MUSIC_FILE, DEFAULT_MUSIC));
}

function saveMusic(music) {
  const saved = sanitizeMusic(music);
  writeJson(MUSIC_FILE, saved);
  return saved;
}

const DEFAULT_GENERAL = {
  panelName: "BT PANEL",
  panelSubtitle: "",
  welcomeTitle: "Welcome",
  welcomeMessage: "Manage your panel from one place.",
};

function cleanText(value, fallback, maxLength) {
  const text = String(value ?? "").replace(/[<>]/g, "").trim().slice(0, maxLength);
  return text || fallback;
}

function sanitizeGeneral(input) {
  const general = input || {};
  return {
    panelName: cleanText(general.panelName, DEFAULT_GENERAL.panelName, 48),
    panelSubtitle: cleanText(general.panelSubtitle, DEFAULT_GENERAL.panelSubtitle, 120),
    welcomeTitle: cleanText(general.welcomeTitle, DEFAULT_GENERAL.welcomeTitle, 80),
    welcomeMessage: cleanText(general.welcomeMessage, DEFAULT_GENERAL.welcomeMessage, 240),
  };
}

function loadGeneral() {
  return sanitizeGeneral(readJson(GENERAL_FILE, DEFAULT_GENERAL));
}

function saveGeneral(general) {
  const saved = sanitizeGeneral(general);
  writeJson(GENERAL_FILE, saved);
  return saved;
}

const DEFAULT_BARS = {
  showAdminStats: true,
  showVersion: true,
  showRole: true,
  showHeaderUser: true,
};

function sanitizeBars(input) {
  const bars = input || {};
  return {
    showAdminStats: booleanSetting(bars.showAdminStats, DEFAULT_BARS.showAdminStats),
    showVersion: booleanSetting(bars.showVersion, DEFAULT_BARS.showVersion),
    showRole: booleanSetting(bars.showRole, DEFAULT_BARS.showRole),
    showHeaderUser: booleanSetting(bars.showHeaderUser, DEFAULT_BARS.showHeaderUser),
  };
}

function loadBars() {
  return sanitizeBars(readJson(BARS_FILE, DEFAULT_BARS));
}

function saveBars(bars) {
  const saved = sanitizeBars(bars);
  writeJson(BARS_FILE, saved);
  return saved;
}


const DEFAULT_INFRASTRUCTURE = {
  mode: "demo",
  panelUrl: "",
  lastSync: Date.now(),
  nodes: [
    { id: "node-eu-01", name: "wings-eu-01", location: "Frankfurt, DE", status: "online", wings: "1.11.10", docker: "27.5.1", uptime: "42d 08h", cpu: 34, memoryUsed: 48, memoryTotal: 128, diskUsed: 412, diskTotal: 1000, address: "10.0.1.21" },
    { id: "node-us-01", name: "wings-us-01", location: "Ashburn, US", status: "online", wings: "1.11.10", docker: "27.5.1", uptime: "18d 19h", cpu: 22, memoryUsed: 31, memoryTotal: 64, diskUsed: 188, diskTotal: 500, address: "10.0.2.18" },
    { id: "node-sg-01", name: "wings-sg-01", location: "Singapore, SG", status: "maintenance", wings: "1.11.9", docker: "27.4.0", uptime: "—", cpu: 0, memoryUsed: 0, memoryTotal: 64, diskUsed: 0, diskTotal: 500, address: "10.0.3.14" },
  ],
  servers: [
    { id: "srv-smp", name: "Survival SMP", identifier: "smp-7fc2", nodeId: "node-eu-01", game: "Minecraft", status: "running", memoryUsed: 3.1, memoryLimit: 6, diskUsed: 18.4, diskLimit: 50, uptime: "6d 14h", image: "ghcr.io/pterodactyl/yolks:java_21", allocation: "10.0.1.21:25565", lastAction: "Healthy" },
    { id: "srv-web", name: "Web Production", identifier: "web-31aa", nodeId: "node-us-01", game: "Node.js", status: "stopped", memoryUsed: 0.4, memoryLimit: 2, diskUsed: 4.8, diskLimit: 20, uptime: "—", image: "ghcr.io/pterodactyl/yolks:nodejs_22", allocation: "10.0.2.18:3000", lastAction: "Stopped by operator" },
    { id: "srv-valheim", name: "Valheim Community", identifier: "vh-92d1", nodeId: "node-eu-01", game: "Valheim", status: "running", memoryUsed: 5.8, memoryLimit: 8, diskUsed: 26.2, diskLimit: 80, uptime: "2d 03h", image: "ghcr.io/pterodactyl/yolks:steamcmd", allocation: "10.0.1.21:2456", lastAction: "Healthy" },
  ],
  activity: [
    { id: "event-1", text: "Wings heartbeat received from wings-eu-01", tone: "success", ts: Date.now() - 240000 },
    { id: "event-2", text: "Docker image cache refreshed on wings-us-01", tone: "info", ts: Date.now() - 1080000 },
    { id: "event-3", text: "wings-sg-01 entered maintenance mode", tone: "warning", ts: Date.now() - 2820000 },
  ],
};

function infraString(value, fallback, max = 120) {
  const result = String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
  return result || fallback;
}

function infraId(value, fallback) {
  const result = String(value || "").trim().slice(0, 80);
  return /^[a-zA-Z0-9_.-]+$/.test(result) ? result : fallback;
}

function infraStatus(value, fallback) {
  const status = String(value || "").toLowerCase();
  return ["online", "offline", "maintenance", "running", "stopped"].includes(status) ? status : fallback;
}

function sanitizeInfrastructure(input) {
  const source = input || {};
  const nodes = (Array.isArray(source.nodes) ? source.nodes : DEFAULT_INFRASTRUCTURE.nodes).slice(0, 50).map((node, index) => ({
    id: infraId(node.id, `node-${index + 1}`), name: infraString(node.name, `wings-${index + 1}`, 64), location: infraString(node.location, "Unassigned", 80), status: infraStatus(node.status, "offline"),
    wings: infraString(node.wings, "—", 32), docker: infraString(node.docker, "—", 32), uptime: infraString(node.uptime, "—", 32), cpu: clampInt(node.cpu, 0, 100, 0),
    memoryUsed: clampInt(node.memoryUsed, 0, 100000, 0), memoryTotal: clampInt(node.memoryTotal, 1, 100000, 1), diskUsed: clampInt(node.diskUsed, 0, 1000000, 0), diskTotal: clampInt(node.diskTotal, 1, 1000000, 1), address: infraString(node.address, "—", 64),
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const servers = (Array.isArray(source.servers) ? source.servers : DEFAULT_INFRASTRUCTURE.servers).slice(0, 200).map((server, index) => ({
    id: infraId(server.id, `server-${index + 1}`), name: infraString(server.name, `Server ${index + 1}`, 80), identifier: infraId(server.identifier, `srv-${index + 1}`), nodeId: nodeIds.has(server.nodeId) ? server.nodeId : nodes[0]?.id || "", game: infraString(server.game, "Generic", 48), status: infraStatus(server.status, "stopped"),
    memoryUsed: Math.max(0, Number(server.memoryUsed) || 0), memoryLimit: Math.max(0.1, Number(server.memoryLimit) || 1), diskUsed: Math.max(0, Number(server.diskUsed) || 0), diskLimit: Math.max(0.1, Number(server.diskLimit) || 1), uptime: infraString(server.uptime, "—", 32), image: infraString(server.image, "—", 160), allocation: infraString(server.allocation, "—", 80), lastAction: infraString(server.lastAction, "No recent action", 80),
  }));
  const activity = (Array.isArray(source.activity) ? source.activity : DEFAULT_INFRASTRUCTURE.activity).slice(0, 12).map((event, index) => ({ id: infraId(event.id, `event-${index + 1}`), text: infraString(event.text, "Infrastructure event", 180), tone: ["success", "info", "warning", "danger"].includes(event.tone) ? event.tone : "info", ts: Number(event.ts) || Date.now() }));
  return { mode: process.env.PTERODACTYL_PANEL_URL ? "configured" : "demo", panelUrl: sanitizeWallpaperUrl(process.env.PTERODACTYL_PANEL_URL || source.panelUrl || ""), lastSync: Number(source.lastSync) || Date.now(), nodes, servers, activity };
}

function loadInfrastructure() { return sanitizeInfrastructure(readJson(INFRA_FILE, DEFAULT_INFRASTRUCTURE)); }
function saveInfrastructure(value) { const saved = sanitizeInfrastructure(value); writeJson(INFRA_FILE, saved); return saved; }
function infraEvent(value, text, tone = "info") { value.activity = [{ id: crypto.randomUUID(), text, tone, ts: Date.now() }, ...(value.activity || [])].slice(0, 12); }

function authRequired(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ success: false, message: "Authentication required." });
  if ((user.status || "active") !== "active") {
    req.session.destroy(() => {});
    return res.status(403).json({ success: false, message: "This account is not active." });
  }
  req.user = user;
  markOnline(user.id, req.sessionID);
  next();
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (!req.user || !["owner", "admin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Administrator permission required." });
    }
    next();
  });
}

function safeFileName(name) {
  return path.basename(String(name || ""));
}

function mediaType(fileName) {
  return /\.(mp4|webm|mov)$/i.test(fileName) ? "video" : "image";
}

function listMedia() {
  return fs.readdirSync(MEDIA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = safeFileName(entry.name);
      const stat = fs.statSync(path.join(MEDIA_DIR, file));
      return { name: file, type: mediaType(file), size: stat.size, updatedAt: stat.mtimeMs };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const upload = multer({
  dest: MEDIA_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/(png|jpeg|jpg|gif|webp)|video\/(mp4|webm|quicktime))$/i.test(file.mimetype);
    cb(allowed ? null : new Error("Only image, MP4, WEBM, or MOV files are allowed."), allowed);
  },
});

const musicUpload = multer({
  dest: MUSIC_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = /^audio\/(mpeg|mp3|wav|ogg|oga|opus|webm|aac|flac|mp4|x-m4a)$/i.test(file.mimetype);
    const allowedExtension = /\.(mp3|wav|ogg|oga|opus|webm|aac|flac|m4a|mp4)$/i.test(file.originalname);
    cb(allowedMime || allowedExtension ? null : new Error("Only common audio files are allowed."), allowedMime || allowedExtension);
  },
});

const profileUpload = multer({
  dest: PROFILE_DIR,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(file.mimetype === "image/png" ? null : new Error("Only PNG files are allowed."), file.mimetype === "image/png"),
});

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.get("/", (req, res) => {
  if (!currentUser(req)) return res.redirect("/login");
  res.render("admin/dashboard");
});
app.get("/home", (req, res) => {
  if (!currentUser(req)) return res.redirect("/login");
  res.redirect("/");
});
app.get(["/team", "/settings", "/users", "/account", "/pterodactyl"], (req, res) => {
  if (!currentUser(req)) return res.redirect("/login");
  res.render("admin/dashboard");
});
app.get("/login", (_req, res) => res.render("auth/login", { initialTheme: loadTheme() }));
app.get("/register", (_req, res) => res.render("auth/register", { initialTheme: loadTheme() }));
app.get(["/portal", "/portal/"], (_req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "portal", "index.html"))
);
app.use(express.static(PUBLIC_DIR, { index: false }));
app.use("/Background", express.static(BACKGROUND_DIR, { fallthrough: false }));
app.get("/profile/:name", (req, res, next) => {
  const filename = normalizedProfilePic(req.params.name);
  if (!filename) return res.status(204).end();
  next();
});
app.use("/profile", express.static(PROFILE_DIR, { fallthrough: false }));
app.use("/media", express.static(MEDIA_DIR, { fallthrough: false }));

app.get("/api/theme", (_req, res) => res.json(loadTheme()));

app.get("/api/wallpapers/categories", authRequired, (_req, res) => {
  res.json({ success: true, categories: CATEGORIES });
});

app.get("/api/wallpapers", authRequired, async (req, res) => {
  try {
    const result = await getWallpapers({
      category: req.query.category,
      page: req.query.page,
      query: req.query.query,
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ success: false, message: error.message || "Wallpaper service unavailable." });
  }
});

app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!validUsername(username)) return res.status(400).json({ success: false, message: "Username must be 3–32 characters and use letters, numbers, dots, dashes, or underscores." });
  if (!email) return res.status(400).json({ success: false, message: "Email is required." });
  if (!validEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  if (email && isDisposableEmail(email)) return res.status(400).json({ success: false, message: "Temporary or disposable email addresses are not allowed." });
  if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
  const data = loadUsers();
  if (data.users.some((user) => normalizeUsername(user.username) === normalizeUsername(username))) {
    return res.status(409).json({ success: false, message: "That username is already in use." });
  }
  if (data.users.some((user) => normalizeUsername(user.email) === normalizeUsername(email))) {
    return res.status(409).json({ success: false, message: "That email is already in use." });
  }
  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await bcrypt.hash(password, 10),
    role: data.users.length === 0 ? "owner" : "member",
    status: "active",
    createdAt: Date.now(),
    lastLogin: null,
    profilePic: "",
    email,
    bio: "",
  };
  data.users.push(user);
  saveUsers(data);
  res.status(201).json({ success: true, user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const identifier = normalizeUsername(req.body.username);
  const password = String(req.body.password || "");
  const data = loadUsers();
  const user = data.users.find((candidate) => normalizeUsername(candidate.username) === identifier || normalizeUsername(candidate.email) === identifier);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: "Invalid username or password." });
  }
  if ((user.status || "active") !== "active") return res.status(403).json({ success: false, message: "This account is not active." });
  user.lastLogin = { ip: req.ip, device: /mobile|android|iphone/i.test(req.get("user-agent") || "") ? "Mobile" : "Desktop", ts: Date.now() };
  saveUsers(data);
  req.session.userId = user.id;
  markOnline(user.id, req.sessionID);
  res.json({ success: true, user: publicUser(user) });
});

app.post(["/logout", "/api/logout"], (req, res) => {
  const user = currentUser(req);
  markOffline(user?.id, req.sessionID);
  req.session.destroy(() => res.json({ success: true }));
});

app.get("/api/me", authRequired, (req, res) => res.json({ success: true, user: publicUser(req.user) }));

app.post("/api/me/email", authRequired, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (email && !validEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  if (email && isDisposableEmail(email)) return res.status(400).json({ success: false, message: "Temporary or disposable email addresses are not allowed." });
  const data = loadUsers();
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  user.email = email;
  saveUsers(data);
  req.user.email = email;
  res.json({ success: true, user: publicUser(user) });
});

app.get("/api/team", authRequired, (_req, res) => {
  const data = loadUsers();
  res.json({
    success: true,
    users: data.users.map((user) => ({ ...publicUser(user), online: isOnline(user.id) })),
  });
});

app.get("/api/users", adminRequired, (_req, res) => {
  const data = loadUsers();
  res.json({
    success: true,
    users: data.users.map((user) => ({ ...publicUser(user), online: isOnline(user.id) })),
  });
});

app.post("/api/users", adminRequired, async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const requestedRole = String(req.body.role || "member").toLowerCase();
  if (!validUsername(username)) return res.status(400).json({ success: false, message: "Enter a valid username." });
  if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
  if (!["member", "admin"].includes(requestedRole) || (requestedRole === "admin" && req.user.role !== "owner")) {
    return res.status(403).json({ success: false, message: "You cannot create that role." });
  }
  const data = loadUsers();
  if (data.users.some((user) => normalizeUsername(user.username) === normalizeUsername(username))) return res.status(409).json({ success: false, message: "That username is already in use." });
  const user = { id: crypto.randomUUID(), username, passwordHash: await bcrypt.hash(password, 10), role: requestedRole, status: "active", createdAt: Date.now(), lastLogin: null, profilePic: "", email: "", bio: "" };
  data.users.push(user);
  saveUsers(data);
  res.status(201).json({ success: true, user: publicUser(user) });
});

app.delete("/api/users/:id", adminRequired, (req, res) => {
  const data = loadUsers();
  const target = data.users.find((user) => user.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, message: "User not found." });
  const allowed = req.user.role === "owner" ? target.id !== req.user.id : target.role === "member";
  if (!allowed) return res.status(403).json({ success: false, message: "You cannot delete this account." });
  data.users = data.users.filter((user) => user.id !== target.id);
  saveUsers(data);
  res.json({ success: true });
});

app.post("/api/theme", adminRequired, (req, res) => {
  const theme = sanitizeTheme(req.body);
  saveTheme(theme);
  res.json({ success: true, theme });
});

app.get("/api/general", authRequired, (_req, res) => {
  res.json({ success: true, general: loadGeneral() });
});

app.post("/api/general", adminRequired, (req, res) => {
  const general = saveGeneral(req.body);
  res.json({ success: true, general });
});

app.get("/api/bars", authRequired, (_req, res) => {
  res.json({ success: true, bars: loadBars() });
});

app.post("/api/bars", adminRequired, (req, res) => {
  const bars = saveBars(req.body);
  res.json({ success: true, bars });
});



app.get("/api/infrastructure", authRequired, (_req, res) => res.json({ success: true, infrastructure: loadInfrastructure() }));

app.post("/api/infrastructure/sync", adminRequired, (_req, res) => {
  const value = loadInfrastructure();
  value.lastSync = Date.now();
  infraEvent(value, "Pterodactyl control plane sync completed", "success");
  res.json({ success: true, infrastructure: saveInfrastructure(value) });
});

app.post("/api/infrastructure/servers", adminRequired, (req, res) => {
  const value = loadInfrastructure();
  const nodeId = value.nodes.some((node) => node.id === req.body.nodeId) ? req.body.nodeId : value.nodes[0]?.id;
  if (!nodeId) return res.status(400).json({ success: false, message: "Create a Wings node before adding a server." });
  const server = { id: `srv-${crypto.randomBytes(4).toString("hex")}`, name: infraString(req.body.name, "New server", 80), identifier: infraId(req.body.identifier, `srv-${crypto.randomBytes(2).toString("hex")}`), nodeId, game: infraString(req.body.game, "Generic", 48), status: "stopped", memoryUsed: 0, memoryLimit: Math.max(0.1, Number(req.body.memoryLimit) || 2), diskUsed: 0, diskLimit: Math.max(0.1, Number(req.body.diskLimit) || 20), uptime: "—", image: infraString(req.body.image, "ghcr.io/pterodactyl/yolks:nodejs_22", 160), allocation: infraString(req.body.allocation, "Pending allocation", 80), lastAction: "Created locally" };
  value.servers.unshift(server);
  infraEvent(value, `${server.name} was created on ${nodeId}`, "info");
  res.status(201).json({ success: true, infrastructure: saveInfrastructure(value) });
});

app.post("/api/infrastructure/servers/:id/power", adminRequired, (req, res) => {
  const signal = String(req.body.signal || "").toLowerCase();
  const nextStatus = { start: "running", restart: "running", stop: "stopped", kill: "stopped" }[signal];
  if (!nextStatus) return res.status(400).json({ success: false, message: "Unsupported power action." });
  const value = loadInfrastructure();
  const server = value.servers.find((candidate) => candidate.id === req.params.id);
  if (!server) return res.status(404).json({ success: false, message: "Server not found." });
  server.status = nextStatus;
  server.uptime = nextStatus === "running" ? "just now" : "—";
  server.lastAction = `${signal[0].toUpperCase()}${signal.slice(1)} signal sent`;
  infraEvent(value, `${server.name}: ${signal} signal sent to Docker container`, signal === "kill" ? "danger" : "success");
  res.json({ success: true, infrastructure: saveInfrastructure(value) });
});

app.get("/api/music", adminRequired, (_req, res) => {
  res.json({ success: true, music: loadMusic() });
});

app.post("/api/music", adminRequired, (req, res) => {
  const current = loadMusic();
  const music = saveMusic({ ...current, ...req.body, tracks: current.tracks });
  res.json({ success: true, music });
});

app.post("/api/music/track", adminRequired, (req, res) => {
  const track = sanitizeMusicTrack({ name: req.body.name, url: req.body.url, source: "external" });
  if (!track) return res.status(400).json({ success: false, message: "Enter a valid HTTP(S) audio URL." });
  const current = loadMusic();
  const tracks = [track, ...current.tracks.filter((candidate) => candidate.url !== track.url)];
  const music = saveMusic({ ...current, tracks, selectedTrackId: current.selectedTrackId || track.id });
  res.status(201).json({ success: true, music });
});

app.post("/api/music/upload", adminRequired, (req, res) => {
  musicUpload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!req.file) return res.status(400).json({ success: false, message: "Choose an audio file to upload." });
    const ext = path.extname(req.file.originalname).toLowerCase() || ".mp3";
    const finalName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const finalPath = path.join(MUSIC_DIR, finalName);
    fs.renameSync(req.file.path, finalPath);
    const track = sanitizeMusicTrack({ name: path.basename(req.file.originalname, ext), url: `/media/music/${encodeURIComponent(finalName)}`, source: "upload" });
    const current = loadMusic();
    const music = saveMusic({ ...current, tracks: [track, ...current.tracks], selectedTrackId: current.selectedTrackId || track.id });
    res.status(201).json({ success: true, music });
  });
});

app.delete("/api/music/:id", adminRequired, (req, res) => {
  const current = loadMusic();
  const track = current.tracks.find((candidate) => candidate.id === req.params.id);
  if (!track) return res.status(404).json({ success: false, message: "Music track not found." });
  if (track.source === "upload" && track.url.startsWith("/media/music/")) {
    const filename = safeFileName(decodeURIComponent(track.url.split("/").pop() || ""));
    const file = path.join(MUSIC_DIR, filename);
    if (filename && fs.existsSync(file)) fs.unlinkSync(file);
  }
  const tracks = current.tracks.filter((candidate) => candidate.id !== track.id);
  const music = saveMusic({ ...current, tracks, selectedTrackId: current.selectedTrackId === track.id ? tracks[0]?.id || "" : current.selectedTrackId });
  res.json({ success: true, music });
});

app.get("/api/media/list", adminRequired, (_req, res) => res.json({ success: true, files: listMedia() }));
app.post("/api/media/upload", adminRequired, (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!req.file) return res.status(400).json({ success: false, message: "Choose a file to upload." });
    const ext = path.extname(req.file.originalname).toLowerCase() || ".bin";
    const finalName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const finalPath = path.join(MEDIA_DIR, finalName);
    fs.renameSync(req.file.path, finalPath);
    res.status(201).json({ success: true, filename: finalName, url: `/media/${encodeURIComponent(finalName)}` });
  });
});
app.delete("/api/media/:name", adminRequired, (req, res) => {
  const name = safeFileName(req.params.name);
  const file = path.join(MEDIA_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ success: false, message: "Media file not found." });
  fs.unlinkSync(file);
  res.json({ success: true });
});

app.post("/api/profile/pic", authRequired, (req, res) => {
  profileUpload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!req.file) return res.status(400).json({ success: false, message: "Choose a PNG file." });
    const filename = `profile_${req.user.id}.png`;
    const finalPath = path.join(PROFILE_DIR, filename);
    fs.renameSync(req.file.path, finalPath);
    const data = loadUsers();
    const user = data.users.find((candidate) => candidate.id === req.user.id);
    if (user) { user.profilePic = filename; saveUsers(data); }
    res.json({ success: true, filename });
  });
});

app.post("/api/me/password", authRequired, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 8) return res.status(400).json({ success: false, message: "New password must be at least 8 characters." });
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) return res.status(400).json({ success: false, message: "Current password is incorrect." });
  const data = loadUsers();
  const user = data.users.find((candidate) => candidate.id === req.user.id);
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  saveUsers(data);
  res.json({ success: true });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API route not found." });
  }
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  res.status(404).render("errors/404");
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error." });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`BT PANEL running at http://localhost:${PORT}`));
}

module.exports = app;
