import {completeDay,pointFor,plannedMode,geoDistance} from './dayplan.mjs?v=40';
import {journeyDay,journeyIncluded} from './journey.mjs?v=43';
export const ORS_ENDPOINT='https://api.heigit.org/openrouteservice/v2/directions/';
const profileFor=mode=>mode==='walking'?'foot-walking':['driving','taxi'].includes(mode)?'driving-car':null;
export function routePlan(m,coordinate,priority,choice='walking'){
 const points=journeyDay(m.places,m.date,m.journey).filter(p=>journeyIncluded(p,m.journey,priority(p))&&!m.journey.skipped[m.date+'|'+p.id]);const list=completeDay(points,m.hotels,m.date).stops;
 const legs=[];
 for(let i=1;i<list.length;i++){
  const from=list[i-1],to=list[i],a=pointFor(from,coordinate),b=pointFor(to,coordinate),mode=choice==='plan'?plannedMode(m.journey,m.date,to,from,coordinate):choice,profile=profileFor(mode);
  const reason=from.country&&to.country&&from.country!==to.country?'Международный переезд — используйте билеты и навигацию.':!profile?'Общественный транспорт — маршрут в Google/Apple Maps.':!a||!b?'Координаты уточняются — навигация по названию доступна.':geoDistance(a,b)<5?'Одна территория — отдельная дорога не нужна.':null;
  legs.push({from,to,a,b,mode,profile,reason});
 }
 return {list,legs};
}
export function parseRoadRoute(json){
 const f=json?.features?.[0],c=f?.geometry?.coordinates,s=f?.properties?.summary;
 if(f?.geometry?.type!=='LineString'||!Array.isArray(c)||c.length<2||c.length>100000||!c.every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)||!Number.isFinite(s?.distance)||s.distance<0||!Number.isFinite(s?.duration)||s.duration<0)throw Error('Некорректный ответ сервиса маршрутов.');
 return {coordinates:c.map(p=>[p[1],p[0]]),distance:s.distance,duration:s.duration};
}
export async function fetchRoadRoute(leg,key,{fetcher=fetch,signal}={}){
 if(!leg.profile||leg.reason)throw Error('Для этого участка расчёт недоступен.');
 const r=await fetcher(ORS_ENDPOINT+leg.profile+'/geojson',{method:'POST',headers:{'Content-Type':'application/json','Authorization':key},body:JSON.stringify({coordinates:[leg.a.slice().reverse(),leg.b.slice().reverse()],instructions:false,radiuses:[150,150]}),signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!r.ok){const text=r.status===401||r.status===403?'Ключ не принят сервисом. Проверьте ключ и доступ Directions.':r.status===429?'Лимит запросов исчерпан. Повторите позже.':r.status===400||r.status===404?'Сервис не нашёл доступную дорогу рядом с этими точками.':'Сервис временно недоступен. Попробуйте позже.';throw Object.assign(Error(text),{status:r.status});}
 return parseRoadRoute(await r.json());
}
export function mountRoadRoutes({root,getModel,coordinate,priority,draw,clear,showMap}){
 let key='',generation=0,controller=null,currentSignature='',cache=new Map(),busy=false,lastRequest=0;
 const el=id=>root.querySelector('#'+id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 root.innerHTML=`<details><summary>Дорога между точками дня</summary><p>От утреннего отеля через опорные и промежуточные точки к месту ночёвки. Ниже — навигация по каждому участку; пешие и автомобильные дороги можно рассчитать для показа на карте.</p><div id="orsConnect"><label>Ключ HeiGIT<input id="orsKey" type="password" autocomplete="off" spellcheck="false" placeholder="Вставьте Basic Key"></label><button id="orsEnable" type="button">Подключить на время сеанса</button><p class="journey-help">Ключ хранится только в памяти открытой страницы и отправляется только в HeiGIT. В код, экспорт прогресса и хранилище браузера он не записывается. После закрытия потребуется ввести заново. <a href="https://account.heigit.org/manage/key" target="_blank" rel="noopener">Где взять ключ ↗</a></p></div><p id="orsConnected" hidden>Ключ подключён на время сеанса. <button id="orsDisconnect" type="button">Отключить</button></p><label>Способ для расчёта<select id="orsMode"><option value="walking">Все участки пешком</option><option value="driving">Все участки на авто</option><option value="plan" selected>По способам из плана дня</option></select></label><div class="journey-actions"><button id="orsBuild" type="button" disabled>Рассчитать дороги на карте</button><button id="orsCancel" type="button" hidden>Остановить</button><button id="orsShow" type="button" hidden>Показать на карте</button></div><p id="orsStatus" role="status">Навигация по участкам доступна ниже. Ключ нужен только для линий дорог на карте.</p><ol id="orsResults"></ol><p class="journey-help">Расчёт отправляет в HeiGIT координаты точек выбранного дня. Ваше текущее местоположение не используется. Координаты объектов приблизительны, входы не проверены. Время — оценка без остановок, расписания и актуальных пробок. Пунктир — порядок мест; сплошная линия — рассчитанная дорога. Фильтры списка не меняют план дня.</p><p class="journey-help">Маршруты: <a href="https://openrouteservice.org/" target="_blank" rel="noopener">© openrouteservice.org by HeiGIT</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></p></details>`;
 const model=()=>getModel(),plan=()=>routePlan(model(),coordinate,priority,el('orsMode').value);
 function signature(){const m=model();return JSON.stringify([m.date,el('orsMode').value,plan().legs.map(l=>[l.from.id,l.to.id,l.a,l.b,l.profile,l.reason])]);}
 function legLinks(leg){const mode=leg.mode==='walking'?'walking':['taxi','driving'].includes(leg.mode)?'driving':'transit';const g=new URL('https://www.google.com/maps/dir/');g.searchParams.set('api','1');g.searchParams.set('origin',leg.from.query);g.searchParams.set('destination',leg.to.query);g.searchParams.set('travelmode',mode);const a=new URL('https://maps.apple.com/');a.searchParams.set('saddr',leg.from.query);a.searchParams.set('daddr',leg.to.query);a.searchParams.set('dirflg',mode==='walking'?'w':mode==='driving'?'d':'r');return '<div class="journey-links"><a target="_blank" rel="noopener" href="'+escape(g.href)+'">Google · этот участок ↗</a><a target="_blank" rel="noopener" href="'+escape(a.href)+'">Apple · этот участок ↗</a></div>';}
 function showLegs(){const p=plan();el('orsResults').innerHTML=p.legs.map(leg=>'<li><strong>'+escape(leg.from.name)+' → '+escape(leg.to.name)+'</strong><br>'+escape(leg.mode==='walking'?'Пешком':leg.mode==='taxi'?'Такси':leg.mode==='driving'?'Авто':'Пешком + транспорт')+legLinks(leg)+'</li>').join('');}
 function cancel(){generation++;controller?.abort();controller=null;busy=false;el('orsCancel').hidden=true;el('orsBuild').disabled=!key;}
 function reset(text){cancel();clear();el('orsShow').hidden=true;showLegs();el('orsStatus').textContent=text;}
 function update(){root.hidden=!model().days.some(d=>d.date===model().date);const s=signature();if(s!==currentSignature){currentSignature=s;reset(key?'План изменился. Рассчитайте маршрут заново.':'Навигация по участкам доступна ниже. Ключ нужен только для линий дорог на карте.');}}
 el('orsEnable').onclick=()=>{const candidate=el('orsKey').value.trim();el('orsKey').value='';if(!candidate||candidate.length>4096||/\s/.test(candidate)){el('orsStatus').textContent='Вставьте ключ целиком, без пробелов.';return;}key=candidate;el('orsConnect').hidden=true;el('orsConnected').hidden=false;el('orsBuild').disabled=false;el('orsStatus').textContent='Ключ введён. Нажмите «Рассчитать дороги на карте», чтобы проверить подключение.';};
 el('orsDisconnect').onclick=()=>{key='';cache.clear();reset('Ключ отключён.');el('orsConnect').hidden=false;el('orsConnected').hidden=true;};
 el('orsMode').onchange=update;
 el('orsCancel').onclick=()=>reset('Расчёт остановлен.');
 el('orsShow').onclick=showMap;
 el('orsBuild').onclick=async()=>{
  if(!key||busy)return;update();const p=plan();if(!p.legs.length){el('orsStatus').textContent='Нужно хотя бы две включённые точки дня.';return;}
  if(p.legs.filter(l=>!l.reason).length>20){el('orsStatus').textContent='Слишком много участков. Оставьте до 21 точки через «Порядок и точки».';return;}
  cancel();clear();busy=true;el('orsBuild').disabled=true;el('orsCancel').hidden=false;el('orsShow').hidden=true;el('orsResults').replaceChildren();controller=new AbortController();const signal=controller.signal,token=generation,roads=[];let totalDistance=0,totalDuration=0,missing=0;
  const append=(leg,text)=>{const li=document.createElement('li');li.innerHTML='<strong>'+escape(leg.from.name)+' → '+escape(leg.to.name)+'</strong><br>'+escape(text)+legLinks(leg);el('orsResults').append(li);};
  try{for(let i=0;i<p.legs.length;i++){
   const leg=p.legs[i];if(leg.reason){missing++;append(leg,leg.reason);continue;}
   el('orsStatus').textContent='Рассчитываем участок '+(i+1)+' из '+p.legs.length+'…';
   try{const id=JSON.stringify([leg.profile,leg.a,leg.b]);let road=cache.get(id);if(!road){const delay=Math.max(0,1700-(Date.now()-lastRequest));if(delay)await new Promise((resolve,reject)=>{const t=setTimeout(resolve,delay);signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Stopped','AbortError'));},{once:true});});if(signal.aborted)throw new DOMException('Stopped','AbortError');lastRequest=Date.now();const timeout=new AbortController();const abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,25000);try{road=await fetchRoadRoute(leg,key,{signal:timeout.signal});}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}if(token!==generation)return;cache.set(id,road);if(cache.size>60)cache.delete(cache.keys().next().value);}
    if(token!==generation)return;roads.push({...road,mode:leg.mode,from:leg.from.name,to:leg.to.name});totalDistance+=road.distance;totalDuration+=road.duration;append(leg,(leg.profile==='foot-walking'?'Пешком':'Авто')+' · '+(road.distance/1000).toFixed(1)+' км · ≈ '+Math.round(road.duration/60)+' мин');
   }catch(e){if(token!==generation)return;if(signal.aborted)throw e;missing++;append(leg,e.name==='AbortError'?'Время ожидания истекло. Повторите расчёт.':e.message==='Failed to fetch'?'Нет связи с HeiGIT. Проверьте интернет и доступ сервиса.':e.message);if([401,403,429].includes(e.status)){missing+=p.legs.length-i-1;break;}}
  }
  if(token!==generation)return;draw(roads);el('orsShow').hidden=!roads.length;el('orsStatus').textContent=roads.length?(missing?'Частичный маршрут: ':'Маршрут рассчитан: ')+roads.length+' из '+p.legs.length+' участков · '+(totalDistance/1000).toFixed(1)+' км · ≈ '+Math.round(totalDuration/60)+' мин в движении. Непостроенные участки в сумму не включены.':'Маршрут не построен. Причины указаны по участкам ниже.';if(roads.length)showMap();
  }finally{if(token===generation){busy=false;el('orsBuild').disabled=!key;el('orsCancel').hidden=true;}}
 };
 update();return {update};
}
