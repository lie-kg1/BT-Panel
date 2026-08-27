/* BT PANEL Beta v2.1 shared utility helpers. */

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    data = { success: false, message: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = String(msg);
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

async function signOut() {
  try {
    await postJson("/api/logout");
  } finally {
    window.location.href = "/login";
  }
}
