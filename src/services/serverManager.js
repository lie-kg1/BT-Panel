const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const Docker = require("dockerode");
const archiver = require("archiver");
const extract = require("extract-zip");

const ROOT = path.resolve(__dirname, "../..");
const IS_VERCEL = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const RUNTIME_ROOT = IS_VERCEL ? path.resolve(process.env.BT_PANEL_RUNTIME_DIR || path.join("/tmp", "bt-panel")) : ROOT;
const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const SERVERS_DIR = path.join(DATA_DIR, "servers");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const NODES_FILE = path.join(DATA_DIR, "nodes.json");
const SERVERS_FILE = path.join(DATA_DIR, "servers.json");
const TEMP_DIR = path.join(DATA_DIR, "temp");
const mockState = new Map();
const mockStartedAt = new Map();
let dockerInstance;
let ioInstance = null;

for (const directory of [SERVERS_DIR, BACKUPS_DIR, TEMP_DIR]) fs.mkdirSync(directory, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

async function writeJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temporary, file);
}

function defaultNodes() {
  return [{ id: "local", name: "Local Docker", host: "local", port: 2375, scheme: "unix", status: dockerAvailable() ? "online" : "unavailable", createdAt: Date.now() }];
}

function loadNodes() {
  const nodes = readJson(NODES_FILE, defaultNodes());
  return Array.isArray(nodes) && nodes.length ? nodes : defaultNodes();
}

function loadServers() {
  const servers = readJson(SERVERS_FILE, []);
  return Array.isArray(servers) ? servers : [];
}

function resolveFilePath(user, id, relativePath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  return safeServerPath(id, relativePath);
}

async function listNodes(user) {
  assertAdmin(user);
  return loadNodes().map((node) => ({
    ...node,
    status: node.id === "local" ? (dockerAvailable() ? "online" : "unavailable") : node.status || "unknown",
    dockerAvailable: node.id === "local" ? dockerAvailable() : Boolean(node.host),
  }));
}

async function createNode(user, input) {
  assertAdmin(user);
  const name = String(input?.name || "").trim().slice(0, 80);
  const host = String(input?.host || "").trim().slice(0, 255);
  if (!name || !host) throw Object.assign(new Error("Node name and host are required."), { status: 400 });
  const nodes = loadNodes();
  const node = { id: crypto.randomUUID(), name, host, port: Math.max(1, Math.min(65535, Number(input.port) || 2375)), scheme: input.scheme === "https" ? "https" : "http", status: "pending", createdAt: Date.now() };
  nodes.push(node);
  await writeJson(NODES_FILE, nodes);
  return node;
}

async function deleteNode(user, id) {
  assertAdmin(user);
  if (id === "local") throw Object.assign(new Error("The local node cannot be deleted."), { status: 400 });
  const nodes = loadNodes();
  const remaining = nodes.filter((node) => node.id !== id);
  if (remaining.length === nodes.length) throw Object.assign(new Error("Node not found."), { status: 404 });
  await writeJson(NODES_FILE, remaining);
}

function setIo(io) { ioInstance = io; }

function dockerSocketPath() {
  const configured = String(process.env.DOCKER_SOCKET_PATH || "").trim();
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform === "win32") return "//./pipe/docker_engine";
  if (fs.existsSync("/var/run/docker.sock")) return "/var/run/docker.sock";
  if (fs.existsSync("/run/docker.sock")) return "/run/docker.sock";
  return "/var/run/docker.sock";
}

function dockerAvailable() {
  if (process.platform === "win32") return true;
  return fs.existsSync(dockerSocketPath());
}

function getDocker() {
  if (!dockerInstance) {
    dockerInstance = process.platform === "win32" ? new Docker() : new Docker({ socketPath: dockerSocketPath() });
  }
  return dockerInstance;
}

function serverRoot(serverId) {
  const id = String(serverId || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid server identifier.");
  return path.join(SERVERS_DIR, id);
}

function safeServerPath(serverId, relativePath = "/") {
  const base = serverRoot(serverId);
  const resolved = path.resolve(base, String(relativePath || "/"));
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) throw new Error("Invalid file path.");
  return resolved;
}

function safeName(value, fallback = "file") {
  const name = path.basename(String(value || "").trim());
  return name && name !== "." && name !== ".." ? name.slice(0, 180) : fallback;
}

function isAdmin(user) { return Boolean(user && ["owner", "admin"].includes(user.role)); }
function canAccess(user, server) { return Boolean(server && (isAdmin(user) || server.owner === user?.id)); }
function assertAccess(user, server) { if (!server) throw Object.assign(new Error("Server not found."), { status: 404 }); if (!canAccess(user, server)) throw Object.assign(new Error("You do not have access to this server."), { status: 403 }); }
function assertAdmin(user) { if (!isAdmin(user)) throw Object.assign(new Error("Administrator permission required."), { status: 403 }); }

function isJavaServer(server) {
  return /java|minecraft|paper|spigot|purpur|forge|fabric|vanilla|velocity|bungeecord|waterfall/i.test([server.type, server.name, server.version].join(" "));
}

function normalizeServer(server) {
  const safe = server || {};
  return {
    id: String(safe.id || ""),
    name: String(safe.name || "Unnamed server").slice(0, 80),
    owner: String(safe.owner || ""),
    ram: Math.max(1, Math.min(1024, Number(safe.ram) || 2)),
    cpu: Math.max(1, Math.min(10000, Number(safe.cpu) || 100)),
    disk: Math.max(1, Math.min(10240, Number(safe.disk) || 10)),
    port: Math.max(1, Math.min(65535, Number(safe.port) || 25565)),
    ipAlias: String(safe.ipAlias || "").slice(0, 120),
    nodeId: String(safe.nodeId || "local"),
    type: String(safe.type || "PAPER").toUpperCase().slice(0, 32),
    version: String(safe.version || "latest").slice(0, 32),
    theme: String(safe.theme || "default").slice(0, 32),
    status: String(safe.status || "offline"),
    suspended: Boolean(safe.suspended),
    suspendDuration: safe.suspendDuration || null,
    containerId: safe.containerId || null,
    createdAt: safe.createdAt || new Date().toISOString(),
  };
}

function publicServer(server) {
  const normalized = normalizeServer(server);
  return { ...normalized, java: isJavaServer(normalized), address: normalized.ipAlias || `127.0.0.1:${normalized.port}` };
}

function serverImage(server) {
  return ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(server.type) ? "itzg/bungeecord:latest" : "itzg/minecraft-server:latest";
}

async function pullImage(image) {
  const docker = getDocker();
  const stream = await new Promise((resolve, reject) => docker.pull(image, (error, result) => error ? reject(error) : resolve(result)));
  await new Promise((resolve, reject) => docker.modem.followProgress(stream, (error) => error ? reject(error) : resolve()));
}

async function ensureImage(image) {
  const docker = getDocker();
  const images = await docker.listImages();
  if (images.some((item) => (item.RepoTags || []).includes(image))) return image;
  await pullImage(image);
  return image;
}

async function createContainer(server) {
  if (!dockerAvailable()) return `mock-container-id-${server.id}`;
  const docker = getDocker();
  const image = await ensureImage(serverImage(server));
  const directory = serverRoot(server.id);
  await fsp.mkdir(directory, { recursive: true });
  const isProxy = ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(server.type);
  const env = [
    `TYPE=${server.type}`,
    `VERSION=${server.version}`,
    `MEMORY=${server.ram}G`,
    `INIT_MEMORY=128M`,
    `SERVER_PORT=${server.port}`,
    ...(isProxy ? [] : ["EULA=TRUE", "ENABLE_RCON=true", "RCON_PASSWORD=change-this-rcon-password"]),
  ];
  const portKey = `${server.port}/tcp`;
  const container = await docker.createContainer({
    Image: image,
    name: `bt-panel-server-${server.id}`,
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    Env: env,
    ExposedPorts: { [portKey]: {} },
    HostConfig: { Binds: [`${directory}:${isProxy ? "/server" : "/data"}`], PortBindings: { [portKey]: [{ HostPort: String(server.port) }] }, Memory: server.ram * 1024 * 1024 * 1024, CpuPercent: server.cpu },
  });
  return container.id;
}

async function inspectStatus(server) {
  if (!server.containerId) return "offline";
  if (server.containerId.startsWith("mock-container-id-")) return mockState.get(server.id) ? "online" : "offline";
  if (!dockerAvailable()) return "unavailable";
  try { return (await getDocker().getContainer(server.containerId).inspect()).State?.Running ? "online" : "offline"; } catch (_) { return "offline"; }
}

async function listServers(user) {
  const all = loadServers();
  const visible = isAdmin(user) ? all : all.filter((server) => server.owner === user?.id);
  const result = [];
  for (const server of visible) {
    const normalized = normalizeServer(server);
    normalized.status = await inspectStatus(normalized);
    result.push(publicServer(normalized));
  }
  return result;
}

async function getServer(user, id) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const normalized = normalizeServer(server);
  normalized.status = await inspectStatus(normalized);
  return publicServer(normalized);
}

async function createServer(user, input) {
  assertAdmin(user);
  const name = String(input?.name || "").trim().slice(0, 80);
  if (!name) throw Object.assign(new Error("Server name is required."), { status: 400 });
  const port = Number(input?.port || 25565);
  const servers = loadServers();
  if (servers.some((server) => Number(server.port) === port)) throw Object.assign(new Error("That port is already in use."), { status: 409 });
  const server = normalizeServer({ id: crypto.randomUUID(), name, owner: input.owner || user.id, ram: input.ram, cpu: input.cpu, disk: input.disk, port, ipAlias: input.ipAlias, nodeId: input.nodeId, type: input.type, version: input.version, theme: input.theme, status: "installing" });
  await fsp.mkdir(serverRoot(server.id), { recursive: true });
  try {
    server.containerId = await createContainer(server);
    server.status = "offline";
  } catch (error) {
    server.status = "error";
    server.error = String(error.message || error).slice(0, 300);
  }
  servers.push(server);
  await writeJson(SERVERS_FILE, servers);
  return publicServer(server);
}

async function updateServer(user, id, input) {
  const servers = loadServers();
  const server = servers.find((candidate) => candidate.id === id);
  assertAccess(user, server);
  if (!isAdmin(user) && (input.ram !== undefined || input.cpu !== undefined || input.disk !== undefined)) assertAdmin(user);
  const next = normalizeServer({ ...server, ...input, id: server.id, owner: server.owner, port: server.port });
  Object.assign(server, next);
  await writeJson(SERVERS_FILE, servers);
  return publicServer(server);
}

async function deleteServer(user, id) {
  assertAdmin(user);
  const servers = loadServers();
  const server = servers.find((candidate) => candidate.id === id);
  if (!server) throw Object.assign(new Error("Server not found."), { status: 404 });
  if (server.containerId && !server.containerId.startsWith("mock-container-id-") && dockerAvailable()) {
    try { await getDocker().getContainer(server.containerId).remove({ force: true }); } catch (_) {}
  }
  await fsp.rm(serverRoot(id), { recursive: true, force: true });
  await writeJson(SERVERS_FILE, servers.filter((candidate) => candidate.id !== id));
}

async function powerServer(user, id, action) {
  const servers = loadServers();
  const server = servers.find((candidate) => candidate.id === id);
  assertAccess(user, server);
  if (server.suspended) throw Object.assign(new Error("Server is suspended."), { status: 403 });
  const allowed = new Set(["start", "stop", "restart"]);
  if (!allowed.has(action)) throw Object.assign(new Error("Unsupported power action."), { status: 400 });
  if (!server.containerId) server.containerId = await createContainer(server);
  if (server.containerId.startsWith("mock-container-id-") || !dockerAvailable()) {
    if (action === "stop") { mockState.set(server.id, false); mockStartedAt.delete(server.id); }
    else { mockState.set(server.id, true); mockStartedAt.set(server.id, new Date().toISOString()); }
  } else {
    const container = getDocker().getContainer(server.containerId);
    if (action === "start") await container.start();
    if (action === "stop") await container.stop();
    if (action === "restart") await container.restart();
  }
  await writeJson(SERVERS_FILE, servers);
  return publicServer(server);
}

async function sendCommand(user, id, command) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const value = String(command || "").trim().slice(0, 2000);
  if (!value) throw Object.assign(new Error("Command is required."), { status: 400 });
  if (server.containerId && !server.containerId.startsWith("mock-container-id-") && dockerAvailable()) {
    const container = getDocker().getContainer(server.containerId);
    const exec = await container.exec({ Cmd: ["sh", "-lc", value], AttachStdout: true, AttachStderr: true });
    const stream = await exec.start({ hijack: true, stdin: false });
    stream.resume();
  }
  ioInstance?.to(`server_${id}`).emit("log", `[command] ${value}\n`);
}

async function getStats(user, id) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const status = await inspectStatus(server);
  if (server.containerId && !server.containerId.startsWith("mock-container-id-") && dockerAvailable()) {
    try {
      const stats = await getDocker().getContainer(server.containerId).stats({ stream: false });
      const cpuDelta = Number(stats.cpu_stats?.cpu_usage?.total_usage || 0) - Number(stats.precpu_stats?.cpu_usage?.total_usage || 0);
      const systemDelta = Number(stats.cpu_stats?.system_cpu_usage || 0) - Number(stats.precpu_stats?.system_cpu_usage || 0);
      const onlineCpus = Number(stats.cpu_stats?.online_cpus || 1);
      const cpu = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;
      return { cpu: Number(cpu.toFixed(2)), ram: Number((Number(stats.memory_stats?.usage || 0) / 1024 / 1024).toFixed(1)), disk: 0, netIn: Number(stats.networks ? Object.values(stats.networks).reduce((sum, item) => sum + Number(item.rx_bytes || 0), 0) : 0), netOut: Number(stats.networks ? Object.values(stats.networks).reduce((sum, item) => sum + Number(item.tx_bytes || 0), 0) : 0), status };
    } catch (_) {}
  }
  return { cpu: status === "online" ? 5 : 0, ram: status === "online" ? 128 : 0, disk: 0, netIn: 0, netOut: 0, startedAt: mockStartedAt.get(id) || null, status };
}

async function listFiles(user, id, relativePath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const directory = safeServerPath(id, relativePath);
  await fsp.mkdir(directory, { recursive: true });
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  return Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    const stat = await fsp.stat(full);
    return { name: entry.name, path: path.relative(serverRoot(id), full) || "/", isDirectory: entry.isDirectory(), size: stat.size, modifiedAt: stat.mtimeMs };
  }));
}

async function readFile(user, id, relativePath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const target = safeServerPath(id, relativePath);
  const stat = await fsp.stat(target);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw Object.assign(new Error("Only files up to 2 MB can be edited in the panel."), { status: 400 });
  return { path: relativePath, content: await fsp.readFile(target, "utf8") };
}

async function writeFile(user, id, relativePath, content) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const target = safeServerPath(id, relativePath);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, String(content || ""), "utf8");
}

async function createEntry(user, id, relativePath, directory) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const target = safeServerPath(id, relativePath);
  if (directory) await fsp.mkdir(target, { recursive: false });
  else { await fsp.mkdir(path.dirname(target), { recursive: true }); await fsp.writeFile(target, "", { flag: "wx" }); }
}

async function removeEntry(user, id, relativePath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const target = safeServerPath(id, relativePath);
  if (target === serverRoot(id)) throw Object.assign(new Error("The server root cannot be deleted."), { status: 400 });
  await fsp.rm(target, { recursive: true, force: true });
}

async function renameEntry(user, id, oldPath, newPath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  await fsp.rename(safeServerPath(id, oldPath), safeServerPath(id, newPath));
}

async function uploadFile(user, id, relativePath, file) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  if (!file) throw Object.assign(new Error("Choose a file to upload."), { status: 400 });
  const directory = safeServerPath(id, relativePath);
  await fsp.mkdir(directory, { recursive: true });
  await fsp.rename(file.path, path.join(directory, safeName(file.originalname)));
}

async function createBackup(user, id) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const destination = path.join(BACKUPS_DIR, id);
  await fsp.mkdir(destination, { recursive: true });
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const outputPath = path.join(destination, filename);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(serverRoot(id), false);
    archive.finalize();
  });
  return { filename, size: (await fsp.stat(outputPath)).size };
}

async function listBackups(user, id) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const directory = path.join(BACKUPS_DIR, id);
  await fsp.mkdir(directory, { recursive: true });
  const entries = await fsp.readdir(directory);
  return Promise.all(entries.filter((entry) => entry.endsWith(".zip")).map(async (filename) => { const stat = await fsp.stat(path.join(directory, filename)); return { filename, size: stat.size, createdAt: stat.birthtimeMs }; }));
}

async function removeBackup(user, id, filename) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const safe = safeName(filename, "");
  if (!safe.endsWith(".zip")) throw Object.assign(new Error("Invalid backup filename."), { status: 400 });
  await fsp.rm(path.join(BACKUPS_DIR, id, safe), { force: true });
}

async function extractArchive(user, id, relativePath) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const archivePath = safeServerPath(id, relativePath);
  await extract(archivePath, { dir: path.dirname(archivePath) });
}

async function installModrinth(user, id, kind, projectId) {
  const server = loadServers().find((candidate) => candidate.id === id);
  assertAccess(user, server);
  const slug = String(projectId || "").trim().replace(/[^a-zA-Z0-9_.-]/g, "");
  if (!slug) throw Object.assign(new Error("A Modrinth project ID is required."), { status: 400 });
  const response = await fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(slug)}/version`);
  if (!response.ok) throw Object.assign(new Error(`Modrinth request failed (${response.status}).`), { status: 502 });
  const versions = await response.json();
  const version = Array.isArray(versions) ? versions[0] : null;
  const file = version?.files?.find((candidate) => candidate.primary) || version?.files?.[0];
  if (!file?.url) throw Object.assign(new Error("No downloadable Modrinth file was found."), { status: 404 });
  const targetDir = safeServerPath(id, kind === "mod" ? "mods" : "plugins");
  await fsp.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, safeName(file.filename, `${slug}.jar`));
  const download = await fetch(file.url);
  if (!download.ok || !download.body) throw Object.assign(new Error(`Download failed (${download.status}).`), { status: 502 });
  await pipeline(download.body, fs.createWriteStream(targetPath));
  return { filename: path.basename(targetPath), kind, projectId: slug };
}

async function setSuspended(user, id, suspended, duration) {
  assertAdmin(user);
  const servers = loadServers();
  const server = servers.find((candidate) => candidate.id === id);
  if (!server) throw Object.assign(new Error("Server not found."), { status: 404 });
  server.suspended = Boolean(suspended);
  server.suspendDuration = server.suspended ? String(duration || "permanent").slice(0, 32) : null;
  if (server.suspended && server.containerId) await powerServer(user, id, "stop").catch(() => {});
  await writeJson(SERVERS_FILE, servers);
  return publicServer(server);
}

async function getOverview(user) {
  const servers = await listServers(user);
  const nodes = isAdmin(user) ? loadNodes().map((node) => ({ ...node, status: node.id === "local" ? (dockerAvailable() ? "online" : "unavailable") : node.status || "unknown" })) : [];
  return { nodes, servers, javaServers: servers.filter((server) => server.java).length, dockerAvailable: dockerAvailable(), sandboxMode: !dockerAvailable() };
}

module.exports = {
  BACKUPS_DIR,
  SERVERS_DIR,
  getOverview,
  getServer,
  listNodes,
  createNode,
  deleteNode,
  resolveFilePath,
  getStats,
  listBackups,
  listFiles,
  createBackup,
  createEntry,
  createServer,
  deleteServer,
  extractArchive,
  installModrinth,
  listServers,
  powerServer,
  readFile,
  removeBackup,
  removeEntry,
  renameEntry,
  sendCommand,
  setIo,
  setSuspended,
  updateServer,
  uploadFile,
  writeFile,
};
