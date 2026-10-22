import { t, localizeValidity, clearValidity } from './i18n/core.mjs';
import { useLanguage, LanguagePicker } from './i18n/Language';
import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  Globe2,
} from 'lucide-react';
import { request, login } from './api';
import Globe from './Globe';
import './auth.css';
export default function AuthGate({ children, onBack }) {
  useLanguage();
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  async function check() {
    setLoading(true);
    setError('');
    try {
      const status = await request('/auth/status');
      setInitialized(status.initialized);
      setOffline(false);
      try {
        setUser(await request('/auth/me'));
      } catch {
        setUser(null);
      }
    } catch {
      setOffline(true);
      setError(t('A API está indisponível. Inicie o backend Java e tente novamente.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    check();
    const expired = () => {
      setUser(null);
      setFields((f) => ({
        ...f,
        password: '',
        confirm: '',
      }));
      setError(t('Sua sessão expirou. Entre novamente para continuar.'));
    };
    window.addEventListener('atlas-session-expired', expired);
    return () => window.removeEventListener('atlas-session-expired', expired);
  }, []);
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!initialized && fields.password !== fields.confirm) {
      setError(t('As senhas não coincidem.'));
      return;
    }
    setBusy(true);
    try {
      if (!initialized) {
        await request('/auth/setup', {
          method: 'POST',
          body: JSON.stringify({
            name: fields.name,
            email: fields.email,
            password: fields.password,
          }),
        });
        setInitialized(true);
      }
      const account = await login(fields.email, fields.password);
      setUser(account);
      setFields({
        name: '',
        email: '',
        password: '',
        confirm: '',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await request('/auth/logout', {
        method: 'POST',
      });
      setUser(null);
      setFields({
        name: '',
        email: '',
        password: '',
        confirm: '',
      });
      setError('');
    } catch (e) {
      setError(e.message);
      window.alert(t('Não foi possível encerrar a sessão. Tente novamente.'));
    } finally {
      setBusy(false);
    }
  }
  if (user) return children(user, logout, busy);
  return (
    <div className="auth-page">
      <section className="auth-visual">
        <a className="auth-brand" href="#">
          <span>
            <Activity size={25} />
          </span>
          ATLAS<small>HEALTH INTELLIGENCE</small>
        </a>
        <div className="auth-intro">
          <span className="eyebrow">{t('INTELIGÊNCIA EPIDEMIOLÓGICA')}</span>
          <h1>
            {t('O mundo conectado.')}
            <br />
            {t('A saúde em perspectiva')}
            <span>.</span>
          </h1>
          <p>
            {t('Explore os dados. Acompanhe os territórios.')}
            <br />
            {t('Transforme informação em uma visão global.')}
          </p>
        </div>
        <div className="auth-globe">
          <Globe records={[]} rotating={true} zoom={1.05} onSelect={() => {}} />
        </div>
        <div className="auth-visual-footer">
          <span>
            <Globe2 size={14} />
            {' ' + t('UMA VISÃO GLOBAL, UM ACESSO SEGURO')}
          </span>
          <span>ATLAS / 01</span>
        </div>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <div className="auth-language">
            <LanguagePicker />
          </div>
          {onBack && (
            <button className="auth-back" onClick={onBack}>
              {t('← Voltar à home pública')}
            </button>
          )}
          <span className="auth-lock">
            <ShieldCheck size={25} />
          </span>
          <div className="eyebrow">
            {loading
              ? t('CONECTANDO AO ATLAS')
              : initialized
                ? t('BEM-VINDO AO ATLAS')
                : t('CONFIGURAR PROPRIETÁRIO')}
          </div>
          <h2>
            {loading
              ? t('Preparando seu acesso')
              : initialized
                ? t('Entre na sua conta')
                : t('Acesso do proprietário')}
          </h2>
          <p>
            {loading
              ? t('Verificando sua sessão com segurança.')
              : initialized
                ? t('Acesse seu centro de monitoramento epidemiológico.')
                : t(
                    'Configure as credenciais do dono do sistema. Visitantes consultam os dados na home pública.'
                  )}
          </p>
          {loading ? (
            <div className="auth-loading">
              <RefreshCw size={22} />
            </div>
          ) : offline ? (
            <button className="primary full" onClick={check}>
              <RefreshCw size={16} />
              {t('Tentar conectar novamente')}
            </button>
          ) : (
            <form onInvalid={localizeValidity} onInput={clearValidity} onSubmit={submit}>
              {!initialized && (
                <label>
                  {t('Nome')}
                  <input
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={fields.name}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        name: e.target.value,
                      })
                    }
                    placeholder={t('Como podemos chamar você?')}
                  />
                </label>
              )}
              <label>
                {t('E-mail')}
                <input
                  required
                  type="email"
                  maxLength={160}
                  autoComplete="username"
                  value={fields.email}
                  onChange={(e) =>
                    setFields({
                      ...fields,
                      email: e.target.value,
                    })
                  }
                  placeholder={t('voce@exemplo.com')}
                />
              </label>
              <label>
                {t('Senha')}
                <div className="password-input">
                  <input
                    required
                    type={visible ? 'text' : 'password'}
                    minLength={initialized ? undefined : 12}
                    maxLength={72}
                    autoComplete={initialized ? 'current-password' : 'new-password'}
                    value={fields.password}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        password: e.target.value,
                      })
                    }
                    placeholder={
                      initialized ? t('Sua senha de acesso') : t('No mínimo 12 caracteres')
                    }
                  />
                  <button
                    type="button"
                    aria-label={visible ? t('Ocultar senha') : t('Mostrar senha')}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              {!initialized && (
                <label>
                  {t('Confirme a senha')}
                  <input
                    required
                    type="password"
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                    value={fields.confirm}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        confirm: e.target.value,
                      })
                    }
                    placeholder={t('Digite a senha novamente')}
                  />
                </label>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? t('Aguarde...')
                  : initialized
                    ? t('Entrar no painel')
                    : t('Configurar acesso do proprietário')}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <div className="auth-security">
            <Lock size={13} />
            <span>{t('Sessão protegida · Acesso administrativo')}</span>
          </div>
        </div>
        <div className="auth-bottom">
          ATLAS HEALTH INTELLIGENCE <span>© {new Date().getFullYear()}</span>
        </div>
      </section>
    </div>
  );
}
