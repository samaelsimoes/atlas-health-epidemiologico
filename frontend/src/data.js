import { t, formatNumber } from './i18n/core.mjs';
export const today = () => new Date().toLocaleDateString('en-CA');
export const demo = [
  ['Brasil', 'São Paulo', -23.55, -46.63, 38420, 32100, 820, 'COVID-19'],
  ['Estados Unidos', 'Nova York', 40.71, -74, 62800, 51200, 1600, 'COVID-19'],
  ['Reino Unido', 'Londres', 51.51, -0.12, 24100, 20200, 610, 'COVID-19'],
  ['França', 'Paris', 48.86, 2.35, 18900, 15200, 420, 'COVID-19'],
  ['Índia', 'Mumbai', 19.07, 72.87, 51200, 41300, 1200, 'COVID-19'],
  ['Japão', 'Tóquio', 35.68, 139.69, 29600, 25100, 390, 'COVID-19'],
  ['África do Sul', 'Joanesburgo', -26.2, 28.04, 12300, 10100, 280, 'COVID-19'],
  ['Austrália', 'Sydney', -33.87, 151.21, 8400, 7200, 110, 'COVID-19'],
  ['Brasil', 'Rio de Janeiro', -22.91, -43.17, 12400, 9600, 150, 'Dengue'],
  ['México', 'Cidade do México', 19.43, -99.13, 15600, 13100, 320, 'COVID-19'],
].map((r, i) => ({
  id: `demo-${i}`,
  country: r[0],
  state: [
    'São Paulo',
    'Nova York',
    'Inglaterra',
    'Île-de-France',
    'Maharashtra',
    'Tóquio',
    'Gauteng',
    'Nova Gales do Sul',
    'Rio de Janeiro',
    'Cidade do México',
  ][i],
  city: r[1],
  latitude: r[2],
  longitude: r[3],
  cases: r[4],
  recovered: r[5],
  deaths: r[6],
  virus: r[7],
  date: today(),
  source: 'Demonstração',
  sourceUpdatedAt: null,
}));
export const number = formatNumber;
export const active = (r) => Math.max(0, r.cases - r.recovered - r.deaths);
export function validate(r) {
  if (!r.country?.trim() || !r.city?.trim() || !r.virus?.trim() || !r.date)
    return t('Preencha local, doença e data.');
  if (r.classification && !['Doença', 'Surto', 'Epidemia', 'Pandemia'].includes(r.classification))
    return t('Classificação inválida: escolha Doença, Surto, Epidemia ou Pandemia.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date > today())
    return t('Informe uma data válida, até hoje.');
  if (
    !Number.isFinite(r.latitude) ||
    Math.abs(r.latitude) > 90 ||
    !Number.isFinite(r.longitude) ||
    Math.abs(r.longitude) > 180
  )
    return t('Confira a latitude (-90 a 90) e longitude (-180 a 180).');
  if ([r.cases, r.recovered, r.deaths].some((n) => !Number.isSafeInteger(n) || n < 0))
    return t('As quantidades devem ser números inteiros positivos ou zero.');
  if (r.recovered + r.deaths > r.cases)
    return t('Recuperados e óbitos não podem superar os casos confirmados.');
  return null;
}

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
export const demoHistory = [
  ...demo.map((r, i) => ({
    ...r,
    id: r.id + '-previous',
    date: yesterday.toLocaleDateString('en-CA'),
    cases: Math.round(r.cases * 0.97),
    recovered: Math.round(r.recovered * (i % 2 ? 0.98 : 0.95)),
    deaths: Math.round(r.deaths * 0.99),
  })),
  ...demo,
];
