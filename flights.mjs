// Airport reference points: datasets/airport-codes (OurAirports), retrieved 2026-11-22.
export const airports={SVO:{name:'Москва · Шереметьево',lat:55.977486,lon:37.386677},CAN:{name:'Гуанчжоу · Байюнь',lat:23.392401,lon:113.299004},KIX:{name:'Осака · Кансай',lat:34.427299,lon:135.244003},HND:{name:'Токио · Ханэда',lat:35.549678,lon:139.786958},PKX:{name:'Пекин · Дасин',lat:39.501289,lon:116.413967}};
// Dates and flight numbers supplied by the traveller; no departure times inferred.
export const flights=[{date:'28.11.2026',number:'CZ656',from:'SVO',to:'CAN'},{date:'30.11.2026',number:'CZ389',from:'CAN',to:'KIX'},{date:'10.12.2026',number:'CZ648',from:'HND',to:'PKX'},{date:'11.12.2026',number:'CZ341',from:'PKX',to:'SVO'}];
export function vector({lat,lon}){const p=lat*Math.PI/180,l=lon*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)];}
export function greatCircle(a,b,t){const u=vector(a),v=vector(b),angle=Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0))));if(angle<1e-9)return u;return u.map((x,i)=>(x*Math.sin((1-t)*angle)+v[i]*Math.sin(t*angle))/Math.sin(angle));}
export function midpoint(f){const v=greatCircle(airports[f.from],airports[f.to],.5);return {lat:Math.asin(v[2])*180/Math.PI,lon:Math.atan2(v[1],v[0])*180/Math.PI};}

export const flightTimes={CZ656:{departure:'2026-11-28T23:15:00+03:00',arrival:'2026-11-29T13:30:00+08:00'},CZ389:{departure:'2026-11-30T09:40:00+08:00',arrival:'2026-11-30T14:10:00+09:00'},CZ648:{departure:'2026-12-10T15:40:00+09:00',arrival:'2026-12-10T18:50:00+08:00'},CZ341:{departure:'2026-12-11T13:00:00+08:00',arrival:'2026-12-11T16:40:00+03:00'}};
export const airportZones={SVO:'Москва · UTC+3',CAN:'Гуанчжоу · UTC+8',KIX:'Осака · UTC+9',HND:'Токио · UTC+9',PKX:'Пекин · UTC+8'};
export function flightDuration(departure,arrival){if(!departure||!arrival)return null;const minutes=(Date.parse(arrival)-Date.parse(departure))/60000;if(!Number.isFinite(minutes)||minutes<=0)return null;return Math.round(minutes);}
export function flightTimeLabel(value){return value?value.slice(11,16)+' · '+value.slice(8,10)+'.'+value.slice(5,7):'Уточнить по билету';}
export function durationLabel(minutes){return minutes===null?'После уточнения времени':Math.floor(minutes/60)+' ч '+String(minutes%60).padStart(2,'0')+' мин';}

// Schedule transcribed from traveller itinerary receipt issued 2026-11-03; reviewed 2026-11-22. No booking identifiers stored.
