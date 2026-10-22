import React,{createContext,useContext,useEffect,useState} from 'react';
import {getLanguage,getLocale,setLanguage,t} from './core.mjs';
import './language.css';
const LanguageContext=createContext(null);
export function LanguageProvider({children}){
 const [language,update]=useState(getLanguage);
 function change(value){setLanguage(value);update(getLanguage());}
 useEffect(()=>{document.documentElement.lang=getLocale();document.title=t('Atlas • Vigilância epidemiológica');document.querySelectorAll('input,select,textarea').forEach(input=>{if(input.validity.customError)input.setCustomValidity('');});},[language]);
 return <LanguageContext.Provider value={{language,change}}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
export function LanguagePicker(){const {language,change}=useLanguage();return <label className="language-picker"><span>{t('Idioma')}</span><select aria-label={t('Idioma')} value={language} onChange={e=>change(e.target.value)}><option value="pt">Português</option><option value="en">English</option><option value="de">Deutsch</option></select></label>;}
