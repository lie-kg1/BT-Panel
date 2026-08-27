const API_PREFIX = "/api";

function getConfig() {
  const rawUrl = String(process.env.PTERODACTYL_URL || "").trim().replace(/\/+$/, "");
  let url = "";
  try {
    const parsed = new URL(rawUrl);
    if (["http:", "https:"].includes(parsed.protocol)) url = parsed.toString().replace(/\/+$/, "");
  } catch (_error) {
    url = "";
  }
  return {
    url,
    applicationApiKey: String(process.env.PTERODACTYL_APPLICATION_API_KEY || "").trim(),
    clientApiKey: String(process.env.PTERODACTYL_CLIENT_API_KEY || "").trim(),
    timeoutMs: Math.max(1000, Number(process.env.PTERODACTYL_TIMEOUT_MS || 12000)),
  };
}

function isConfigured() {
  const config = getConfig();
  return Boolean(config.url && config.applicationApiKey);
}

function getStatus() {
  const config = getConfig();
  return {
    configured: Boolean(config.url && config.applicationApiKey),
    hasApplicationApiKey: Boolean(config.applicationApiKey),
    hasClientApiKey: Boolean(config.clientApiKey),
    url: config.url,
  };
}

function pterodactylError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") return {};
  return { id: item.attributes?.id ?? item.id, ...(item.attributes || item) };
}

function collectionItems(payload) {
  return Array.isArray(payload?.data) ? payload.data.map(normalizeItem) : [];
}

async function request(path, options = {}) {
  const config = getConfig();
  if (!config.url) throw pterodactylError("Pterodactyl URL is not configured.", 503);
  const apiKey = options.apiKey || config.applicationApiKey;
  if (!apiKey) throw pterodactylError("Pterodactyl API key is not configured.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.url}${API_PREFIX}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "Application/vnd.pterodactyl.v1+json",
        Authorization: `Bearer ${apiKey}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.errors?.[0]?.detail || payload?.message || `Pterodactyl API request failed (${response.status}).`;
      throw pterodactylError(detail, response.status || 502);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw pterodactylError("Pterodactyl API request timed out.", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listNodes() {
  return collectionItems(await request("/application/nodes?per_page=100"));
}

async function listServers() {
  return collectionItems(await request("/application/servers?per_page=100"));
}

async function listNests() {
  return collectionItems(await request("/application/nests?per_page=100"));
}

async function listEggs(nestId) {
  const id = encodeURIComponent(String(nestId || ""));
  if (!id) return [];
  return collectionItems(await request(`/application/nests/${id}/eggs?per_page=100`));
}

async function getOverview() {
  if (!isConfigured()) return { ...getStatus(), nodes: [], servers: [], nests: [], eggs: [] };
  const [nodes, servers, nests] = await Promise.all([listNodes(), listServers(), listNests()]);
  const eggGroups = await Promise.all(nests.map((nest) => listEggs(nest.id)));
  return {
    ...getStatus(),
    nodes,
    servers,
    nests,
    eggs: eggGroups.flat().map((egg) => ({ ...egg, nestId: egg.nestId || egg.nest_id || null })),
  };
}

function requireClientKey() {
  const config = getConfig();
  if (!config.clientApiKey) throw pterodactylError("Pterodactyl Client API key is not configured.", 503);
  return config.clientApiKey;
}

async function powerServer(identifier, signal) {
  const serverId = encodeURIComponent(String(identifier || "").trim());
  if (!serverId) throw pterodactylError("Server identifier is required.", 400);
  const allowed = new Set(["start", "stop", "restart", "kill"]);
  const action = String(signal || "").toLowerCase();
  if (!allowed.has(action)) throw pterodactylError("Unsupported server power action.", 400);
  await request(`/client/servers/${serverId}/power`, {
    method: "POST",
    apiKey: requireClientKey(),
    body: JSON.stringify({ signal: action }),
  });
}

async function getServerResources(identifier) {
  const serverId = encodeURIComponent(String(identifier || "").trim());
  if (!serverId) throw pterodactylError("Server identifier is required.", 400);
  return request(`/client/servers/${serverId}/resources`, { apiKey: requireClientKey() });
}

module.exports = {
  getOverview,
  getStatus,
  getServerResources,
  isConfigured,
  listEggs,
  listNests,
  listNodes,
  listServers,
  powerServer,
};
