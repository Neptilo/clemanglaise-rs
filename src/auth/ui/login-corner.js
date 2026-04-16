(function (root) {
  const namespace = root.ClemAuth = root.ClemAuth || {};
  const _ = (s) => (namespace._ ? namespace._(s) : s);

  async function renderLoginCorner(container, session) {
    const status = await session.getStatus();
    container.innerHTML = '';

    if (status.isLoggedIn) {
      const usernameToken = '__CLEM_AUTH_USERNAME__';
      const translatedGreeting = _('Hello %s.').replace('%s', usernameToken);
      const safeGreetingHtml = namespace.escapeHtml(translatedGreeting).replace(
        usernameToken,
        `<strong>${namespace.escapeHtml(status.username)}</strong>`
      );

      const greeting = document.createElement('div');
      greeting.className = 'login-corner-greeting';
      greeting.innerHTML = `
        <span class="login-username">${safeGreetingHtml}</span>
      `;

      const logoutButton = document.createElement('button');
      logoutButton.className = 'login-logout-btn';
      logoutButton.type = 'button';
      logoutButton.textContent = _('Log out');
      logoutButton.addEventListener('click', async () => {
        const result = await session.logout();
        if (!result.success) {
          alert(result.message);
          return;
        }
        window.location.reload();
      });

      greeting.appendChild(logoutButton);
      container.appendChild(greeting);
      return;
    }

    const loginButton = document.createElement('button');
    loginButton.className = 'login-corner-btn';
    loginButton.type = 'button';
    loginButton.textContent = _('Log in');
    loginButton.addEventListener('click', () => {
      namespace.showLoginModal({ session });
    });

    container.appendChild(loginButton);
  }

  async function initLoginCorner(containerId = 'login-corner', options = {}) {
    const container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container || container.dataset.clemAuthInitialized === 'true') {
      return null;
    }

    container.dataset.clemAuthInitialized = 'true';

    const session = options.session || namespace.getSharedAuthSession();
    const refreshMs = options.refreshMs === undefined ? 30000 : options.refreshMs;

    session.onChange(() => {
      void renderLoginCorner(container, session);
    });

    await session.refreshStatus();
    await renderLoginCorner(container, session);

    if (refreshMs > 0) {
      root.setInterval(() => {
        void session.refreshStatus();
      }, refreshMs);
    }

    return { container, session };
  }

  Object.assign(namespace, {
    initLoginCorner,
    renderLoginCorner
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void initLoginCorner();
    });
  } else {
    void initLoginCorner();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      initLoginCorner,
      renderLoginCorner
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);