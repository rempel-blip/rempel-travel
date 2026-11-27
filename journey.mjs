import {dayAnchor,hotelEndpoints,hotelStop,pointFor,plannedMode,baseDayOrder,arrangeDay,dayGroups,periodLabel,improveSegment,mergeTransitOrder} from './dayplan.mjs?v=68';
export const JOURNEY_MODES={walking:'Пешком',subway:'Пешком + метро',transit:'Пешком + транспорт',taxi:'Такси',driving:'Авто'};
export function cleanJourney(value={},places=[],days=[]){
 const v=value&&typeof value==='object'?value:{},ids=new Set(places.map(p=>p.id)),dates=new Set(days.map(d=>d.date));
 const result={orders:{},included:{},pinned:{},modes:{},skipped:{},visits:{},following:{},periods:{}};
 for(const [date,order]of Object.entries(v.orders||{}))if(dates.has(date)&&Array.isArray(order))result.orders[date]=[...new Set(order.filter(id=>places.some(p=>p.id===id&&(p.date===date||p.visitDates?.includes(date)))))];
 for(const name of ['included','pinned'])for(const [id,x]of Object.entries(v[name]||{}))if(ids.has(id)&&typeof x==='boolean')result[name][id]=x;
 for(const [key,x]of Object.entries(v.modes||{})){const [date,id]=key.split('|');if(dates.has(date)&&ids.has(id)&&JOURNEY_MODES[x])result.modes[key]=x;}
 for(const [key,x]of Object.entries(v.skipped||{})){const [date,id]=key.split('|');if(dates.has(date)&&places.some(p=>p.id===id&&p.date===date)&&x===true)result.skipped[key]=true;}
 for(const [id,x]of Object.entries(v.visits||{}))if(ids.has(id)&&x&&Number.isFinite(x.at)&&['manual','nearby'].includes(x.method))result.visits[id]={at:x.at,method:x.method};
 for(const [date,x]of Object.entries(v.following||{}))if(dates.has(date)&&x===true)result.following[date]=true;
 for(const [id,key]of Object.entries(v.periods||{}))if(ids.has(id)&&typeof key==='string'&&key.length<100)result.periods[id]=key;
 for(const p of places)if(p.transportNode&&!(p.id in result.pinned))result.pinned[p.id]=true;
 for(const [date,order]of Object.entries(result.orders)){const base=arrangeDay(baseDayOrder(places,date),result),merged=mergeTransitOrder(base,order);if(base.filter(p=>!p.catalogSuggestion).some((p,i)=>(dayAnchor(p))&&merged.filter(id=>!base.find(q=>q.id===id)?.catalogSuggestion)[i]!==p.id))delete result.orders[date];else result.orders[date]=merged;}
 return result;
}
export function journeyDay(places,date,j){const list=baseDayOrder(places,date),order=mergeTransitOrder(list,j.orders[date]||[]);return arrangeDay([...list].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)),j);}
export function journeyIncluded(p,j,priority){if(p.networkInactive||p.shopSkipped)return false;if(dayAnchor(p))return true;if(['otagi','gcans'].includes(p.id)&&priority==='main')return true;return j.included[p.id]??p.routeDefault??(priority!=='reserve');}
export function journeyLocked(p,j){return !!dayAnchor(p)||!!j.pinned[p.id];}
export function journeyPending(list,j,visited,priority){return list.filter(p=>journeyIncluded(p,j,priority(p))&&!visited[p.id]&&!j.skipped[p.date+'|'+p.id]);}
export function journeyDistance(a,b){const rad=x=>x*Math.PI/180,dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);const h=Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function proposeJourney(list,{journey,visited,coordinate,origin=null,destination=null,priority}){
 // Unknown coordinates and protected stops are barriers; never infer road times from this suggestion.
 const out=[...list];let from=origin,i=0;
 const barrier=p=>visited[p.id]||journeyLocked(p,journey)||!coordinate(p.id)||!journeyIncluded(p,journey,priority(p))||journey.skipped[p.date+'|'+p.id];
 while(i<out.length){if(barrier(out[i])){from=coordinate(out[i].id)||null;i++;continue;}let end=i;while(end<out.length&&!barrier(out[end]))end++;const target=end<out.length?coordinate(out[end].id):destination;const ordered=improveSegment(out.slice(i,end),from,target,coordinate);if(ordered.length)from=coordinate(ordered.at(-1).id);out.splice(i,end-i,...ordered);i=end;}
 return out;
}
export function journeyNavigation(p,mode='transit',from=''){
 const travel=mode==='walking'?'walking':['taxi','driving'].includes(mode)?'driving':'transit';
 const google=new URL('https://www.google.com/maps/dir/');google.searchParams.set('api','1');google.searchParams.set('destination',p.query);google.searchParams.set('travelmode',travel);if(from)google.searchParams.set('origin',from);
 const apple=new URL('https://maps.apple.com/');apple.searchParams.set('daddr',p.query);apple.searchParams.set('dirflg',travel==='walking'?'w':travel==='driving'?'d':'r');if(from)apple.searchParams.set('saddr',from);
 const amap=new URL('https://uri.amap.com/search');amap.searchParams.set('keyword',p.local||p.query);amap.searchParams.set('callnative','1');return {google:google.href,apple:apple.href,amap:amap.href};
}
export function createNearbyTracker({now=()=>Date.now(),dwellMs=60000,radius=150,maxAccuracy=60}={}){
 let candidate=null;const postponed=new Map();
