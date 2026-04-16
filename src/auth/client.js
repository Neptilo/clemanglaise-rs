(function (root) {
  const namespace = root.ClemAuth = root.ClemAuth || {};

  class AuthClient {
    async login(username, password) {
      throw new Error('login() not implemented');
    }

    async logout() {
      throw new Error('logout() not implemented');
    }

    async getStatus() {
      throw new Error('getStatus() not implemented');
    }

    async register(registerData) {
      throw new Error('register() not implemented');
    }
  }

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
          credentials: 'include'
        });

        const data = await response.json();
        return {
          success: Boolean(data.success),
          message: data.message || ''
        };
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
        return {
          success: Boolean(data.success),
          message: data.message || ''
        };
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
          isLoggedIn: Boolean(data.isLoggedIn),
          username: data.username || ''
        };
      } catch (error) {
        return { isLoggedIn: false, username: '' };
      }
    }

    async register(registerData = {}) {
      try {
        const formData = new FormData();
        formData.append('pseudo', registerData.username || '');
        formData.append('password', registerData.password || '');
        formData.append('password2', registerData.password2 || '');
        formData.append('email', registerData.email || '');

        if (registerData.captchaResponse) {
          formData.append('g-recaptcha-response', registerData.captchaResponse);
        }

        const response = await fetch(this.apiEndpoint + '?action=register', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const data = await response.json();
        return {
          success: Boolean(data.success),
          message: data.message || ''
        };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  }

  class TauriAuthClient extends AuthClient {
    async login(username, password) {
      try {
        return await root.__TAURI__.core.invoke('auth_login', {
          username,
          password
        });
      } catch (error) {
        return { success: false, message: error.message };
      }
    }

    async logout() {
      try {
        return await root.__TAURI__.core.invoke('auth_logout');
      } catch (error) {
        return { success: false, message: error.message };
      }
    }

    async getStatus() {
      try {
        return await root.__TAURI__.core.invoke('auth_status');
      } catch (error) {
        return { isLoggedIn: false, username: '' };
      }
    }

    async register(registerData = {}) {
      try {
        return await root.__TAURI__.core.invoke('auth_register', {
          username: registerData.username || '',
          password: registerData.password || '',
          password2: registerData.password2 || '',
          email: registerData.email || '',
          captchaResponse: registerData.captchaResponse || ''
        });
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  }

  function getAuthClient() {
    if (root.__TAURI__) {
      return new TauriAuthClient();
    }

    return new WebAuthClient();
  }

  Object.assign(namespace, {
    AuthClient,
    WebAuthClient,
    TauriAuthClient,
    getAuthClient
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AuthClient,
      WebAuthClient,
      TauriAuthClient,
      getAuthClient
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);