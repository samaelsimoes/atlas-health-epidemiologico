import {t,formatPercent} from './i18n/core.mjs';
const active=r=>Math.max(0,r.cases-r.recovered-r.deaths);
const key=r=>JSON.stringify([r.country,r.state,r.city,r.virus,r.source].map(v=>String(v||'').trim().toLocaleLowerCase('pt-BR')));
export function latestRecords(rows){
 const latest=new Map();for(const r of rows){const k=key(r),old=latest.get(k);if(!old||r.date>old.date)latest.set(k,r);}return [...latest.values()];
}
export function previousRecord(history,record){
 const k=key(record);return history.filter(r=>key(r)===k&&r.date<record.date).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
export function variation(current,previous){
 if(previous===null)return {direction:'unknown',label:t('Sem histórico')};
 if(previous===0)return current===0?{direction:'stable',label:formatPercent(0)}:{direction:'new',label:t('Base anterior zero')};
 const percent=(current-previous)/previous*100;
 return {direction:percent>0?'up':percent<0?'down':'stable',label:formatPercent(percent,1,true)};
}
export function metricValue(record,metric){return metric==='active'?active(record):record[metric];}
export function compareRecords(current,history,metric){
 let value=0,previous=0,count=0;const dates=new Set();
 for(const record of current){const old=previousRecord(history,record);if(old){value+=metricValue(record,metric);previous+=metricValue(old,metric);count++;dates.add(old.date);}}
 return {...variation(value,count?previous:null),count,total:current.length,dates:[...dates].sort()};
}
