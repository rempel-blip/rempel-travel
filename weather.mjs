export const WEATHER_HOUR=3600000;
export function forecastWindow(date,zone,now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const today=p.year+'-'+p.month+'-'+p.day;const delta=(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000;return {available:delta>=0&&delta<=15,delta};
}
export function createWeatherService({fetcher=globalThis.fetch,storage=globalThis.localStorage,snapshotFetcher=null,now=()=>Date.now()}={}){
 const pending=new Map(),attempts=new Map();const prefix='rempel-weather-v2:';
 const keyFor=q=>[q.date,q.zone,...q.coords].join('|');
 function valid(x,q){return x&&x.date===q.date&&x.zone===q.zone&&Number.isFinite(x.fetchedAt)&&x.fetchedAt<=now()+60000&&Number.isFinite(x.min)&&Number.isFinite(x.max);}
 function cached(q){try{const v=JSON.parse(storage?.getItem(prefix+keyFor(q))||'null');return valid(v,q)?v:null;}catch{return null;}}
 async function get(q,{force=false}={}){
  const key=keyFor(q),window=forecastWindow(q.date,q.zone,now());let saved=cached(q);
  if(!window.available)return {kind:'outside',saved};
  if(!force&&saved&&now()-saved.fetchedAt<WEATHER_HOUR)return {kind:'fresh',saved};
  if(pending.has(key))return pending.get(key);
  if(!force&&attempts.has(key)&&now()-attempts.get(key)<60000)return {kind:'error',saved};
  attempts.set(key,now());
  const promise=(async()=>{try{if(snapshotFetcher){try{const sr=await snapshotFetcher('./weather-live.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(sr.ok){const j=await sr.json();const candidate=j.schemaVersion===1?j.entries?.find(x=>x.date===q.date&&x.zone===q.zone&&JSON.stringify(x.coords)===JSON.stringify(q.coords)):null;if(valid(candidate,q)&&(!saved||candidate.fetchedAt>saved.fetchedAt)){saved=candidate;try{storage?.setItem(prefix+key,JSON.stringify(candidate));}catch{}if(now()-candidate.fetchedAt<WEATHER_HOUR)return {kind:'fresh',saved};}}}catch{}}const u=new URL('https://api.open-meteo.com/v1/forecast');const params={latitude:q.coords[0],longitude:q.coords[1],daily:'weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max',temperature_unit:'celsius',wind_speed_unit:'kmh',timezone:q.zone,start_date:q.date,end_date:q.date};for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);const r=await fetcher(u.href,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json(),d=j.daily;if(d?.time?.[0]!==q.date||!Number.isFinite(d.temperature_2m_min?.[0])||!Number.isFinite(d.temperature_2m_max?.[0])||j.daily_units?.temperature_2m_min!=='°C'||j.daily_units?.wind_speed_10m_max!=='km/h')throw Error('Invalid forecast');const x={date:q.date,zone:q.zone,fetchedAt:now(),code:Number.isInteger(d.weather_code?.[0])?d.weather_code[0]:null,min:d.temperature_2m_min[0],max:d.temperature_2m_max[0],rain:Number.isFinite(d.precipitation_probability_max?.[0])?d.precipitation_probability_max[0]:null,wind:Number.isFinite(d.wind_speed_10m_max?.[0])?d.wind_speed_10m_max[0]:null};try{storage?.setItem(prefix+key,JSON.stringify(x));}catch{}return {kind:'fresh',saved:x};}catch{return {kind:'error',saved};}finally{pending.delete(key);}})();pending.set(key,promise);return promise;
 }
 return {get,cached};
}
export function startWeatherRefresh({refresh,isVisible=()=>!document.hidden,onVisibility=fn=>document.addEventListener('visibilitychange',fn),onOnline=fn=>globalThis.addEventListener('online',fn),schedule=(fn,ms)=>setInterval(fn,ms),now=()=>Date.now()}){
 let last=now();const tick=()=>{if(isVisible()&&now()-last>=WEATHER_HOUR){last=now();refresh();}};onVisibility(tick);onOnline(()=>{if(isVisible()){last=now();refresh();}});return schedule(tick,60000);
}

export function weatherCondition(code){
 if(code===0)return {icon:'☀️',label:'Ясно'};
 if(code===1)return {icon:'🌤️',label:'Малооблачно'};
 if(code===2)return {icon:'⛅',label:'Переменная облачность'};
 if(code===3)return {icon:'☁️',label:'Пасмурно'};
 if([45,48].includes(code))return {icon:'🌫️',label:'Туман'};
 if([51,53,55].includes(code))return {icon:'🌦️',label:'Морось'};
 if([56,57,66,67].includes(code))return {icon:'🌧️',label:'Ледяные осадки'};
 if([61,63,65,80,81,82].includes(code))return {icon:'🌧️',label:'Дождь'};
 if([71,73,75,77,85,86].includes(code))return {icon:'🌨️',label:'Снег'};
 if([95,96,97,99].includes(code))return {icon:'⛈️',label:'Гроза'};
 return {icon:'',label:'Условия не указаны'};
}
