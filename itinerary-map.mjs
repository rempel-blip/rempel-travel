import {journeyDay,journeyIncluded} from './journey.mjs?v=62';
import {completeDay,pointFor,dayAnchor} from './dayplan.mjs?v=59';
export function itineraryMap({date,places,hotels,journey,coordinate,priority}){
 places=places.filter(p=>!p.networkInactive);const list=journeyDay(places,date,journey).filter(p=>journeyIncluded(p,journey,priority(p))&&!journey.skipped[date+'|'+p.id]);let number=0;
 const entries=completeDay(list,hotels,date).stops.map((p,index)=>({p,index,label:p.hotel?(p.role==='start'?'С':p.role==='end'?'Ф':'Б'):String(++number),coords:pointFor(p,coordinate),anchor:dayAnchor(p)}));
 // Every dated place remains visible, including reserves and explicitly skipped stops.
 // Only included stops participate in the route line.
 const candidates=journeyDay(places,date,journey).filter(p=>!list.some(q=>q.id===p.id)).map((p,i)=>({p,index:entries.length+i,label:p.mapLabel||'В'+(i+1),coords:pointFor(p,coordinate),anchor:null,candidate:true}));
 const groups=new Map();for(const entry of [...entries,...candidates]){if(!entry.coords)continue;const key=entry.coords.join(',');if(!groups.has(key))groups.set(key,{...entry,entries:[entry]});else groups.get(key).entries.push(entry);}
 const markers=[...groups.values()].map(m=>({...m,label:m.entries.length>1?m.entries.map(x=>x.label).join('/'):m.label}));
 const segments=[];for(let i=1;i<entries.length;i++){const a=entries[i-1],b=entries[i];if(a.coords&&b.coords&&(a.coords[0]!==b.coords[0]||a.coords[1]!==b.coords[1]))segments.push({from:a,to:b,flight:a.p.country!==b.p.country});}
 return {entries,candidates,markers,segments,missing:entries.filter(p=>!p.coords),pointCount:list.length,locatedPointCount:entries.filter(p=>!p.p.hotel&&p.coords).length};
}
