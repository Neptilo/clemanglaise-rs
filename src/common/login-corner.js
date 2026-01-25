/**
 * Login corner UI component.
 * Shows login button, or user greeting with logout button when logged in.
 */

const authClient = getAuthClient();

/**
 * Initialize the login corner UI and set up event listeners.
 * @param {string} containerId - ID of the container element for the login corner
 */
async function initLoginCorner(containerId = 'login-corner') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Login corner container with id "${containerId}" not found`);
    return;
  }

  // Check initial auth status
  updateLoginUI(container);

  // Optional: Refresh status every 30 seconds
  setInterval(() => updateLoginUI(container), 30000);
}

/**
 * Update the login corner UI based on current auth status.
 * @param {HTMLElement} container
 */
async function updateLoginUI(container) {
  const status = await authClient.getStatus();

  container.innerHTML = '';

  if (status.isLoggedIn) {
    // Show logged-in greeting with logout button
    const greeting = document.createElement('div');
    greeting.className = 'login-corner-greeting';
    greeting.innerHTML = `
      <span class="login-username">Hello, <strong>${escapeHtml(status.username)}</strong></span>
      <button class="login-logout-btn" id="logout-btn">Log out</button>
    `;
    container.appendChild(greeting);

    document.getElementById('logout-btn').addEventListener('click', async () => {
      const result = await authClient.logout();
      if (result.success) {
        updateLoginUI(container);
      } else {
        alert(result.message);
      }
    });
  } else {
    // Show login button
    const loginBtn = document.createElement('button');
    loginBtn.className = 'login-corner-btn';
    loginBtn.textContent = 'Log in';
    loginBtn.addEventListener('click', () => showLoginModal(container));
    container.appendChild(loginBtn);
  }
}

/**
 * Show a modal login form.
 * @param {HTMLElement} container - The login corner container
 */
function showLoginModal(container) {
  const modal = document.createElement('div');
  modal.className = 'login-modal';
  modal.id = 'login-modal';
  modal.innerHTML = `
    <div class="login-modal-content">
      <div class="login-modal-header">
        <h2>Log in</h2>
        <button class="login-modal-close" id="close-modal">&times;</button>
      </div>
      <form id="login-form">
        <div class="form-group">
          <label for="login-username">Username:</label>
          <input type="text" id="login-username" name="username" required />
        </div>
        <div class="form-group">
          <label for="login-password">Password:</label>
          <input type="password" id="login-password" name="password" required />
        </div>
        <div class="login-form-actions">
          <button type="submit" class="login-submit-btn">Log in</button>
          <button type="button" class="login-cancel-btn" id="cancel-btn">Cancel</button>
        </div>
        <div id="login-error" class="login-error"></div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById('login-form');
  const closeBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('cancel-btn');
  const errorDiv = document.getElementById('login-error');

  closeBtn.addEventListener('click', () => modal.remove());
  cancelBtn.addEventListener('click', () => modal.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const result = await authClient.login(username, password);
    if (result.success) {
      modal.remove();
      updateLoginUI(container);
    } else {
      errorDiv.textContent = result.message;
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Utility to escape HTML in strings to prevent XSS.
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initLoginCorner());
} else {
  initLoginCorner();
}
