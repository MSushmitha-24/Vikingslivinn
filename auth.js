const TOKEN_KEY = "vikingsLivinnToken";
const ROLE_KEY = "vikingsLivinnRole";

function saveSession(token, role) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    clearSession();
    window.location.href = "/login.html";
    throw new Error("Please login again.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

async function requireRole(role) {
  if (!getToken() || getRole() !== role) {
    window.location.href = "/login.html";
    return null;
  }

  const data = await apiFetch("/api/me");
  if (data.user.role !== role) {
    clearSession();
    window.location.href = "/login.html";
    return null;
  }

  return data.user;
}

// document.querySelector("[data-logout]")?.addEventListener("click", () => {
//   clearSession();
//   window.location.href = "/login.html";
// });

window.onload = function () {
  const logoutBtn = document.querySelector("[data-logout]");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "/login.html";
    });
  }
};