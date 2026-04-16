(function (root) {
  const namespace = root.ClemAuth = root.ClemAuth || {};
  const _ = (s) => (namespace._ ? namespace._(s) : s);
  const RECAPTCHA_SITE_KEY = '6Lfl4-wSAAAAAFdj0lB9Nrnj4Zav-rzf0vEG1Jmz';

  let recaptchaScriptPromise = null;

  function waitForRecaptchaReady(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      function check() {
        if (root.grecaptcha && typeof root.grecaptcha.render === 'function') {
          resolve();
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(_('Failed to load reCAPTCHA.')));
          return;
        }

        root.setTimeout(check, 50);
      }

      check();
    });
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return String(text).replace(/[&<>"']/g, (character) => map[character]);
  }

  function closeExistingModal() {
    const existingModal = document.getElementById('login-modal');
    if (existingModal) {
      existingModal.remove();
    }
  }

  function ensureRecaptchaScript() {
    if (root.grecaptcha && typeof root.grecaptcha.render === 'function') {
      return Promise.resolve();
    }

    if (recaptchaScriptPromise) {
      return recaptchaScriptPromise;
    }

    recaptchaScriptPromise = new Promise((resolve, reject) => {
      const onScriptError = () => reject(new Error(_('Failed to load reCAPTCHA.')));
      const onScriptLoaded = () => {
        void waitForRecaptchaReady()
          .then(resolve)
          .catch(reject);
      };

      const existingScript = document.querySelector('script[data-clem-auth-recaptcha="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', onScriptLoaded, { once: true });
        existingScript.addEventListener('error', onScriptError, { once: true });

        // If the load event already fired before listeners were attached, still continue.
        if (existingScript.readyState === 'complete' || existingScript.readyState === 'loaded') {
          onScriptLoaded();
        }

        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.clemAuthRecaptcha = 'true';
      script.addEventListener('load', onScriptLoaded, { once: true });
      script.addEventListener('error', onScriptError, { once: true });
      document.head.appendChild(script);
    });

    return recaptchaScriptPromise.catch((error) => {
      recaptchaScriptPromise = null;
      throw error;
    });
  }

  function showLoginModal(options = {}) {
    const session = options.session || namespace.getSharedAuthSession();
    const initialMode = options.initialMode === 'register' ? 'register' : 'login';

    closeExistingModal();

    const modal = document.createElement('div');
    modal.className = 'login-modal';
    modal.id = 'login-modal';
    modal.innerHTML = `
      <div class="login-modal-content">
        <div class="login-modal-header">
          <button class="login-modal-close" type="button" aria-label="${_('Close')}">&times;</button>
        </div>

        <section id="auth-panel-login" class="auth-panel" aria-live="polite">
          <div class="auth-form-section-title">${_('Connection:')}</div>
          <div id="login-error" class="login-error"></div>
          <form id="login-form" class="auth-form">
            <table class="auth-table">
              <tr>
                <td><label for="login-username">${_('User name:&nbsp;')}</label></td>
                <td><input type="text" id="login-username" name="username" required autocomplete="username" /></td>
              </tr>
              <tr>
                <td><label for="login-password">${_('Password:&nbsp;')}</label></td>
                <td><input type="password" id="login-password" name="password" required autocomplete="current-password" /></td>
              </tr>
              <tr>
                <td></td>
                <td><button type="submit" class="login-submit-btn">${_('Log in')}</button></td>
              </tr>
            </table>
          </form>
          <div class="auth-register-link">${_('Not registered yet?')} <button type="button" class="auth-switch-link" id="auth-register-now">${_('Register now.')}</button></div>
        </section>

        <section id="auth-panel-register" class="auth-panel" hidden aria-live="polite">
          <div class="auth-register-note">${_('Fill in all the fields below to register.<br/>The e-mail address is needed to limit the number of registrations. I will not spam you, I promise.')}</div>
          <div id="register-error" class="login-error"></div>
          <form id="register-form" class="auth-form">
            <table class="auth-table">
              <tr>
                <td><label for="register-username">${_('User name:&nbsp;')}</label></td>
                <td><input type="text" id="register-username" name="username" required autocomplete="username" /></td>
              </tr>
              <tr>
                <td><label for="register-password">${_('Password:&nbsp;')}</label></td>
                <td><input type="password" id="register-password" name="password" required autocomplete="new-password" /></td>
              </tr>
              <tr>
                <td><label for="register-password2">${_('Confirm password:&nbsp;')}</label></td>
                <td><input type="password" id="register-password2" name="password2" required autocomplete="new-password" /></td>
              </tr>
              <tr>
                <td><label for="register-email">${_('E-mail address:&nbsp;')}</label></td>
                <td><input type="email" id="register-email" name="email" required autocomplete="email" /></td>
              </tr>
            </table>
            <div class="auth-captcha-note">${_('Tick the checkbox below to check that you are not a robot:')}</div>
            <div id="register-captcha" class="auth-captcha"></div>
            <div class="login-form-actions">
              <button type="submit" class="login-submit-btn">${_('Register')}</button>
            </div>
          </form>
        </section>
      </div>
    `;

    document.body.appendChild(modal);

    const closeButton = modal.querySelector('.login-modal-close');
    const registerNowButton = modal.querySelector('#auth-register-now');
    const loginPanel = modal.querySelector('#auth-panel-login');
    const registerPanel = modal.querySelector('#auth-panel-register');
    const loginForm = modal.querySelector('#login-form');
    const registerForm = modal.querySelector('#register-form');
    const loginError = modal.querySelector('#login-error');
    const registerError = modal.querySelector('#register-error');
    const loginUsernameInput = modal.querySelector('#login-username');
    const registerUsernameInput = modal.querySelector('#register-username');
    const registerPasswordInput = modal.querySelector('#register-password');
    const registerPassword2Input = modal.querySelector('#register-password2');
    const registerEmailInput = modal.querySelector('#register-email');
    const captchaContainer = modal.querySelector('#register-captcha');

    let mode = 'login';
    let captchaWidgetId = null;

    function closeModal() {
      modal.remove();
    }

    function setMode(nextMode) {
      mode = nextMode === 'register' ? 'register' : 'login';
      const isRegister = mode === 'register';

      loginPanel.hidden = isRegister;
      registerPanel.hidden = !isRegister;

      loginError.textContent = '';
      registerError.textContent = '';

      if (isRegister) {
        void ensureRecaptchaScript()
          .then(() => {
            if (!root.grecaptcha || typeof root.grecaptcha.render !== 'function') {
              return;
            }

            if (captchaWidgetId === null) {
              captchaWidgetId = root.grecaptcha.render(captchaContainer, {
                sitekey: RECAPTCHA_SITE_KEY
              });
            }
          })
          .catch((error) => {
            registerError.textContent = error.message;
          });

        registerUsernameInput.focus();
      } else {
        loginUsernameInput.focus();
      }
    }

    closeButton.addEventListener('click', closeModal);
    registerNowButton.addEventListener('click', () => setMode('register'));

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      loginError.textContent = '';

      const result = await session.login(
        loginForm.elements.username.value,
        loginForm.elements.password.value
      );

      if (!result.success) {
        loginError.textContent = result.message;
        return;
      }

      window.location.reload();
    });

    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      registerError.textContent = '';

      const captchaResponse =
        captchaWidgetId !== null && root.grecaptcha && typeof root.grecaptcha.getResponse === 'function'
          ? root.grecaptcha.getResponse(captchaWidgetId)
          : '';

      const result = await session.register({
        username: registerForm.elements.username.value,
        password: registerPasswordInput.value,
        password2: registerPassword2Input.value,
        email: registerEmailInput.value,
        captchaResponse
      });

      if (!result.success) {
        registerError.textContent = result.message;
        return;
      }

      const status = await session.getStatus({ forceRefresh: true });
      if (status.isLoggedIn) {
        window.location.reload();
        return;
      }

      registerError.textContent = result.message || _('Registration succeeded. You can now log in.');
      setMode('login');
      loginForm.elements.username.value = registerForm.elements.username.value;
      loginForm.elements.password.value = '';
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    setMode(initialMode);
    return modal;
  }

  Object.assign(namespace, {
    escapeHtml,
    showLoginModal
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      escapeHtml,
      showLoginModal
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
