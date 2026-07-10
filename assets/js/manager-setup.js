const API_BASE = window.API_BASE !== undefined ? window.API_BASE : (window.location.hostname === 'localhost' ? 'http://localhost:4000' : '');
const managerSetupForm = document.getElementById("managerSetupForm");
const setupMessage = document.getElementById("setupMessage");
const setupStatusMessage = document.getElementById("setupStatusMessage");
const backButton = document.getElementById("backButton");
const logoutButton = document.getElementById("logoutButton");

function setSetupStatusMessage(text, status) {
  if (!setupStatusMessage) return;
  setupStatusMessage.textContent = text;
  setupStatusMessage.classList.remove('status-open', 'status-restricted', 'status-error');
  if (status) {
    setupStatusMessage.classList.add(`status-${status}`);
  }
}

async function checkSetupAccess() {
  setSetupStatusMessage("Checking access to manager setup...");
  try {
    const response = await fetch(`${API_BASE}/api/manager/setup-status`);
    const data = await response.json();

    if (data.hasManager) {
      const token = localStorage.getItem("rms_token");
      if (!token) {
        window.location.href = "login.html";
        return;
      }

      const authResponse = await fetch(`${API_BASE}/api/auth/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!authResponse.ok) {
        window.location.href = "login.html";
        return;
      }

      setSetupStatusMessage("Manager account exists. Access granted for authenticated manager.", 'restricted');
      return;
    }

    setSetupStatusMessage("No manager account found. You can create the first manager account.", 'open');
  } catch (error) {
    console.error(error);
    setSetupStatusMessage("Unable to verify access. Please try again later.", 'error');
    showSetupMessage("Unable to verify access. Please try again later.", "warning");
  }
}

checkSetupAccess();

managerSetupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const username = managerSetupForm.newUsername.value.trim();
  const password = managerSetupForm.newPassword.value.trim();
  const jwtSecret = managerSetupForm.jwtSecret.value.trim();

  if (!username || !password || !jwtSecret) {
    showSetupMessage("Please provide username, password, and the JWT secret.", "warning");
    return;
  }

  try {
    const token = localStorage.getItem("rms_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/manager/setup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password, jwtSecret }),
    });
    const data = await response.json();

    if (!response.ok) {
      showSetupMessage(data.message || "Failed to create manager.", "warning");
      return;
    }

    showSetupMessage(`Manager ${data.username} created successfully.`, "success");
    managerSetupForm.reset();
  } catch (error) {
    console.error(error);
    showSetupMessage("Unable to connect to the server.", "warning");
  }
});

backButton.addEventListener("click", () => {
  window.location.href = "assets/pages/manager-dashboard.html";
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("rms_token");
  window.location.href = "login.html";
});

function showSetupMessage(message, variant) {
  setupMessage.textContent = message;
  setupMessage.style.color = variant === "success" ? "#0f4b80" : "#7f3f00";
}
