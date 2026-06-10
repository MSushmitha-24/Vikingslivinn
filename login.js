const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");

if (getToken() && getRole()) {
  window.location.href = getRole() === "admin" ? "/admin.html" : "/customer.html";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Checking credentials...";

  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Invalid login.");
    }

    saveSession(data.token, data.role);
    window.location.href = data.redirectTo;
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});
