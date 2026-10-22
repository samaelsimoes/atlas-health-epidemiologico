import {
  t,
  formatDate,
  formatDateTime,
  formatPercent,
  displaySource,
  localizeValidity,
  clearValidity,
} from './i18n/core.mjs';
import { useLanguage, LanguagePicker, LanguageProvider } from './i18n/Language';
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Globe2,
  LayoutDashboard,
  MapPin,
  Database,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownToLine,
  X,
  Pause,
  Play,
  Minus,
  ChevronRight,
  ShieldCheck,
  Info,
  Trash2,
  ExternalLink,
  LogOut,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Globe from './Globe';
import { demoHistory, number, active, today, validate } from './data';
import './style.css';
import './trends.css';
import './geography.css';
import AuthGate from './AuthGate';
import ImportPanel from './ImportPanel';
import OfficialDashboard from './OfficialDashboard';
import NewsPanel, { FeedSettings } from './NewsPanel';
import { request } from './api';
import { latestRecords, compareRecords } from './analytics.mjs';
const fresh = () => ({
  country: '',
  state: '',
  city: '',
  latitude: '',
  longitude: '',
  virus: '',
  classification: 'Doença',
  cases: '',
  recovered: '0',
  deaths: '0',
  date: today(),
});
function App({ user, onLogout, authBusy }) {
  useLanguage();
  const [mode, setMode] = useState('real');
  const [rows, setRows] = useState([]);
  const [requestedTab, setRequestedTab] = useState('official');
  const [virus, setVirus] = useState('Todos');
  const [classification, setClassification] = useState('Todas');
  const [query, setQuery] = useState('');
  const [reference, setReference] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(fresh);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [rotating, setRotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const tab =
    requestedTab === 'overview' && mode === 'real' && !rows.length ? 'official' : requestedTab;
  function setTab(next) {
    const target = next === 'overview' && mode === 'real' && !rows.length ? 'official' : next;
    setRequestedTab(target);
    if (!user) window.location.hash = target;
    window.scrollTo(0, 0);
  }
  const notify = (t) => setMessage(t);
  useEffect(() => {
    if (user) return;
    const syncRoute = () => {
      const route = window.location.hash.slice(1);
      if (route === 'admin') return;
      setRequestedTab(['official', 'overview', 'records'].includes(route) ? route : 'official');
      window.scrollTo(0, 0);
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [user]);
  useEffect(() => {
    if (!user && window.location.hash !== '#admin' && window.location.hash !== '#' + tab) {
      window.history.replaceState(null, '', '#' + tab);
    }
  }, [tab, user]);
  useEffect(() => {
    const timer = setTimeout(() => setMessage(''), 8000);
    return () => clearTimeout(timer);
  }, [message]);
  async function loadReal() {
    setBusy(true);
    try {
      const data = await request('/records');
      setRows(data);
      setMode('real');
      setCountry('');
      setState('');
      setCity('');
      setReference('');
      setConnected(true);
      setSelected(null);
      setVirus('Todos');
      setClassification('Todas');
    } catch (e) {
      setConnected(false);
      notify(
        t(
          'Não foi possível conectar ao Java em localhost:8085. Inicie o backend e tente novamente.'
        )
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    loadReal();
  }, []);
  useEffect(() => {
    if (mode !== 'real') return;
    const timer = setInterval(
      () =>
        request('/records')
          .then((data) => {
            setRows(data);
            setConnected(true);
          })
          .catch(() => setConnected(false)),
      60000
    );
    return () => clearInterval(timer);
  }, [mode]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (virus === 'Todos' || r.virus === virus) &&
          (classification === 'Todas' || (r.classification || 'Doença') === classification) &&
          (!reference || r.date === reference) &&
          (!country || r.country === country) &&
          (!state || r.state === state) &&
          (!city || r.city === city) &&
          `${r.country} ${r.state || ''} ${r.city} ${r.virus}`
            .toLocaleLowerCase('pt-BR')
            .includes(query.toLocaleLowerCase('pt-BR'))
      ),
    [rows, virus, classification, query, reference, country, state, city]
  );
  useEffect(() => {
    setSelected(null);
  }, [virus, classification, query, reference, country, state, city]);
  useEffect(() => {
    if (!modal) return;
    const close = (e) => {
      if (e.key === 'Escape' && !busy) setModal(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [modal, busy]);
  const current = useMemo(() => latestRecords(filtered), [filtered]);
  const totals = current.reduce(
    (a, r) => ({
      cases: a.cases + r.cases,
      active: a.active + active(r),
      recovered: a.recovered + r.recovered,
      deaths: a.deaths + r.deaths,
    }),
    {
      cases: 0,
      active: 0,
      recovered: 0,
      deaths: 0,
    }
  );
  const ranked = [...current].sort((a, b) => active(b) - active(a));
  const diseases = Object.entries(
    current.reduce((a, r) => ((a[r.virus] = (a[r.virus] || 0) + r.cases), a), Object.create(null))
  ).sort((a, b) => b[1] - a[1]);
  async function save(e) {
    e.preventDefault();
    const r = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      cases: Number(form.cases),
      recovered: Number(form.recovered),
      deaths: Number(form.deaths),
    };
    const error = validate(r);
    if (error) {
      notify(error);
      return;
    }
    setBusy(true);
    try {
      await request('/records', {
        method: 'POST',
        body: JSON.stringify(r),
      });
      await loadReal();
      setModal(false);
      setForm(fresh());
      notify(t('Registro salvo no banco de dados.'));
    } catch (e) {
      notify(e.message || t('Não foi possível salvar. Confira o backend Java.'));
    } finally {
      setBusy(false);
    }
  }
  async function importData() {
    setBusy(true);
    try {
      const result = await request('/imports/covid', {
        method: 'POST',
      });
      await loadReal();
      notify(
        t('{count} países importados. Confira a data da fonte: os números podem ser históricos.', {
          count: result.count,
        })
      );
    } catch (e) {
      notify(e.message || t('A fonte externa não respondeu. Tente novamente mais tarde.'));
    } finally {
      setBusy(false);
    }
  }
  async function remove(r) {
    if (
      !window.confirm(
        t('Excluir o registro de {city}, de {date}?', { city: r.city, date: formatDate(r.date) })
      )
    )
      return;
    setBusy(true);
    try {
      await request('/records/' + r.id, {
        method: 'DELETE',
      });
      await loadReal();
      notify(t('Registro excluído.'));
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const fields = [
      'country',
      'state',
      'city',
      'virus',
      'classification',
      'date',
      'cases',
      'recovered',
      'deaths',
      'latitude',
      'longitude',
      'source',
      'sourceUpdatedAt',
    ];
    const csv =
      '\uFEFF' +
      [fields, ...filtered.map((r) => fields.map((f) => r[f] ?? ''))]
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/"/g, '""')
                  .replace(/^[=+@-]/, "'$&") +
                '"'
            )
            .join(';')
        )
        .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], {
        type: 'text/csv;charset=utf-8;',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas-registros.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="app">
      <aside className="rail">
        <a
          className="brandmark"
          href={user ? '#admin' : '#official'}
          aria-label={t('Atlas início')}
          onClick={() => setTab('official')}
        >
          <Activity size={25} />
        </a>
        <div className="rail-links">
          {[
            [Globe2, 'official', 'Dados oficiais'],
            [LayoutDashboard, 'overview', 'Base cadastrada'],
            [MapPin, 'records', 'Registros'],
            [Database, 'sources', 'Importação e fontes'],
          ]
            .filter(([, id]) => user || id !== 'sources')
            .map(([Icon, id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
                title={t(label)}
                aria-label={t(label)}
              >
                <Icon size={21} />
              </button>
            ))}
        </div>
        <span className="rail-bottom">
          <ShieldCheck size={20} />
        </span>
      </aside>
      <div className="workspace">
        <header>
          <div className="wordmark">
            ATLAS<span>HEALTH INTELLIGENCE</span>
          </div>
          <div className="header-right">
            <LanguagePicker />
            <span className={'connection ' + (connected ? 'online' : '')}>
              <i />
              {connected ? t('API conectada') : t('API desconectada')}
            </span>
            {user ? (
              <>
                <span className="account-name">
                  {user.name}
                  <small>{t('Proprietário')}</small>
                </span>
                <button className="logout-button" onClick={onLogout} disabled={authBusy}>
                  <LogOut size={16} />
                  {' ' + t('Sair')}
                </button>
              </>
            ) : (
              <button
                className="logout-button"
                onClick={() => {
                  window.location.hash = 'admin';
                }}
              >
                <ShieldCheck size={16} />
                {' ' + t('Área do proprietário')}
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="page-title">
            <div>
              <div className="eyebrow">{t('CENTRO DE MONITORAMENTO')}</div>
              <h1>
                {t('Vigilância global')}
                <span>.</span>
              </h1>
              <p>{t('Consulte países, estados e cidades com registros de casos.')}</p>
            </div>
            {user && (
              <button
                className="primary"
                onClick={() => {
                  setModal(true);
                  setForm(fresh());
                }}
              >
                <Plus size={17} />
                {' ' + t('Novo registro')}
              </button>
            )}
          </div>
          <div className="toolbar">
            <nav>
              {[
                ['official', 'Dados oficiais'],
                ['overview', 'Base cadastrada'],
                ['records', 'Registros'],
                ['sources', 'Importação e fontes'],
              ]
                .filter(([id]) => user || id !== 'sources')
                .map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? 'chosen' : ''}
                    onClick={() => setTab(id)}
                  >
                    {t(label)}
                  </button>
                ))}
            </nav>
            {tab !== 'official' && (
              <div className="filters">
                <select
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  aria-label={t('Filtrar data de referência')}
                >
                  <option value="">{t('Todas as datas')}</option>
                  {[...new Set(rows.map((r) => r.date))]
                    .sort()
                    .reverse()
                    .map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d)}
                      </option>
                    ))}
                </select>
                <label className="search">
                  <Search size={15} />
                  <input
                    placeholder={t('Buscar local...')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t('Buscar local')}
                  />
                </label>
                <select
                  value={virus}
                  onChange={(e) => setVirus(e.target.value)}
                  aria-label={t('Filtrar doença')}
                >
                  <option value="Todos">{t('Todas as doenças')}</option>
                  {[...new Set(rows.map((r) => r.virus))].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {tab !== 'official' && (
            <>
              {tab === 'overview' && !rows.length && (
                <section className="official-note" role="status">
                  <h2>{t('Esta base ainda não tem registros publicados.')}</h2>
                  <p>{t('Os dados da OMS e do InfoDengue ficam em Dados oficiais.')}</p>
                  <button
                    className="primary"
                    onClick={() => {
                      setTab('official');
                      window.location.hash = 'official';
                      window.scrollTo(0, 0);
                    }}
                  >
                    {t('Ver dados das APIs')}
                  </button>
                </section>
              )}
              <div className="geo-filters">
                <label>
                  {t('Tipo de evento')}
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                  >
                    <option value="Todas">{t('Todos os eventos')}</option>
                    {['Doença', 'Surto', 'Epidemia', 'Pandemia'].map((v) => (
                      <option key={v} value={v}>
                        {t(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('País')}
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setState('');
                      setCity('');
                    }}
                  >
                    <option value="">{t('Todos os países')}</option>
                    {[...new Set(rows.map((r) => r.country))].sort().map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Estado / província')}
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                    }}
                  >
                    <option value="">{t('Todos os estados')}</option>
                    {[
                      ...new Set(
                        rows
                          .filter((r) => !country || r.country === country)
                          .map((r) => r.state)
                          .filter(Boolean)
                      ),
                    ]
                      .sort()
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                </label>
                <label>
                  {t('Cidade / região')}
                  <select value={city} onChange={(e) => setCity(e.target.value)}>
                    <option value="">{t('Todas as cidades e regiões')}</option>
                    {[
                      ...new Set(
                        rows
                          .filter(
                            (r) =>
                              (!country || r.country === country) && (!state || r.state === state)
                          )
                          .map((r) => r.city)
                      ),
                    ]
                      .sort()
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="notice">
                <span>
                  <Info size={14} />
                  {mode === 'demo' ? t('AMBIENTE DE DEMONSTRAÇÃO') : t('BASE DE REGISTROS')}
                  <b>
                    {mode === 'demo'
                      ? t('Dados fictícios para explorar o painel.')
                      : t(
                          'Último registro de cada local e fonte. Variação versus o registro anterior.'
                        )}
                  </b>
                </span>
                <button
                  disabled={busy}
                  onClick={
                    mode === 'demo'
                      ? loadReal
                      : () => {
                          setRows(demoHistory);
                          setMode('demo');
                          setCountry('');
                          setState('');
                          setCity('');
                          setReference('');
                          setSelected(null);
                          setVirus('Todos');
                          setClassification('Todas');
                        }
                  }
                >
                  {mode === 'demo' ? t('Consultar dados publicados') : t('Ver demonstração')}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}
          {tab === 'official' && <OfficialDashboard owner={!!user} />}
          {tab === 'overview' && (
            <>
              <section className="stats">
                {[
                  [
                    Activity,
                    'Casos confirmados',
                    totals.cases,
                    'pink',
                    'Último registro por local',
                    'cases',
                  ],
                  [
                    Globe2,
                    'Casos ativos',
                    totals.active,
                    'amber',
                    'Confirmados − recuperados − óbitos',
                    'active',
                  ],
                  [
                    ShieldCheck,
                    'Recuperados',
                    totals.recovered,
                    'green',
                    'Recuperações registradas',
                    'recovered',
                  ],
                  [
                    Plus,
                    'Óbitos registrados',
                    totals.deaths,
                    'muted',
                    'Último registro por local',
                    'deaths',
                  ],
                ].map(([Icon, label, n, color, caption, metric]) => (
                  <article className={'stat ' + color} key={t(label)}>
                    <div className="stat-title">
                      {t(label)}
                      <Icon size={17} />
                    </div>
                    <strong>{number(n)}</strong>
                    <Trend
                      comparison={compareRecords(current, rows, metric)}
                      favorable={metric === 'recovered'}
                    />
                    <small>
                      <i />
                      {t(caption)}
                    </small>
                  </article>
                ))}
              </section>
              <section className="dashboard">
                <article className="globe-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{t('Panorama geográfico')}</h2>
                      <p>{t('Distribuição de registros por localização')}</p>
                    </div>
                    <span className="badge">
                      <i />
                      {current.length}
                      {' ' + t('LOCAIS')}
                    </span>
                  </div>
                  <div className="globe-area">
                    <div className="coordinates">
                      {t('ATLAS / EARTH OBSERVATION')}
                      <br />
                      <span>{t('ARRASTE PARA EXPLORAR')}</span>
                    </div>
                    <Globe
                      records={current}
                      onSelect={setSelected}
                      rotating={rotating}
                      zoom={zoom}
                    />
                    <div className="globe-legend">
                      <span>
                        <i />
                        {t('Local com casos registrados')}
                      </span>
                      <small>{t('O tamanho do ponto representa o total de casos.')}</small>
                    </div>
                    <div className="globe-tools">
                      <button
                        aria-label={rotating ? t('Pausar rotação') : t('Iniciar rotação')}
                        title={t('Rotação')}
                        onClick={() => setRotating(!rotating)}
                      >
                        {rotating ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        aria-label={t('Aproximar')}
                        onClick={() => setZoom(Math.min(1.5, zoom + 0.15))}
                      >
                        <Plus size={17} />
                      </button>
                      <button
                        aria-label={t('Afastar')}
                        onClick={() => setZoom(Math.max(0.75, zoom - 0.15))}
                      >
                        <Minus size={17} />
                      </button>
                    </div>
                    {selected && (
                      <div className="location-card">
                        <button aria-label={t('Fechar local')} onClick={() => setSelected(null)}>
                          <X size={15} />
                        </button>
                        <span className="eyebrow">
                          {[selected.country, selected.state].filter(Boolean).join(' / ')} ·{' '}
                          {selected.virus}
                        </span>
                        <span className="class-tag">{t(selected.classification || 'Doença')}</span>
                        <h3>
                          {t(selected.city === 'Total nacional' ? 'Total nacional' : selected.city)}
                        </h3>
                        <strong>
                          {number(selected.cases)} <small>{t('confirmados')}</small>
                        </strong>
                        <p>
                          {number(active(selected))} {t('ativos')} · {formatDate(selected.date)}
                        </p>
                        <small>
                          {t('Fonte:') + ' '}
                          {displaySource(selected.source)}
                        </small>
                        <Trend comparison={compareRecords([selected], rows, 'cases')} />
                      </div>
                    )}
                  </div>
                  <div className="globe-footer">
                    <span>
                      <span className="cyan-dot" />
                      {' ' + t('VISUALIZAÇÃO INTERATIVA 3D')}
                    </span>
                    <span>
                      WGS 84 <span className="divider">/</span>{' '}
                      {new Set(current.map((r) => r.country)).size}
                      {' ' + t('países')}
                    </span>
                  </div>
                </article>
                <div className="analytics">
                  <NewsPanel />
                  <article className="panel">
                    <div className="section-label">
                      {t('DISTRIBUIÇÃO DE CASOS')}
                      <Activity size={15} />
                    </div>
                    <h3>{t('Situação dos registros')}</h3>
                    <div className="bars">
                      {[
                        ['Ativos', totals.active, 'pink'],
                        ['Recuperados', totals.recovered, 'green'],
                        ['Óbitos', totals.deaths, 'gray'],
                      ].map(([label, n, c]) => (
                        <div key={t(label)}>
                          <div className="bar-label">
                            <span>{t(label)}</span>
                            <b>{number(n)}</b>
                          </div>
                          <div className="track">
                            <div
                              className={c}
                              style={{
                                width: `${totals.cases ? (n / totals.cases) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="footnote">{t('Proporção sobre os casos confirmados.')}</p>
                  </article>
                  <article className="panel">
                    <div className="section-label">
                      {t('RECUPERAÇÃO')}
                      <ShieldCheck size={15} />
                    </div>
                    <div className="recovery">
                      <svg viewBox="0 0 160 105">
                        <path
                          d="M 20 85 A 60 60 0 1 1 140 85"
                          fill="none"
                          stroke="#1a2836"
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 20 85 A 60 60 0 1 1 140 85"
                          fill="none"
                          stroke="#4ed8bd"
                          strokeWidth="10"
                          strokeLinecap="round"
                          pathLength="100"
                          strokeDasharray={`${totals.cases ? (totals.recovered / totals.cases) * 100 : 0} 100`}
                        />
                        <text x="80" y="73" textAnchor="middle">
                          {formatPercent(
                            totals.cases ? (totals.recovered / totals.cases) * 100 : 0
                          )}
                        </text>
                        <text className="gauge-label" x="80" y="94" textAnchor="middle">
                          {t('dos casos registrados')}
                        </text>
                      </svg>
                    </div>
                  </article>
                  <article className="panel diseases">
                    <div className="section-label">
                      {t('DOENÇAS MONITORADAS')}
                      <Globe2 size={15} />
                    </div>
                    {diseases.length ? (
                      diseases.map(([name, n], i) => (
                        <div className="disease-row" key={name}>
                          <span>
                            <i
                              style={{
                                background: i ? '#f6b75c' : '#59b8ff',
                              }}
                            />
                            {name}
                          </span>
                          <b>{formatPercent(totals.cases ? (n / totals.cases) * 100 : 0)}</b>
                        </div>
                      ))
                    ) : (
                      <p className="footnote">{t('Nenhuma doença no filtro atual.')}</p>
                    )}
                  </article>
                </div>
              </section>
              <section className="panel local-list">
                <div className="list-title">
                  <div>
                    <h2>{t('Locais em destaque')}</h2>
                    <p>
                      {t(
                        'Ordenados pela quantidade de casos ativos · sem classificação de risco clínico'
                      )}
                    </p>
                  </div>
                  <button className="text-button" onClick={() => setTab('records')}>
                    {t('Todos os registros') + ' '}
                    <ChevronRight size={15} />
                  </button>
                </div>
                <RecordTable history={rows} rows={ranked.slice(0, 5)} onSelect={setSelected} />
              </section>
            </>
          )}
          {tab === 'records' && (
            <section className="panel local-list">
              <div className="list-title">
                <div>
                  <h2>{t('Registros epidemiológicos')}</h2>
                  <p>
                    {number(filtered.length)} {t('registros')} ·{' '}
                    {mode === 'demo' ? t('demonstração') : t('banco de dados local')}
                  </p>
                </div>
                <button className="secondary" onClick={exportCsv}>
                  <ArrowDownToLine size={16} />
                  {t('Exportar CSV')}
                </button>
              </div>
              <RecordTable
                history={rows}
                rows={[...filtered].sort(
                  (a, b) => b.date.localeCompare(a.date) || active(b) - active(a)
                )}
                onSelect={(r) => {
                  setSelected(r);
                  setTab('overview');
                }}
                onDelete={user && mode === 'real' ? remove : null}
                busy={busy}
              />
            </section>
          )}
          {user && tab === 'sources' && (
            <>
              <div className="owner-intro">
                <h2>{t('Administração dos dados publicados')}</h2>
                <p>
                  {t(
                    'Cadastre um local pelo botão Novo registro ou importe um arquivo JSON. Os registros salvos aparecem no globo da home pública, com doença, classificação, fonte e data.'
                  )}
                </p>
              </div>
              <section className="sources">
                <article className="panel">
                  <Database size={28} className="cyan" />
                  <h2>{t('Sua base de dados')}</h2>
                  <p>
                    {t(
                      'Cadastre totais agregados por local, doença e data. Os registros são persistidos pelo backend Java em um banco H2 local.'
                    )}
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => {
                      setModal(true);
                      setForm(fresh());
                    }}
                  >
                    <Plus size={16} />
                    {t('Cadastrar registro')}
                  </button>
                  <p className="footnote">
                    {t(
                      'No cadastro, uma combinação de país, cidade, doença e data é única. Para importar totais de países, não some registros de cidades da mesma população.'
                    )}
                  </p>
                </article>
                <article className="panel">
                  <Globe2 size={28} className="cyan" />
                  <h2>{t('Open Disease · COVID-19')}</h2>
                  <p>
                    {t(
                      'Importe os totais por país disponibilizados pela disease.sh. A importação atualiza os registros desta fonte sem duplicá-los.'
                    )}
                  </p>
                  <button className="secondary" disabled={busy} onClick={importData}>
                    <ArrowDownToLine size={16} />
                    {busy ? t('Processando...') : t('Importar COVID-19')}
                  </button>
                  <p className="footnote">
                    {t(
                      'A disponibilidade e a atualização dependem do provedor. Confira a data original em cada registro. Não é um acompanhamento em tempo real.'
                    )}
                  </p>
                  <a href="https://disease.sh/docs/" target="_blank" rel="noreferrer">
                    {t('Documentação da fonte') + ' '}
                    <ExternalLink size={13} />
                  </a>
                </article>
                <FeedSettings />
                <ImportPanel onPublished={loadReal} />
              </section>
            </>
          )}
          <footer>
            <span>
              <Activity size={13} /> ATLAS <span className="divider">/</span>
              {' ' + t('Vigilância epidemiológica')}
            </span>
            <span className="developer-credit" lang="en">
              Developed by Samael Pereira Simoes
            </span>
            <span>
              {t('Dados agregados por local ·') + ' '}
              {mode === 'demo' ? t('Demonstração') : t('Base local')}
            </span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label={t('Fechar aviso')}>
            <X size={16} />
          </button>
        </div>
      )}
      {user && modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(false);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="list-title">
              <div>
                <span className="eyebrow">{t('BASE EPIDEMIOLÓGICA')}</span>
                <h2 id="modal-title">{t('Novo registro')}</h2>
              </div>
              <button autoFocus aria-label={t('Fechar formulário')} onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <p>
              {t(
                'Informe dados agregados por região. Não inclua informações pessoais de pacientes.'
              )}
            </p>
            <form onInvalid={localizeValidity} onInput={clearValidity} onSubmit={save}>
              <div className="form-grid">
                {[
                  ['country', 'País', 'text'],
                  ['state', 'Estado / província (opcional)', 'text'],
                  ['city', 'Cidade / região', 'text'],
                  ['latitude', 'Latitude', 'number'],
                  ['longitude', 'Longitude', 'number'],
                  ['virus', 'Doença / agravo', 'text'],
                  ['classification', 'Classificação informada', 'select'],
                  ['date', 'Data de referência', 'date'],
                  ['cases', 'Casos confirmados', 'number'],
                  ['recovered', 'Recuperados', 'number'],
                  ['deaths', 'Óbitos', 'number'],
                ].map(([key, label, type]) => (
                  <label key={key}>
                    {t(label)}
                    {type === 'select' ? (
                      <select
                        value={form[key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [key]: e.target.value,
                          })
                        }
                      >
                        {['Doença', 'Surto', 'Epidemia', 'Pandemia'].map((v) => (
                          <option key={v} value={v}>
                            {t(v)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required={key !== 'state'}
                        type={type}
                        step={
                          ['latitude', 'longitude'].includes(key)
                            ? 'any'
                            : type === 'number'
                              ? '1'
                              : undefined
                        }
                        min={
                          ['cases', 'recovered', 'deaths'].includes(key)
                            ? 0
                            : key === 'latitude'
                              ? -90
                              : key === 'longitude'
                                ? -180
                                : undefined
                        }
                        max={
                          key === 'date'
                            ? today()
                            : key === 'latitude'
                              ? 90
                              : key === 'longitude'
                                ? 180
                                : undefined
                        }
                        value={form[key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [key]: e.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <p className="record-note">
                {t(
                  'A classificação deve vir da fonte ou avaliação responsável. O sistema não determina se uma doença é epidemia ou pandemia. Para países ou estados inteiros, use Cidade / região para indicar o total agregado e informe coordenadas representativas.'
                )}
              </p>
              <button className="primary full" disabled={busy}>
                {busy ? t('Salvando...') : t('Salvar registro')}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Trend({ comparison, favorable = false }) {
  const { direction, label, count, total } = comparison;
  const color =
    direction === 'up'
      ? favorable
        ? 'positive'
        : 'negative'
      : direction === 'down'
        ? favorable
          ? 'negative'
          : 'positive'
        : 'neutral';
  return (
    <div
      className={'trend ' + color}
      title={t(
        'Comparação com o registro anterior de cada local, doença e fonte; os intervalos podem variar.'
      )}
    >
      <span>
        {direction === 'up' ? (
          <TrendingUp size={13} />
        ) : direction === 'down' ? (
          <TrendingDown size={13} />
        ) : null}
        {t(label)}
      </span>
      <small>
        {count
          ? t('{count}/{total} locais comparáveis · versus anterior', { count, total })
          : t('Cadastre outra data para comparar')}
      </small>
    </div>
  );
}
function RecordTable({ rows, onSelect, onDelete, busy, history }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t('LOCALIZAÇÃO')}</th>
            <th>{t('DOENÇA')}</th>
            <th>{t('CONFIRMADOS')}</th>
            <th>{t('ATIVOS')}</th>
            <th>{t('VARIAÇÃO DE CASOS')}</th>
            <th>{t('REFERÊNCIA / FONTE')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="place" onClick={() => onSelect(r)}>
                  <span className="pin">
                    <MapPin size={15} />
                  </span>
                  <span>
                    {r.city}
                    <small>{[r.state, r.country].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
              </td>
              <td>
                <span className="disease-tag">{r.virus}</span>
                <small>{t(r.classification || 'Doença')}</small>
              </td>
              <td>{number(r.cases)}</td>
              <td>
                <span className="active-number">{number(active(r))}</span>
              </td>
              <td>
                <Trend comparison={compareRecords([r], history, 'cases')} />
              </td>
              <td>
                <span>{formatDate(r.date)}</span>
                <small>
                  {displaySource(r.source)}
                  {r.sourceUpdatedAt ? ' · ' + formatDateTime(r.sourceUpdatedAt) : ''}
                </small>
              </td>
              <td>
                {onDelete ? (
                  <button
                    disabled={busy}
                    aria-label={t('Excluir {city}', { city: r.city })}
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button
                    aria-label={t('Ver {city}', { city: r.city })}
                    onClick={() => onSelect(r)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <MapPin size={25} />
          <h3>{t('Nenhum registro encontrado')}</h3>
          <p>
            {t(
              'Não há registros publicados para esta seleção. Altere os filtros ou explore a demonstração identificada.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
function System() {
  const [admin, setAdmin] = useState(window.location.hash === '#admin');
  useEffect(() => {
    const change = () => setAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const home = () => {
    window.location.hash = '';
  };
  return admin ? (
    <AuthGate onBack={home}>
      {(user, onLogout, authBusy) => (
        <App
          user={user}
          onLogout={async () => {
            await onLogout();
            home();
          }}
          authBusy={authBusy}
        />
      )}
    </AuthGate>
  ) : (
    <App user={null} />
  );
}
createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <System />
  </LanguageProvider>
);
