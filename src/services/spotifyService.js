const API_BASE = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const DEFAULT_MARKET = "US";

let clientToken = null;

function getConfig() {
  return {
    clientId: String(process.env.SPOTIFY_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.SPOTIFY_CLIENT_SECRET || "").trim(),
    redirectUri: String(process.env.SPOTIFY_REDIRECT_URI || "").trim(),
    market: String(process.env.SPOTIFY_MARKET || DEFAULT_MARKET).trim().toUpperCase() || DEFAULT_MARKET,
  };
}

function isConfigured() {
  const { clientId, clientSecret } = getConfig();
  return Boolean(clientId && clientSecret);
}

function isOAuthConfigured() {
  const { redirectUri } = getConfig();
  return isConfigured() && Boolean(redirectUri);
}

function spotifyError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function basicAuthHeader() {
  const { clientId, clientSecret } = getConfig();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function tokenIsFresh(token) {
  return Boolean(token?.accessToken && Number(token.expiresAt) > Date.now() + 60_000);
}

function buildAuthorizeUrl(state) {
  if (!isOAuthConfigured()) throw spotifyError("Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI.", 503);
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ];
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes.join(" "),
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function requestToken(form) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw spotifyError(data.error_description || data.error || "Spotify token request failed.", response.status || 502);
  }
  return data;
}

async function getClientAccessToken() {
  if (!isConfigured()) throw spotifyError("Spotify search is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.", 503);
  if (tokenIsFresh(clientToken)) return clientToken.accessToken;
  const data = await requestToken({ grant_type: "client_credentials" });
  clientToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return clientToken.accessToken;
}

async function exchangeAuthorizationCode(code) {
  if (!isOAuthConfigured()) throw spotifyError("Spotify OAuth is not configured.", 503);
  const { redirectUri } = getConfig();
  return requestToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

async function refreshUserToken(sessionSpotify) {
  if (!sessionSpotify?.refreshToken) throw spotifyError("Connect Spotify before using playback controls.", 401);
  const data = await requestToken({ grant_type: "refresh_token", refresh_token: sessionSpotify.refreshToken });
  const next = {
    ...sessionSpotify,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || sessionSpotify.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return next;
}

async function getUserAccessToken(session) {
  if (!session?.spotify) throw spotifyError("Connect Spotify before using playback controls.", 401);
  if (tokenIsFresh(session.spotify)) return session.spotify.accessToken;
  const refreshed = await refreshUserToken(session.spotify);
  session.spotify = refreshed;
  return refreshed.accessToken;
}

function hasUserSession(session) {
  return Boolean(session?.spotify?.accessToken || session?.spotify?.refreshToken);
}

async function apiRequest(accessToken, endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || "Spotify API request failed.";
    throw spotifyError(message, response.status || 502);
  }
  return data;
}

function mapTrack(track) {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: Array.isArray(track.artists) ? track.artists.map((artist) => artist.name).filter(Boolean) : [],
    album: track.album?.name || "",
    image: track.album?.images?.[0]?.url || "",
    durationMs: Number(track.duration_ms) || 0,
    externalUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${encodeURIComponent(track.id || "")}`,
    isPlayable: track.is_playable !== false,
  };
}

async function searchTracks(query, accessToken) {
  const { market } = getConfig();
  const params = new URLSearchParams({ q: query, type: "track", market, limit: "10" });
  const data = await apiRequest(accessToken, `/search?${params.toString()}`);
  return (data?.tracks?.items || []).map(mapTrack);
}

async function getCurrentUser(accessToken) {
  const data = await apiRequest(accessToken, "/me");
  return {
    id: data?.id || "",
    displayName: data?.display_name || data?.id || "Spotify user",
    product: data?.product || "",
    country: data?.country || "",
  };
}

function validateTrackUri(uri) {
  const value = String(uri || "").trim();
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(value)) throw spotifyError("Only Spotify track URIs are supported.", 400);
  return value;
}

async function transferToDevice(accessToken, deviceId) {
  const id = String(deviceId || "").trim();
  if (!id) return;
  await apiRequest(accessToken, "/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [id], play: false }),
  });
}

async function playTrack(session, uri, deviceId) {
  const accessToken = await getUserAccessToken(session);
  const trackUri = validateTrackUri(uri);
  await transferToDevice(accessToken, deviceId);
  const params = deviceId ? `?device_id=${encodeURIComponent(String(deviceId))}` : "";
  await apiRequest(accessToken, `/me/player/play${params}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [trackUri] }),
  });
}

async function queueTrack(session, uri, deviceId) {
  const accessToken = await getUserAccessToken(session);
  const trackUri = validateTrackUri(uri);
  const params = new URLSearchParams({ uri: trackUri });
  if (deviceId) params.set("device_id", String(deviceId));
  await apiRequest(accessToken, `/me/player/queue?${params.toString()}`, { method: "POST" });
}

async function controlPlayer(session, action, deviceId) {
  const accessToken = await getUserAccessToken(session);
  const allowed = { pause: "pause", resume: "play", next: "next", previous: "previous" };
  const endpoint = allowed[String(action || "").toLowerCase()];
  if (!endpoint) throw spotifyError("Unsupported Spotify playback action.", 400);
  const params = deviceId ? `?device_id=${encodeURIComponent(String(deviceId))}` : "";
  const method = endpoint === "next" || endpoint === "previous" ? "POST" : "PUT";
  await apiRequest(accessToken, `/me/player/${endpoint}${params}`, { method });
}

async function seekPlayer(session, positionMs, deviceId) {
  const accessToken = await getUserAccessToken(session);
  const position = Math.max(0, Math.floor(Number(positionMs)));
  if (!Number.isFinite(position)) throw spotifyError("Enter a valid playback position.", 400);
  const params = new URLSearchParams({ position_ms: String(position) });
  if (deviceId) params.set("device_id", String(deviceId));
  await apiRequest(accessToken, `/me/player/seek?${params.toString()}`, { method: "PUT" });
}

async function setPlayerVolume(session, volumePercent, deviceId) {
  const accessToken = await getUserAccessToken(session);
  const volume = Math.min(100, Math.max(0, Math.floor(Number(volumePercent))));
  if (!Number.isFinite(volume)) throw spotifyError("Enter a valid volume level.", 400);
  const params = new URLSearchParams({ volume_percent: String(volume) });
  if (deviceId) params.set("device_id", String(deviceId));
  await apiRequest(accessToken, `/me/player/volume?${params.toString()}`, { method: "PUT" });
}

module.exports = {
  buildAuthorizeUrl,
  controlPlayer,
  exchangeAuthorizationCode,
  getClientAccessToken,
  getConfig,
  getCurrentUser,
  getUserAccessToken,
  hasUserSession,
  isConfigured,
  isOAuthConfigured,
  playTrack,
  queueTrack,
  searchTracks,
  seekPlayer,
  setPlayerVolume,
};
