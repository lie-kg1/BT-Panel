(() => {
  const searchButton = document.getElementById("searchButton");
  const portalSearch = document.getElementById("portalSearch");
  const serverSearch = document.getElementById("serverSearch");
  const serverSwitch = document.getElementById("serverSwitch");
  const serverFilterLabel = document.getElementById("serverFilterLabel");
  const accountButton = document.getElementById("accountButton");
  const accountMenu = document.getElementById("accountMenu");
  const settingsButton = document.getElementById("settingsButton");
  const logoutButton = document.getElementById("logoutButton");
  const menuLogoutButton = document.getElementById("menuLogoutButton");
  const toast = document.getElementById("portalToast");
  let toastTimer;

  function showToast(message, type = "") {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `portal-toast visible ${type}`;
    toastTimer = window.setTimeout(() => { toast.className = "portal-toast"; }, 2400);
  }

  function closeAccountMenu() {
    if (!accountMenu || !accountButton) return;
    accountMenu.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
  }

  searchButton?.addEventListener("click", () => {
    const isOpen = !portalSearch.hidden;
    closeAccountMenu();
    portalSearch.hidden = isOpen;
    searchButton.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) window.setTimeout(() => serverSearch?.focus(), 0);
  });

  serverSwitch?.addEventListener("click", () => {
    const nextState = serverSwitch.getAttribute("aria-checked") !== "true";
    serverSwitch.setAttribute("aria-checked", String(nextState));
    if (serverFilterLabel) serverFilterLabel.textContent = nextState ? "SHOWING YOUR SERVERS" : "SHOWING HIDDEN SERVERS";
  });

  accountButton?.addEventListener("click", () => {
    const isOpen = !accountMenu.hidden;
    portalSearch.hidden = true;
    searchButton?.setAttribute("aria-expanded", "false");
    accountMenu.hidden = isOpen;
    accountButton.setAttribute("aria-expanded", String(!isOpen));
  });

  settingsButton?.addEventListener("click", () => showToast("Client settings are ready to configure."));
  document.querySelector(".portal-icon-button.active")?.addEventListener("click", () => showToast("You are viewing your servers."));

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch (_) {
      // The static portal remains usable even when no BT Panel session exists.
    }
    window.location.href = "/login";
  }

  logoutButton?.addEventListener("click", logout);
  menuLogoutButton?.addEventListener("click", logout);

  document.addEventListener("click", (event) => {
    if (!accountMenu?.hidden && !accountMenu.contains(event.target) && !accountButton?.contains(event.target)) closeAccountMenu();
    if (!portalSearch?.hidden && !portalSearch.contains(event.target) && !searchButton?.contains(event.target)) {
      portalSearch.hidden = true;
      searchButton?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAccountMenu();
      if (portalSearch) portalSearch.hidden = true;
      searchButton?.setAttribute("aria-expanded", "false");
    }
  });
})();
