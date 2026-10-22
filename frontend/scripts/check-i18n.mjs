import assert from 'assert';
import {catalog} from '../src/i18n/catalog.mjs';
import {t,getLanguage,getLocale,setLanguage,formatNumber,formatDate,formatPercent,displaySource,localizeMessage,storageKey} from '../src/i18n/core.mjs';
import {latestRecords,compareRecords} from '../src/analytics.mjs';
const keys=new Set();
const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
for(const row of catalog){assert.equal(row.length,3);assert(!keys.has(row[0]),'Chave duplicada: '+row[0]);keys.add(row[0]);for(const value of row){assert(value.trim());assert.deepEqual(placeholders(value),placeholders(row[0]),row[0]);}}
let saved={};globalThis.localStorage={getItem:key=>saved[key]??null,setItem:(key,value)=>saved[key]=value};
const history=[{country:'Brasil',state:'São Paulo',city:'Campinas',virus:'Dengue',source:'Boletim',date:'2026-01-01',cases:100,recovered:80,deaths:1},{country:'Brasil',state:'São Paulo',city:'Campinas',virus:'Dengue',source:'Boletim',date:'2026-01-02',cases:120,recovered:90,deaths:1}];
for(const [language,title,date,number,classification] of [['pt','Vigilância global','22/10/2026','12.345,6','Pandemia'],['en','Global surveillance','10/22/2026','12,345.6','Pandemic'],['de','Globale Überwachung','22.10.2026','12.345,6','Pandemie']]){
 setLanguage(language);assert.equal(getLanguage(),language);assert.equal(saved[storageKey],language);assert.equal(t('Vigilância global'),title);assert.equal(formatDate('2026-10-22'),date);assert.equal(formatNumber(12345.6),number);assert.equal(t('Pandemia'),classification);
 assert.equal(t('São Paulo'),'São Paulo');assert.equal(displaySource('Meu boletim original'),'Meu boletim original');assert.equal(latestRecords(history).length,1);assert.equal(compareRecords(latestRecords(history),history,'cases').label,formatPercent(20,1,true));
 assert(!localizeMessage('E-mail ou senha inválidos.').includes('{'));assert(!t('Registro {index}: {message}',{index:2,message:'X'}).includes('{'));
}
const original=JSON.stringify(history);setLanguage('en');assert.equal(JSON.stringify(history),original);setLanguage('fr');assert.equal(getLanguage(),'en');
saved[storageKey]='de';const reloaded=await import('../src/i18n/core.mjs?storage-test');assert.equal(reloaded.getLanguage(),'de');
assert.equal(localizeMessage('Registro 2: local, doença e data duplicados dentro do arquivo.'),'Record 2: duplicate location, disease and date in the file.');
setLanguage('pt');assert.equal(getLocale(),'pt-BR');
console.log(`${catalog.length} traduções completas; parâmetros, formatos regionais, persistência e integridade dos dados verificados nos três idiomas.`);
