const API_BASE = window.API_BASE !== undefined ? window.API_BASE : (window.location.hostname === 'localhost' ? 'http://localhost:4000' : '');
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const username = loginForm.username.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    showLoginMessage("Please enter both username and password.", "warning");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403 && data.message === 'Account is inactive.') {
        showLoginMessage('Your account is inactive. Please contact a manager to reactivate your access.', 'warning');
      } else {
        showLoginMessage(data.message || "Login failed.", "warning");
      }
      return;
    }

    if (window.auth && typeof window.auth.setToken === 'function') {
      window.auth.setToken(data.token);
    } else {
      localStorage.setItem("rms_token", data.token);
    }
    showLoginMessage(`Welcome ${data.user.username}! Redirecting...`, "success");
    if (data.user.role === "manager") {
      window.location.href = "assets/pages/manager-dashboard.html";
    } else if (data.user.role === "cashier") {
      window.location.href = "assets/pages/cashier-dashboard.html";
    } else {
      showLoginMessage("Unauthorized role.", "warning");
    }
  } catch (error) {
    console.error(error);
    showLoginMessage("Unable to connect to the server.", "warning");
  }
});

togglePassword.addEventListener("click", () => {
  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  togglePassword.textContent = isVisible ? "👁" : "🙈";
  togglePassword.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
});

function showLoginMessage(message, variant) {
  loginMessage.textContent = message;
  loginMessage.style.color = variant === "success" ? "#0f4b80" : "#7f3f00";
}
