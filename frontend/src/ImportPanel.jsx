import {t,getLocale,formatDate,formatDateTime,formatPercent,displaySource,localizeValidity,clearValidity} from './i18n/core.mjs';
import {useLanguage,LanguagePicker} from './i18n/Language';
import React, { useState } from 'react';
import { Upload, FileJson, ArrowDownToLine, CheckCircle, Globe2 } from 'lucide-react';
import { request } from './api';
import { number, today, validate } from './data';
import './import.css';
const example = () => ({
  source: t('Exemplo fictício — substitua pelos seus dados'),
  records: [{
    country: 'Brasil',
    state: 'São Paulo',
    city: 'Campinas',
    virus: 'Dengue',
    classification: 'Surto',
    latitude: -22.9099,
    longitude: -47.0626,
    cases: 120,
    recovered: 90,
    deaths: 1,
    date: today()
  }, {
    country: 'Brasil',
    state: 'Rio de Janeiro',
    city: 'Niterói',
    virus: 'Influenza',
    classification: 'Doença',
    latitude: -22.8832,
    longitude: -43.1034,
    cases: 60,
    recovered: 40,
    deaths: 0,
    date: today()
  }]
});
export default function ImportPanel({
  onPublished
}) {
  useLanguage();
  const [source, setSource] = useState(''),
    [content, setContent] = useState(''),
    [fileName, setFileName] = useState(''),
    [preview, setPreview] = useState(null),
    [batch, setBatch] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  function invalidate() {
    setPreview(null);
    setBatch(null);
    setError('');
    setSuccess('');
  }
  async function fileChanged(e) {
    invalidate();
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.size > 2 * 1024 * 1024) {
      setContent('');
      setError(t("O arquivo deve ter no máximo 2 MB."));
      return;
    }
    try {
      const text = await file.text();
      setContent(text);
      const value = JSON.parse(text.replace(/^\uFEFF/, ''));
      if (!Array.isArray(value) && typeof value.source === 'string') setSource(value.source);
    } catch {
      setError(t("Não foi possível ler o arquivo JSON. Confira o conteúdo."));
    }
  }
  async function inspect(e) {
    e.preventDefault();
    invalidate();
    setBusy(true);
    try {
      const value = JSON.parse(content.replace(/^\uFEFF/, ''));
      const records = Array.isArray(value) ? value : value?.records;
      if (!source.trim()) throw Error(t("Informe o nome da fonte ou do boletim."));
      if (!Array.isArray(records) || !records.length || records.length > 2000) throw Error(t("Informe de 1 a 2.000 registros no arquivo."));
      records.forEach((r, i) => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) throw Error(t('Registro {index}: objeto inválido.',{index:i+1}));
        const err = validate(r);
        if (err) throw Error(t('Registro {index}: {message}',{index:i+1,message:err}));
      });
      const input = {
        source: source.trim(),
        records
      };
      const result = await request('/imports/preview', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      setBatch(input);
      setPreview(result);
    } catch (e) {
      setError(e instanceof SyntaxError ? t("JSON inválido. Use o modelo para conferir o formato.") : e.message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!batch || !preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await request('/imports/json', {
        method: 'POST',
        body: JSON.stringify(batch)
      });
      setPreview(null);
      setBatch(null);
      setSuccess(t('{count} registros publicados: {inserted} novos e {updated} atualizados. Já estão disponíveis na home pública.',{count:result.count,inserted:result.inserted,updated:result.updated}));
      await onPublished();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(example(), null, 2)], {
      type: 'application/json'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas-modelo-importacao.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  return <article className="panel import-panel"><div className="list-title"><div><span className="eyebrow">{t("ENTRADA DE DADOS")}</span><h2>{t("Importar doenças e eventos por região")}</h2><p>{t("Carregue um arquivo, confira os dados e publique no globo. O mesmo formato poderá receber exportações de uma API.")}</p></div><FileJson className="cyan" size={30} /></div><div className="import-body"><div className="import-help"><div><h3>{t("Um formato para todas as suas fontes")}</h3><p>{t("O arquivo pode conter várias doenças, países, estados e cidades. Cada local precisa ter coordenadas e uma data de referência.")}</p><button type="button" className="secondary" onClick={download}><ArrowDownToLine size={15} />{t("Baixar modelo JSON")}</button><small>{t("O modelo contém números fictícios. Substitua-os antes de publicar dados reais.")}</small></div><ol><li>{t("Preencha o modelo com sua fonte e os registros.")}</li><li>{t("Informe a classificação declarada pela fonte: doença, surto, epidemia ou pandemia.")}</li><li>{t("Revise a prévia e publique. Nenhum dado é salvo apenas ao abrir o arquivo.")}</li></ol></div><form onInvalid={localizeValidity} onInput={clearValidity} onSubmit={inspect}><div className="import-fields"><label>{t("Fonte / boletim")}<input required maxLength={120} disabled={busy} value={source} onChange={e => {
              setSource(e.target.value);
              invalidate();
            }} placeholder={t("Ex.: Boletim da Secretaria de Saúde")} /></label><label className="import-upload"><Upload size={18} /><span>{fileName==='Conteúdo colado'?t('Conteúdo colado'):fileName||t('Selecionar arquivo JSON')}</span><input type="file" accept=".json,application/json" disabled={busy} aria-label={t("Arquivo de dados JSON")} onChange={fileChanged} /></label></div><details><summary>{t("Ou cole o conteúdo JSON")}</summary><textarea disabled={busy} spellCheck={false} value={content} onChange={e => {
            setContent(e.target.value);
            setFileName('Conteúdo colado');
            invalidate();
          }} aria-label={t("Conteúdo JSON")} placeholder='{"source":"...","records":[...]}' /></details><button className="secondary" disabled={busy || !content.trim()}><FileJson size={16} />{busy ? t("Processando...") : t("Validar e visualizar")}</button></form>{error && <p className="import-error" role="alert">{error}</p>}{success && <p className="import-success" role="status"><CheckCircle size={17} />{success}</p>}{preview && <div className="import-preview"><div className="list-title"><div><h3>{t("Prévia da publicação")}</h3><p>{t('{count} registros · {inserted} novos · {updated} atualizações · {source}',{count:preview.count,inserted:preview.inserted,updated:preview.updated,source:displaySource(preview.source)})}</p></div><button className="primary" type="button" disabled={busy} onClick={publish}><Globe2 size={16} />{busy ? t("Publicando...") : t("Publicar no globo")}</button></div><div className="table-wrap"><table><thead><tr><th>{t("PAÍS / ESTADO / CIDADE")}</th><th>{t("DOENÇA / EVENTO")}</th><th>{t("DATA")}</th><th>{t("CONFIRMADOS")}</th><th>{t("RECUPERADOS / ÓBITOS")}</th><th>{t("COORDENADAS")}</th></tr></thead><tbody>{preview.records.slice(0, 100).map((r, i) => <tr key={i}><td>{r.city}<small>{[r.state, r.country].filter(Boolean).join(' · ')}</small></td><td>{r.virus}<small>{t(r.classification)}</small></td><td>{formatDate(r.date)}</td><td>{number(r.cases)}</td><td>{number(r.recovered)} / {number(r.deaths)}</td><td>{r.latitude}, {r.longitude}</td></tr>)}</tbody></table></div>{preview.records.length > 100 && <p className="footnote">{t('Exibindo os primeiros 100 registros de {count}. Todos os registros validados serão publicados.',{count:preview.count})}</p>}<p className="footnote">{t("A publicação mantém o histórico. Para a mesma fonte, local, doença e data, o registro existente é atualizado. Fontes diferentes não são mescladas.")}</p></div>}</div></article>;
}
