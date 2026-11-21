// Fixed daily anchors restored from the trip discussions; dates are travel-local.
export const DAY_ANCHORS={
 collina:{kind:'fixed',label:'Сначала La Collina, затем Нара'},
 nigatsudo:{kind:'sunset',label:'Закат · Nigatsu-dō'},
 umeda:{kind:'sunset',label:'Закат · Umeda Sky'},
 ryuguden:{kind:'sunrise',label:'06:00 · онсэн, затем рассвет',time:'06:00'},
 inamura:{kind:'sunset',label:'Закат · Инамурагасаки'},
 sky:{kind:'sunset',label:'15:00–15:20 · вход, остаёмся до заката',time:'15:00–15:20'},
 jingshan:{kind:'sunrise',label:'Рассвет · Цзиншань'}
};
const DEFAULT_ORDERS={'2026-12-01':['collina','nara','todaiji','kasuga','kofuku','nigatsudo'],'2026-12-02':['castle','kuromon','gate','umeda','shinsaibashi','hashi','watami','shinsekai']};
const TRANSIT_DAY_ORDERS={
 '2026-12-05':['kyotoStation5','odawara5','hakoneShrine','komagatake'],
 '2026-12-06':['ryuguden','odawara6','ofuna6','kamakuraArrival6','starbucksKam','ptj','renbai','kamaman','chacha','meggendorfer','buddha','hasedera','haseBoard6','enoden','inamuragasakiArrival6','inamura','inamuragasakiDeparture6','kamakuraReturn6','tokyoArrival6'],
 '2026-12-07':['tokyoStation7','akihabaraStation7','harajukuStation7','seeen','omotesando','sky','ruru','syndicate','shibuyaStation7'],
 '2026-12-10':['akihabaraDeparture10','hamamatsucho10','shinagawa10','hanedaDeparture10','pkx','qianmen','shuiku']
};
export function dayAnchor(p){return DAY_ANCHORS[p.id]||(p.time?{kind:'fixed',label:p.time,time:p.time}:null);}
export function hotelEndpoints(hotels=[],date){return {morning:hotels.find(h=>h.from<date&&date<=h.to)||null,evening:hotels.find(h=>h.from<=date&&date<h.to)||null};}
export function baseDayOrder(places,date){const list=places.filter(p=>p.date===date&&!p.archived),ids=(list.some(p=>p.transportNode)?TRANSIT_DAY_ORDERS[date]:null)||DEFAULT_ORDERS[date]||list.map(p=>p.id);return [...list].sort((a,b)=>(ids.includes(a.id)?ids.indexOf(a.id):ids.length+list.indexOf(a))-(ids.includes(b.id)?ids.indexOf(b.id):ids.length+list.indexOf(b)));}
export function mergeTransitOrder(base,order=[]){
 const ids=new Set(base.map(p=>p.id)),out=[...new Set(order.filter(id=>ids.has(id)))];if(!out.length)return base.map(p=>p.id);
 for(const p of base){if(out.includes(p.id))continue;let index=out.length;if(p.transportNode){if(p.transitBefore==='*')index=0;else if(p.transitAfter==='*')index=out.length;else if(p.transitBefore&&out.includes(p.transitBefore))index=out.indexOf(p.transitBefore);else if(p.transitAfter&&out.includes(p.transitAfter))index=out.indexOf(p.transitAfter)+1;else{const next=base.slice(base.indexOf(p)+1).find(q=>out.includes(q.id));if(next)index=out.indexOf(next.id);}}out.splice(index,0,p.id);}
 return out;
}
export function dayGroups(list,journey={}){
 const anchors=list.filter(dayAnchor),keys=['start',...anchors.map(p=>p.id)],groups=keys.map((key,i)=>({key,anchor:i?anchors[i-1]:null,places:[]}));let current='start';
 for(const p of list){if(dayAnchor(p)){current=p.id;continue;}let key=journey.periods?.[p.id];if(!keys.includes(key))key=current;if(anchors[0]?.id==='collina'&&key==='start')key='collina';groups.find(g=>g.key===key).places.push(p);}
 return groups;
}
export function arrangeDay(list,journey={}){return dayGroups(list,journey).flatMap(g=>g.anchor?[g.anchor,...g.places]:g.places);}
export function periodLabel(group,index,groups){const next=groups[index+1]?.anchor;if(group.key==='start')return next?'До '+next.name:'Дневные места';if(dayAnchor(group.anchor)?.kind==='sunset')return 'После заката';if(next)return 'Между '+group.anchor.name+' и '+next.name;return dayAnchor(group.anchor)?.kind==='sunrise'?'После рассвета':'После '+group.anchor.name;}
export function hotelStop(h,role,date){return h?{id:h.id,name:h.name,query:h.name+' '+h.city,city:h.city,country:'JP',date,category:'Отели',priority:'main',hotel:true,role,coordinateId:h.id==='ryugudenHotel'?'ryuguden':h.id}:null;}
export function completeDay(list,hotels,date){const {morning,evening}=hotelEndpoints(hotels,date),start=hotelStop(morning,'start',date),end=hotelStop(evening,'end',date),arrival=morning&&evening&&morning.id!==evening.id&&['2026-12-03','2026-12-05','2026-12-07'].includes(date)?hotelStop(evening,'luggage',date):null;const stops=[...list];if(arrival){const at=date==='2026-12-05'?Math.max(0,stops.findIndex(p=>p.id==='odawara5')+1):0;stops.splice(at,0,arrival);}return {morning,evening,start,end,arrival,stops:[...(start?[start]:[]),...stops,...(end?[end]:[])]};}
export function pointFor(p,coordinate){return p?coordinate(p.coordinateId||p.id):null;}
export function geoDistance(a,b){const r=x=>x*Math.PI/180,x=Math.sin(r(b[0]-a[0])/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(r(b[1]-a[1])/2)**2;return 12742000*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
const AGREED_WALKS=new Set(["tokyoArrival6|ninehours","kiyomizu|ninenzaka","ninenzaka|starbucksKyoto","starbucksKyoto|yasakaPagoda","yasakaPagoda|yasaka","yasaka|maruyama","maruyama|gion","gion|pontocho","nara|todaiji","todaiji|nigatsudo","kasuga|nigatsudo","kofuku|nigatsudo","shinsaibashi|hashi","ptj|renbai","renbai|kamaman","kamaman|chacha","chacha|starbucksKam","starbucksKam|meggendorfer","meggendorfer|buddha","buddha|hasedera","seeen|omotesando","omotesando|sky","sky|ruru"]);
export function plannedMode(j,date,p,from,coordinate){if(j.modes?.[date+'|'+p.id])return j.modes[date+'|'+p.id];if(from&&AGREED_WALKS.has(from.id+'|'+p.id))return 'walking';const a=pointFor(from,coordinate),b=pointFor(p,coordinate);return a&&b&&geoDistance(a,b)<=1800?'walking':'transit';}
export function improveSegment(stops,start,end,coordinate){
 let pool=[...stops],out=[],from=start;if(!from&&pool.length){out.push(pool.shift());from=coordinate(out[0].id);}while(pool.length){pool.sort((a,b)=>geoDistance(from,coordinate(a.id))-geoDistance(from,coordinate(b.id)));const p=pool.shift();out.push(p);from=coordinate(p.id);}
 const score=arr=>{let sum=0,prev=start;for(const p of arr){const c=coordinate(p.id);if(prev)sum+=geoDistance(prev,c);prev=c;}if(prev&&end)sum+=geoDistance(prev,end);return sum;};
 let best=score(out),changed=true,loops=0;while(changed&&loops++<30){changed=false;for(let i=start?0:1;i<out.length-1;i++)for(let k=i+1;k<out.length;k++){const next=[...out.slice(0,i),...out.slice(i,k+1).reverse(),...out.slice(k+1)],s=score(next);if(s+1<best){out=next;best=s;changed=true;}}}return out;
}
