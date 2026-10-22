import { t, getLocale, localizeMessage } from './i18n/core.mjs';
export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept-Language': getLocale(),
      ...options.headers,
    };
    if (!['GET', 'HEAD'].includes(options.method || 'GET')) {
      const response = await fetch('/api/auth/csrf', {
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw Error(t('Não foi possível iniciar uma sessão segura.'));
      const csrf = await response.json();
      headers[csrf.headerName] = csrf.token;
    }
    const response = await fetch('/api' + path, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/auth/'))
        window.dispatchEvent(new Event('atlas-session-expired'));
      const body = await response.json().catch(() => null);
      throw Error(
        body?.message
          ? localizeMessage(body.message)
          : t('Não foi possível concluir a operação ({status}).', { status: response.status })
      );
    }
    return await response.json();
  } catch (e) {
    if (e.name === 'AbortError')
      throw Error(t('O servidor demorou para responder. Tente novamente.'));
    if (e instanceof TypeError)
      throw Error(t('Não foi possível acessar o servidor. Verifique a conexão e tente novamente.'));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export async function login(email, password) {
  await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email.trim(), password }).toString(),
  });
  return request('/auth/me');
}
