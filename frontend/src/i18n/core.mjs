import { catalog } from './catalog.mjs';
export const locales = { pt: 'pt-BR', en: 'en-US', de: 'de-DE' };
export const storageKey = 'atlas-language';
let language = 'pt';
try {
  const saved = globalThis.localStorage?.getItem(storageKey);
  if (Object.hasOwnProperty.call(locales, saved)) language = saved;
} catch {}
const dictionary = new Map(catalog.map((row) => [row[0], row]));
export const getLanguage = () => language;
export const getLocale = () => locales[language];
export function setLanguage(value) {
  if (!Object.hasOwnProperty.call(locales, value)) return;
  language = value;
  try {
    globalThis.localStorage?.setItem(storageKey, value);
  } catch {}
}
export function t(key, values = {}) {
  if (key == null) return '';
  const row = dictionary.get(String(key));
  const text = row ? row[{ pt: 0, en: 1, de: 2 }[language]] : String(key);
  return text.replace(/\{(\w+)\}/g, (all, name) =>
    values[name] === undefined ? all : String(values[name])
  );
}
export const formatNumber = (n) => new Intl.NumberFormat(getLocale()).format(n);
export const formatPercent = (n, digits = 1, signed = false) =>
  new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...(signed ? { signDisplay: 'exceptZero' } : {}),
  }).format(n / 100);
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC' }).format(date);
}
export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(getLocale(), { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
export function displaySource(value) {
  if (typeof value !== 'string') return '';
  if (value.startsWith('Importação: '))
    return t('Importação: {source}', { source: value.slice(12) });
  return ['Demonstração', 'Cadastro manual'].includes(value) ? t(value) : value;
}
export function localizeMessage(message) {
  if (dictionary.has(message)) return t(message);
  let match = /^Registro (\d+): (.+)$/.exec(message || '');
  if (match)
    return t('Registro {index}: {message}', {
      index: match[1],
      message: localizeMessage(match[2]),
    });
  match =
    /^Confira o campo (.+)\. Informe todos os campos obrigatórios, contagens inteiras, coordenadas válidas e data até hoje\. Classificação: Doença, Surto, Epidemia ou Pandemia\.$/.exec(
      message || ''
    );
  if (match)
    return t(
      'Confira o campo {field}. Informe todos os campos obrigatórios, contagens inteiras, coordenadas válidas e data até hoje. Classificação: Doença, Surto, Epidemia ou Pandemia.',
      { field: match[1] }
    );
  return getLanguage() === 'pt' && message ? message : t('Não foi possível concluir a operação.');
}
export const hasTranslation = (key) => dictionary.has(key);
export function clearValidity(event) {
  event.target.setCustomValidity?.('');
}
export function localizeValidity(event) {
  const input = event.target;
  const valid = input.validity;
  let message = t('Confira o valor informado.');
  if (valid.valueMissing) message = t('Preencha este campo.');
  else if (valid.typeMismatch && input.type === 'email') message = t('Informe um e-mail válido.');
  else if (valid.tooShort)
    message = t('Use pelo menos {min} caracteres.', { min: input.minLength });
  else if (valid.rangeUnderflow)
    message = t('Informe um valor maior ou igual a {min}.', { min: input.min });
  else if (valid.rangeOverflow)
    message = t('Informe um valor menor ou igual a {max}.', { max: input.max });
  else if (valid.badInput || valid.stepMismatch) message = t('Informe um número válido.');
  input.setCustomValidity(message);
}
