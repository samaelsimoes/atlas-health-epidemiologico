import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Pause, Play, ExternalLink, Plus, Minus } from 'lucide-react';
import Globe from './Globe';
import NewsPanel from './NewsPanel';
import { request } from './api';
import { t, formatNumber, formatDate, formatDateTime } from './i18n/core.mjs';
import { useLanguage } from './i18n/Language';
import { variation } from './analytics.mjs';
import './official.css';
const EMPTY_ITEMS = [];
const names = { gho: 'OMS / GHO', infodengue: 'InfoDengue', sinan: 'Ministério da Saúde / SINAN' };
export default function OfficialDashboard({ owner }) {
  useLanguage();
  const [source, setSource] = useState('infodengue');
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [disease, setDisease] = useState('Dengue');
  const [period, setPeriod] = useState('');
  const [place, setPlace] = useState('');
  const [selected, setSelected] = useState(null);
  const [rotating, setRotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  async function load() {
    try {
      const d = await request('/surveillance?source=' + source);
      if (!Array.isArray(d.items)) throw Error();
      setData(d);
      setError(false);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    const fetchData = () =>
      request('/surveillance?source=' + source)
        .then((d) => {
          if (!Array.isArray(d.items)) throw Error();
          if (alive) {
            setData(d);
            setError(false);
          }
        })
        .catch(() => {
          if (alive) setError(true);
        });
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [source]);
  useEffect(() => {
    setSelected(null);
  }, [source, disease, period, place]);
  useEffect(() => {
    setPage(1);
  }, [source, disease, period, place, pageSize]);
  const items = data?.items || EMPTY_ITEMS;
  const diseases = [...new Set(items.map((r) => r.virus))].sort();
  const actualDisease = diseases.includes(disease) ? disease : diseases[0] || disease;
  const periods = [
    ...new Set(items.filter((r) => r.virus === actualDisease).map((r) => r.periodStart)),
  ]
    .sort()
    .reverse();
  const actualPeriod = periods.includes(period) ? period : periods[0] || '';
  const samePeriod = useMemo(
    () =>
      items.filter(
        (record) => record.virus === actualDisease && record.periodStart === actualPeriod
      ),
    [items, actualDisease, actualPeriod]
  );
  const filtered = useMemo(
    () =>
      samePeriod.filter((record) =>
        [record.country, record.state, record.city]
          .join(' ')
          .toLocaleLowerCase()
          .includes(place.toLocaleLowerCase())
      ),
    [samePeriod, place]
  );
  const sortedRows = useMemo(
    () => [...filtered].sort((a, b) => b.cases - a.cases || a.id.localeCompare(b.id)),
    [filtered]
  );
  const mapRecords = useMemo(() => filtered.filter((record) => record.cases > 0), [filtered]);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = sortedRows.slice(pageStart, pageStart + pageSize);
  const total = filtered.reduce((n, r) => n + r.cases, 0);
  const locations = new Set(filtered.map((r) => [r.country, r.state, r.city].join('|'))).size;
  const previousDate = actualPeriod ? new Date(actualPeriod + 'T12:00:00Z') : null;
  if (previousDate) {
    source === 'gho'
      ? previousDate.setUTCFullYear(previousDate.getUTCFullYear() - 1)
      : previousDate.setUTCDate(previousDate.getUTCDate() - 7);
  }
  const prior = previousDate?.toISOString().slice(0, 10);
  const previous = items.filter((r) => r.virus === actualDisease && r.periodStart === prior);
  let priorSum = 0;
  let comparable = 0;
  for (const r of filtered) {
    const old = previous.find(
      (p) => p.country === r.country && p.state === r.state && p.city === r.city
    );
    if (old) {
      priorSum += old.cases;
      comparable++;
    }
  }
  const trend = comparable === filtered.length && comparable ? variation(total, priorSum) : null;
  const state = data?.sources?.find((s) => s.id === source);
  const end = samePeriod[0]?.periodEnd;
  async function control(action) {
    setBusy(true);
    setMessage('');
    try {
      if (action === 'refresh') {
        await request('/surveillance/' + source + '/refresh', { method: 'POST' });
        setMessage('Sincronização solicitada. A página acompanha o andamento.');
      } else {
        await request('/surveillance/' + source, {
          method: 'PUT',
          body: JSON.stringify({ enabled: !state.enabled }),
        });
      }
      await load();
    } catch {
      setMessage('Não foi possível concluir a operação.');
    } finally {
      setBusy(false);
    }
  }
  function changeSource(value) {
    setSource(value);
    setDisease(value === 'gho' ? 'Sarampo' : 'Dengue');
    setPeriod('');
    setPlace('');
    setMessage('');
  }
  return (
    <section className="official-view">
      <div className="official-intro">
        <h2>{t('Vigilância por fontes oficiais')}</h2>
        <p>
          {t(
            'Uma fonte, uma doença e um período por vez. Dados não representam casos ativos em tempo real.'
          )}
        </p>
      </div>
      <div className="official-filters">
        <label>
          {t('Fonte dos dados')}
          <select value={source} onChange={(e) => changeSource(e.target.value)}>
            {Object.entries(names).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Doença')}
          <select
            value={actualDisease}
            disabled={!diseases.length}
            onChange={(e) => {
              setDisease(e.target.value);
              setPeriod('');
            }}
          >
            {diseases.map((d) => (
              <option key={d} value={d}>
                {t(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Período de referência')}
          <select
            value={actualPeriod}
            disabled={!periods.length}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {source === 'gho' ? p.slice(0, 4) : formatDate(p)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Buscar país, estado ou cidade')}
          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={t('Buscar local...')}
          />
        </label>
      </div>
      <div className="official-note">
        <strong>{names[source]}</strong>
        <p>
          {t(
            source === 'gho'
              ? 'Sarampo, coqueluche e difteria: notificações anuais por país. Pontos nacionais usam a capital como referência geográfica.'
              : 'infodengue' === source
                ? 'Dengue, chikungunya e zika: notificações semanais em São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Fortaleza e Brasília. Dados preliminares sujeitos a revisão.'
                : 'SINAN: conexão com a API do Ministério indisponível. Importação numérica ainda não validada; nenhum total será publicado por esta conexão.'
          )}
        </p>
        <small>
          {t('Última sincronização:')}{' '}
          {state?.lastSuccess ? formatDateTime(state.lastSuccess) : '—'} ·{' '}
          {t(
            source === 'gho' ? 'Consulta automática diária' : 'Consulta automática a cada 12 horas'
          )}
        </small>
        {state?.running && <p role="status">{t('Sincronizando fonte...')}</p>}
        {state?.failed && (
          <p className="official-warning">
            {t(
              source === 'sinan'
                ? 'API indisponível; integração SINAN pendente.'
                : 'Falha na atualização. Últimos dados preservados.'
            )}
          </p>
        )}
        {state && !state.enabled && <p>{t('Sincronização pausada pelo proprietário.')}</p>}
        {error && (
          <p role="alert">
            {t('Não foi possível carregar os dados oficiais. Verifique o backend atualizado.')}
          </p>
        )}
        {owner && state && (
          <div className="official-actions">
            <button
              className="secondary"
              disabled={busy || state.running}
              onClick={() => control('refresh')}
            >
              <RefreshCw size={14} />
              {t('Sincronizar fonte agora')}
            </button>
            <button className="secondary" disabled={busy} onClick={() => control('toggle')}>
              {state.enabled ? <Pause size={14} /> : <Play size={14} />}{' '}
              {t(state.enabled ? 'Pausar fonte' : 'Ativar fonte')}
            </button>
          </div>
        )}
        {message && <p role="status">{t(message)}</p>}
      </div>
      {!filtered.length && (
        <p className="official-empty">
          {t(
            !data && !error
              ? 'Carregando dados oficiais...'
              : !items.length
                ? source === 'sinan'
                  ? 'Fonte pendente de integração. Nenhum dado numérico publicado.'
                  : 'Ainda sem dados publicados desta fonte. Aguarde a sincronização e confira o status acima.'
                : 'Sem dados para este filtro. Ausência de dados não significa zero casos.'
          )}
        </p>
      )}
      <div className="official-stats">
        <article className="panel">
          <small>{t('Casos notificados no período')}</small>
          <strong>{filtered.length ? formatNumber(total) : '—'}</strong>
          <p>{t('Somente os locais com dados na seleção.')}</p>
        </article>
        <article className="panel">
          <small>{t('Período de referência')}</small>
          <strong>
            {actualPeriod
              ? source === 'gho'
                ? actualPeriod.slice(0, 4)
                : formatDate(actualPeriod)
              : '—'}
          </strong>
          <p>{end && formatDate(actualPeriod) + ' – ' + formatDate(end)}</p>
        </article>
        <article className="panel">
          <small>{t('Locais com dados')}</small>
          <strong>{filtered.length ? formatNumber(locations) : '—'}</strong>
          <p>
            {trend
              ? t('Variação versus o período anterior: {value}', { value: trend.label })
              : t('Sem comparação completa no período anterior.')}
          </p>
        </article>
      </div>
      <div className="dashboard official-map">
        <article className="globe-panel">
          <div className="panel-heading">
            <div>
              <h2>{t('Panorama geográfico')}</h2>
              <p>{t('Notificações da fonte e período selecionados')}</p>
            </div>
          </div>
          <div className="globe-area">
            <Globe
              focusLatitude={selected?.latitude ?? (source === 'infodengue' ? -15 : undefined)}
              focusLongitude={selected?.longitude ?? (source === 'infodengue' ? -47 : undefined)}
              records={mapRecords}
              onSelect={setSelected}
              rotating={rotating}
              zoom={zoom}
            />
            <div className="globe-tools">
              <button
                aria-label={t(rotating ? 'Pausar rotação' : 'Iniciar rotação')}
                onClick={() => setRotating(!rotating)}
              >
                {rotating ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                aria-label={t('Aproximar')}
                onClick={() => setZoom(Math.min(1.5, zoom + 0.15))}
              >
                <Plus size={16} />
              </button>
              <button
                aria-label={t('Afastar')}
                onClick={() => setZoom(Math.max(0.75, zoom - 0.15))}
              >
                <Minus size={16} />
              </button>
            </div>
            {selected && (
              <div className="location-card">
                <span>
                  {selected.country} · {selected.state}
                </span>
                <h3>{t(selected.city)}</h3>
                <strong>{formatNumber(selected.cases)}</strong>
                <p>
                  {t(selected.virus)} · {t('Casos notificados no período')}
                </p>
                <p>
                  {formatDate(selected.periodStart)} – {formatDate(selected.periodEnd)}
                </p>
                <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {t('Ver fonte oficial')} <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
          <div className="globe-footer">
            {t('Recuperados, óbitos e casos ativos não são fornecidos por estas consultas.')}
          </div>
        </article>
        <div className="analytics">
          <NewsPanel />
        </div>
      </div>
      <section className="panel local-list">
        <div className="list-title">
          <h2>{t('Locais com dados')}</h2>
          <label className="page-size">
            {t('Locais por página')}
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('LOCALIZAÇÃO')}</th>
                <th>{t('DOENÇA')}</th>
                <th>{t('Casos notificados no período')}</th>
                <th>{t('Período de referência')}</th>
                <th>{t('Fonte dos dados')}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="place"
                      onClick={() => {
                        setSelected(r);
                      }}
                    >
                      {t(r.city)}
                      <small>
                        {r.state} · {r.country}
                      </small>
                    </button>
                  </td>
                  <td>{t(r.virus)}</td>
                  <td>{formatNumber(r.cases)}</td>
                  <td>
                    {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                  </td>
                  <td>
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {names[r.source]} <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav className="table-pagination" aria-label={t('Paginação dos locais')}>
          <span role="status" aria-live="polite">
            {t('Mostrando {start}–{end} de {total} locais', {
              start: formatNumber(pageRows.length ? pageStart + 1 : 0),
              end: formatNumber(pageStart + pageRows.length),
              total: formatNumber(sortedRows.length),
            })}
          </span>
          <div className="page-controls">
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
              aria-label={t('Primeira página')}
            >
              «
            </button>
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {t('Anterior')}
            </button>
            <span>
              {t('Página {page} de {pages}', {
                page: formatNumber(currentPage),
                pages: formatNumber(pageCount),
              })}
            </span>
            <button
              className="secondary"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              {t('Próxima')}
            </button>
            <button
              className="secondary"
              disabled={currentPage === pageCount}
              onClick={() => setPage(pageCount)}
              aria-label={t('Última página')}
            >
              »
            </button>
          </div>
        </nav>
      </section>
    </section>
  );
}
