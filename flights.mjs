// Airport reference points: datasets/airport-codes (OurAirports), retrieved 2026-11-22.
export const airports={SVO:{name:'Москва · Шереметьево',lat:55.977486,lon:37.386677},CAN:{name:'Гуанчжоу · Байюнь',lat:23.392401,lon:113.299004},KIX:{name:'Осака · Кансай',lat:34.427299,lon:135.244003},HND:{name:'Токио · Ханэда',lat:35.549678,lon:139.786958},PKX:{name:'Пекин · Дасин',lat:39.501289,lon:116.413967}};
// Dates and flight numbers supplied by the traveller; no departure times inferred.
export const flights=[{date:'28.11.2026',number:'CZ656',from:'SVO',to:'CAN'},{date:'30.11.2026',number:'CZ389',from:'CAN',to:'KIX'},{date:'10.12.2026',number:'CZ648',from:'HND',to:'PKX'},{date:'11.12.2026',number:'CZ341',from:'PKX',to:'SVO'}];
export function vector({lat,lon}){const p=lat*Math.PI/180,l=lon*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)];}
export function greatCircle(a,b,t){const u=vector(a),v=vector(b),angle=Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0))));if(angle<1e-9)return u;return u.map((x,i)=>(x*Math.sin((1-t)*angle)+v[i]*Math.sin(t*angle))/Math.sin(angle));}
export function midpoint(f){const v=greatCircle(airports[f.from],airports[f.to],.5);return {lat:Math.asin(v[2])*180/Math.PI,lon:Math.atan2(v[1],v[0])*180/Math.PI};}
