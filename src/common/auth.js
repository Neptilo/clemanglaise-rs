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
 * Web version using browser cookies and the JSON login-api.php endpoint.
 * Calls the REST API directly instead of parsing HTML responses.
 */
class WebAuthClient extends AuthClient {
  constructor(apiEndpoint = '/php/login-api.php') {
    super();
    this.apiEndpoint = apiEndpoint;
  }

  async login(username, password) {
    try {
      const formData = new FormData();
      formData.append('pseudo', username);
      formData.append('password', password);

      const response = await fetch(this.apiEndpoint + '?action=login', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies
      });

      const data = await response.json();
      return { success: data.success, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async logout() {
    try {
      const response = await fetch(this.apiEndpoint + '?action=logout', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      return { success: data.success, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getStatus() {
    try {
      const response = await fetch(this.apiEndpoint + '?action=status', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      return { 
        isLoggedIn: data.isLoggedIn || false, 
        username: data.username || '' 
      };
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
