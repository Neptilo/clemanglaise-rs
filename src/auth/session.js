(function (root) {
  const namespace = root.ClemAuth = root.ClemAuth || {};

  function normalizeStatus(status) {
    return {
      isLoggedIn: Boolean(status && status.isLoggedIn),
      username: status && status.username ? status.username : ''
    };
  }

  class AuthSession {
    constructor(client = namespace.getAuthClient()) {
      this.client = client;
      this.status = normalizeStatus();
      this.statusLoaded = false;
      this.listeners = new Set();
      this.refreshPromise = null;
    }

    async login(username, password) {
      const result = await this.client.login(username, password);

      if (result.success) {
        await this.refreshStatus();
      }

      return result;
    }

    async logout() {
      const result = await this.client.logout();

      if (result.success) {
        this.status = normalizeStatus();
        this.statusLoaded = true;
        this.emitChange();
      }

      return result;
    }

    async register(registerData) {
      if (typeof this.client.register !== 'function') {
        return { success: false, message: 'Registration is not supported in this environment.' };
      }

      const result = await this.client.register(registerData);

      if (result.success) {
        await this.refreshStatus();
      }

      return result;
    }

    async getStatus(options = {}) {
      if (options.forceRefresh || !this.statusLoaded) {
        return this.refreshStatus();
      }

      return this.status;
    }

    async refreshStatus() {
      if (!this.refreshPromise) {
        this.refreshPromise = this.client.getStatus()
          .then((status) => {
            this.status = normalizeStatus(status);
            this.statusLoaded = true;
            this.emitChange();
            return this.status;
          })
          .finally(() => {
            this.refreshPromise = null;
          });
      }

      return this.refreshPromise;
    }

    onChange(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }

    emitChange() {
      for (const listener of this.listeners) {
        listener(this.status);
      }
    }
  }

  let sharedSession;

  function getSharedAuthSession() {
    if (!sharedSession) {
      sharedSession = new AuthSession();
    }

    return sharedSession;
  }

  Object.assign(namespace, {
    AuthSession,
    getSharedAuthSession
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AuthSession,
      getSharedAuthSession
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);