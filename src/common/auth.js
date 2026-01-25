/**
 * Abstract interface for auth providers (Web vs Tauri)
 */
class AuthClient {
  /**
   * Attempt to log in with username and password.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async login(username, password) {
    throw new Error('login() not implemented');
  }

  /**
   * Log out the current user.
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async logout() {
    throw new Error('logout() not implemented');
  }

  /**
   * Get current auth status.
   * @returns {Promise<{ isLoggedIn: boolean, username: string }>}
   */
  async getStatus() {
    throw new Error('getStatus() not implemented');
  }
}

/**
 * Web version using browser cookies and the existing PHP login endpoint.
 * Uses action=login query parameter on the PHP login.php endpoint.
 */
class WebAuthClient extends AuthClient {
  constructor(loginEndpoint = '/php/login.php') {
    super();
    this.loginEndpoint = loginEndpoint;
  }

  async login(username, password) {
    try {
      const formData = new FormData();
      formData.append('pseudo', username);
      formData.append('password', password);

      const response = await fetch(this.loginEndpoint + '?action=login', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies
      });

      if (!response.ok) {
        return { success: false, message: 'Network error' };
      }

      const responseText = await response.text();
      
      // Check if we're logged in by checking the response
      // Success message: "Hello <strong>username</strong>. You are now logged in."
      if (responseText.includes(`Hello <strong>${username}</strong>`)) {
        return { success: true, message: `Logged in as ${username}` };
      } else {
        // Extract error message from PHP response
        // Error messages are inside: <div id="login" class="container-form"><div>MESSAGE<strong>
        let message = 'Login failed';
        
        // Try to extract message from the login div
        const parser = new DOMParser();
        const doc = parser.parseFromString(responseText, 'text/html');
        const loginDiv = doc.querySelector('#login');
        if (loginDiv) {
          // Get the text content, strip HTML tags, and clean up
          const textContent = loginDiv.textContent || loginDiv.innerText;
          const lines = textContent.split('\n').map(l => l.trim()).filter(l => l);
          // First line is usually the error message
          if (lines.length > 0 && lines[0]) {
            // Extract up to the first period
            const firstLine = lines[0];
            const periodIndex = firstLine.indexOf('.');
            message = periodIndex > 0 ? firstLine.substring(0, periodIndex + 1) : firstLine;
          }
        }
        
        return { success: false, message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  _escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async logout() {
    try {
      const response = await fetch(this.loginEndpoint + '?action=logout', {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        return { success: true, message: 'Logged out' };
      } else {
        return { success: false, message: 'Logout failed' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getStatus() {
    try {
      // Fetch a simple endpoint to determine if logged in
      // by checking if session cookie exists and is valid.
      // For now, we rely on the PHP login.php detecting $_SESSION['pseudo']
      const response = await fetch(this.loginEndpoint + '?action=status', {
        method: 'GET',
        credentials: 'include'
      });

      const text = await response.text();
      // Simple heuristic: if the page greets with a username, we're logged in
      const usernameMatch = text.match(/Hello <strong>(.+?)<\/strong>/);
      if (usernameMatch) {
        return { isLoggedIn: true, username: usernameMatch[1] };
      } else {
        return { isLoggedIn: false, username: '' };
      }
    } catch (error) {
      return { isLoggedIn: false, username: '' };
    }
  }
}

/**
 * Tauri version using the Tauri auth_login command with persistent cookie jar.
 */
class TauriAuthClient extends AuthClient {
  async login(username, password) {
    try {
      const result = await window.__TAURI__.core.invoke('auth_login', {
        username,
        password
      });

      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async logout() {
    try {
      const result = await window.__TAURI__.core.invoke('auth_logout');
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getStatus() {
    try {
      const result = await window.__TAURI__.core.invoke('auth_status');
      return result;
    } catch (error) {
      return { isLoggedIn: false, username: '' };
    }
  }
}

/**
 * Get the appropriate auth client for the current environment.
 * @returns {AuthClient}
 */
function getAuthClient() {
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return new TauriAuthClient();
  } else {
    return new WebAuthClient();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthClient, WebAuthClient, TauriAuthClient, getAuthClient };
}
