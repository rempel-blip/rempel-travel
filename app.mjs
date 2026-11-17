import {cleanJourney,journeyDay,mountJourney} from './journey.mjs?v=29';
import {weatherCondition,createWeatherService,startWeatherRefresh,forecastWindow,WEATHER_HOUR} from './weather.mjs?v=26';
import {resolveMobileView,shareableAppURL} from './mobile.mjs';
import {googleEmbedURL,googleOpenURL} from './google-map.mjs';
import {mountBasemap} from './map.mjs';
import {days,hotels,places,priorityFor,filterPlaces,linksFor,placesForView} from './data.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='rempel-travel-v1',labels={main:'Обязательно',optional:'По желанию',reserve:'Резерв'};let storageOK=true;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return {};}}
export function cleanState(v){const ids=new Set(places.map(p=>p.id));if(!v||typeof v!=='object')throw Error('Неверный формат файла');return {journey:cleanJourney(v.journey,places,days),variant:v.variant==='B'?'B':'A',visited:Object.fromEntries(Object.entries(v.visited||{}).filter(([k,x])=>ids.has(k)&&typeof x==='boolean')),priorities:Object.fromEntries(Object.entries(v.priorities||{}).filter(([k,x])=>ids.has(k)&&Object.keys(labels).includes(x)))};}
let state=cleanState(read()),date=days[0].date,geo={},shown=[],map,layer,weatherToken=0,modalId=null,mapMode='google',googlePlaceId='',basemapMounted=false,mobileScreen='day',lastMobileDay=days[0].date,lastMobileCatalog='catalog';
let journeyUI;
function setVisited(id,value,method='manual'){state.visited[id]=value;if(value){state.journey.visits[id]={at:Date.now(),method};const p=places.find(p=>p.id===id);if(p)delete state.journey.skipped[p.date+'|'+id];}else delete state.journey.visits[id];}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;toast('Браузер не разрешает сохранение. Экспортируйте прогресс.');}$('#storageStatus').textContent=storageOK?'Прогресс сохраняется на этом устройстве.':'Сохранение недоступно. Используйте экспорт.';}
function effective(){return places.map(p=>({...p,priority:state.priorities[p.id]||p.priority}));}
function coordinate(id){const c=geo[id]?.feature?.geometry?.coordinates;return c?.length===2&&c.every(Number.isFinite)?[c[1],c[0]]:null;}
function sourceLink(id){const f=geo[id]?.feature;if(!f)return '';return f.properties.sourceURL||`https://www.openstreetmap.org/${{N:'node',W:'way',R:'relation'}[f.properties.osm_type]}/${f.properties.osm_id}`;}

function googleQuery(){
 const selected=shown.find(p=>p.id===googlePlaceId);if(selected)return selected.query;
 const day=days.find(d=>d.date===date);const cities={guangzhou:'Guangzhou China',osaka:'Osaka Japan',nara:'Nara Japan',kyoto:'Kyoto Japan',ryuguden:'Ryuguden Hakone Japan',kamakura:'Kamakura Japan',tokyo:'Tokyo Japan',beijing:'Beijing China'};
 return day?cities[day.geo]||day.city:$('#city').value||'Japan';
}
function setMapMode(mode){
 mapMode=mode==='route'?'route':'google';$('#mapMode').value=mapMode;
 $('#googleFrame').hidden=mapMode!=='google';$('#googlePlaceField').hidden=mapMode!=='google';$('#map').hidden=mapMode==='google';$('#esriSourceField').hidden=mapMode==='google';$('#fit').hidden=mapMode==='google';
 if(mapMode==='route'&&map){if(!basemapMounted){mountBasemap(map,{L,status:{set textContent(v){if(mapMode==='route')$('#mapState').textContent=v;}},selector:$('#mapProvider'),retry:$('#retryMap')});basemapMounted=true;}requestAnimationFrame(()=>map.invalidateSize());}
 renderGoogleMap();$('#retryMap').onclick=()=>{if(mapMode==='google')$('#googleFrame').src=googleEmbedURL(googleQuery());else if(basemapMounted){map.invalidateSize();$('#mapProvider').onchange();}};
}
function renderGoogleMap(){
 const select=$('#googlePlace');if(!shown.some(p=>p.id===googlePlaceId))googlePlaceId='';
 select.innerHTML='<option value="">Обзор города</option>'+shown.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');select.value=googlePlaceId;
 if(mapMode!=='google')return;
 const query=googleQuery(),url=googleEmbedURL(query),frame=$('#googleFrame');
 if(frame.dataset.query!==query){frame.src=url;frame.dataset.query=query;}
 $('#googleMap').href=googleOpenURL(query);
 $('#mapState').textContent='Google Maps · '+query+'. Цветные маркеры и линии доступны в режиме «Маршрут с цветными отметками». Для карты нужен интернет.';
}
function showOnGoogle(id){if(isMobile())applyMobileView('map');googlePlaceId=id;setMapMode('google');$('#googleFrame').scrollIntoView({block:'center',behavior:'smooth'});}
$('#mapMode').onchange=e=>setMapMode(e.target.value);
$('#googlePlace').onchange=e=>{googlePlaceId=e.target.value;renderGoogleMap();};


function isMobile(){return globalThis.matchMedia?.('(max-width: 800px)').matches||false;}
function applyMobileView(screen,scroll=true){
 mobileScreen=screen;document.body.dataset.mobileView=screen;
 document.querySelectorAll('[data-mobile-screen]').forEach(b=>{if(b.dataset.mobileScreen===screen)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(isMobile()){
  const titles={day:'План на день',map:'Карта дня',catalog:'Каталог мест',stays:'Ваши отели',more:'О поездке'};
  $('.toolbar h2').textContent=titles[screen];
  if(scroll)window.scrollTo({top:0,behavior:'auto'});
  if(screen==='map'&&map)requestAnimationFrame(()=>map.invalidateSize());
 }
}
function navigateMobile(screen){
 const next=resolveMobileView({date,lastDay:lastMobileDay,lastCatalog:lastMobileCatalog},screen);
 date=next.date;lastMobileDay=next.lastDay;lastMobileCatalog=next.lastCatalog;
 render();renderWeather();applyMobileView(next.screen);
}
function updateMobileSummary(){
 const day=days.find(d=>d.date===date);
 if(day){
  lastMobileDay=date;const list=places.filter(p=>p.date===date&&!p.archived),done=list.filter(p=>state.visited[p.id]).length;
  $('#mobileDayTitle').innerHTML=`<strong>${new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</strong><span>${esc(day.city)}</span>`;
  $('#mobileDayProgress').innerHTML=`<span>Посещено ${done} из ${list.length}</span><progress aria-label="Прогресс дня" value="${done}" max="${list.length||1}"></progress>`;
  $('#mobileLight').innerHTML=solar(day,date==='2026-12-06'?'ryuguden':day.geo);
 }else{
  lastMobileCatalog=date;$('#mobileDayTitle').innerHTML='<strong>Все открытия — под рукой</strong><span>Япония + Китай · 163 карточки</span>';$('#mobileDayProgress').innerHTML='';$('#mobileLight').innerHTML='';
 }
}
document.querySelectorAll('[data-mobile-screen]').forEach(b=>b.onclick=()=>navigateMobile(b.dataset.mobileScreen));
$('#mobileFilters').onclick=()=>{const open=document.body.dataset.mobileFilters!=='open';document.body.dataset.mobileFilters=open?'open':'closed';$('#mobileFilters').setAttribute('aria-expanded',open);};
function openShare(){
 const url=shareableAppURL(location.href);$('#shareLink').hidden=!url;
 $('#shareExplanation').textContent=url?'Отправьте попутчику ссылку. Доступ по ней зависит от настроек публикации сайта.':'Сейчас открыта локальная версия. Ссылка file:// или localhost не откроется у попутчика. Можно передать HTML-файл; для удобного доступа с iPhone нужно опубликовать приложение по HTTPS.';
 $('#downloadApp').href=location.protocol==='file:'?location.href.split('#')[0]:new URL('./share.html',location.href).href;
 $('#shareStatus').textContent='';$('#shareDialog').showModal();
}
$('#shareAppTop').onclick=openShare;$('#shareAppMore').onclick=openShare;$('#closeShare').onclick=()=>$('#shareDialog').close();
$('#shareLink').onclick=async()=>{const url=shareableAppURL(location.href);if(!url)return;try{if(navigator.share)await navigator.share({title:'REMPEL TRAVEL · #BirthDay_Trip_43',text:'Наш маршрут Япония + Китай',url});else if(navigator.clipboard){await navigator.clipboard.writeText(url);$('#shareStatus').textContent='Ссылка скопирована. Отправьте её попутчику.';}else $('#shareStatus').textContent=url;}catch(e){if(e.name!=='AbortError')$('#shareStatus').textContent='Не удалось открыть отправку. Скопируйте адрес страницы из браузера.';}};

function renderDays(){
 const nav=$('#days');
 nav.innerHTML=[['catalog','Все места'],['reserve','Без даты'],['archive','Архив']].map(([id,label])=>`<button data-date="${id}" class="catalog-tab ${date===id?'active':''}" aria-pressed="${date===id}">${label}<strong>${places.filter(p=>id==='archive'?p.archived:id==='reserve'?!p.archived&&!p.date:!p.archived).length}</strong></button>`).join('')+days.map(d=>`<button class="${d.date===date?'active':''}" data-date="${d.date}" aria-pressed="${d.date===date}">${new Intl.DateTimeFormat('ru',{month:'short',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z'))}<strong>${d.date.slice(-2)}</strong>${new Intl.DateTimeFormat('ru',{weekday:'short',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z'))}</button>`).join('');
 nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{date=b.dataset.date;render();renderWeather();if(isMobile()&&mobileScreen!=='map')applyMobileView(days.some(d=>d.date===date)?'day':'catalog',false);$(`[data-date="${date}"]`).scrollIntoView({block:'nearest',inline:'nearest'});});
}
function navHTML(p,origin=''){const links=linksFor(p,'transit',origin),walk=linksFor(p,'walking',origin);return `<div class="place-links"><button class="map-place-button" data-google="${p.id}" type="button">На карте</button><a href="${esc(links.google)}" target="_blank" rel="noopener">Google · транспорт ↗</a><a href="${esc(walk.google)}" target="_blank" rel="noopener">Пешком ↗</a><a href="${esc(links.apple)}" target="_blank" rel="noopener">Apple Maps ↗</a>${p.country==='CN'?`<a href="${esc(links.amap)}" target="_blank" rel="noopener">AMap · поиск ↗</a>`:''}</div>`;}
function card(p,i){const done=!!state.visited[p.id],priority=priorityFor(p,state.variant);return `<article class="place ${done?'done':''}" id="place-${p.id}"><input class="check" type="checkbox" data-check="${p.id}" aria-label="Посещено: ${esc(p.name)}" ${done?'checked':''}><div><div class="place-top"><span class="tag">${String(i+1).padStart(2,'0')} / ${esc(p.category)} · ${labels[priority]}</span><span class="time">${esc(p.time)}</span></div><h3><button data-detail="${p.id}">${esc(p.name)} ↗</button></h3><p>${esc(p.note)}</p>${done&&state.journey.visits[p.id]?`<p class="visit-record">Посещено ${new Intl.DateTimeFormat("ru",{timeZone:p.country==="CN"?"Asia/Shanghai":"Asia/Tokyo",dateStyle:"short",timeStyle:"short"}).format(new Date(state.journey.visits[p.id].at))} · ${state.journey.visits[p.id].method==="nearby"?"подтверждено рядом":"отмечено вручную"}</p>`:""}${p.sourceDate?`<p class="catalog-source-note">${esc(p.city)} · В исходном каталоге: ${esc(p.sourceDate)} · ${esc(p.sourceStatus)}${!p.date?" · Дата в маршруте не назначена":""}</p>`:""}${p.sourceNames?.length?`<p class="catalog-source-note">Из каталога: ${esc(p.sourceNames.join(" / "))}</p>`:""}${!coordinate(p.id)?'<p class="geo-note">Точная точка не подтверждена · доступен поиск по названию</p>':''}${navHTML(p)}</div></article>`;}
function render(){
 renderDays();$('#variantA').setAttribute('aria-pressed',state.variant==='A');$('#variantB').setAttribute('aria-pressed',state.variant==='B');
 $('#variantNote').textContent=state.variant==='A'?'А · Otagi Nenbutsu-ji и G-Cans — опциональны. Остальная программа и отели сохраняются.':'Б · Otagi Nenbutsu-ji и G-Cans — обязательны в плане. Доступ и экскурсию нужно подтвердить.';
 const day=days.find(d=>d.date===date),all=effective();
 const scope=day?journeyDay(all,date,state.journey):placesForView(all,date);
 shown=filterPlaces(scope,{date:day?date:'',category:$('#category').value,priority:$('#priority').value,status:$('#status').value,query:$('#search').value,city:$('#city').value,variant:state.variant,visited:state.visited});
 if(day){const count=places.filter(p=>p.date===date&&state.visited[p.id]).length;$('#dayIntro').innerHTML=`<div class="day-kicker">${esc(day.city)} · ${day.country==='CN'?'UTC+8':'UTC+9'}</div><h2>${esc(day.title)}</h2><p class="day-note">${esc(day.note)}</p><div class="result-count">${shown.length} мест по фильтрам · посещено ${count} из ${places.filter(p=>p.date===date).length}</div>`;}
 else {const titles={catalog:'Все места поездки',reserve:'Места без назначенной даты',archive:'Архив и прежние варианты'};const notes={catalog:'Добавлены все 145 записей каталога Японии и Китая: совпадающие места объединены с текущими карточками, прежние варианты доступны в архиве. Согласованные дни и отели сохранены.',reserve:'Предложенные даты из старого каталога указаны в карточках. Эти точки ещё не включены в расписание; они не меняют согласованный маршрут.',archive:'Отменённые места и альтернативные транзиты сохранены для справки. В текущий маршрут Япония + Китай они не включены.'};$('#dayIntro').innerHTML=`<div class="day-kicker">КАТАЛОГ ЛОКАЦИЙ</div><h2>${titles[date]}</h2><p class="day-note">${notes[date]}</p><div class="result-count">${shown.length} мест по фильтрам</div>`;}
 $('#places').innerHTML=shown.length?shown.map(card).join(''):'<p class="empty">По этим фильтрам мест нет. Попробуйте сбросить фильтры.</p>';
 const active=places.filter(p=>!p.archived);$('#progress').innerHTML=`${active.filter(p=>state.visited[p.id]).length} <small>из ${active.length} посещено</small>`;
 document.querySelectorAll('[data-check]').forEach(c=>c.onchange=()=>{setVisited(c.dataset.check,c.checked);save();render();});document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.detail));document.querySelectorAll('[data-google]').forEach(b=>b.onclick=()=>showOnGoogle(b.dataset.google));renderMap();updateMobileSummary();journeyUI?.render();
}
function renderMap(){renderGoogleMap();if(!map)return;layer.clearLayers();const coords=[];let route=[];for(const [i,p] of shown.entries()){const c=coordinate(p.id);if(!c){if(days.some(d=>d.date===date)&&route.length>1)L.polyline(route,{color:'#58756c',weight:2,dashArray:'5 7'}).addTo(layer);route=[];continue;}coords.push(c);route.push(c);const done=state.visited[p.id],optional=priorityFor(p,state.variant)!=='main';const marker=L.marker(c,{title:p.name,icon:L.divIcon({className:`pin ${done?'done':optional?'optional':''}`,html:done?'✓':String(i+1),iconSize:[30,30],iconAnchor:[15,15]})}).addTo(layer);marker.bindTooltip(p.name);marker.on('click',()=>detail(p.id));}if(days.some(d=>d.date===date)&&route.length>1)L.polyline(route,{color:'#58756c',weight:2,dashArray:'5 7'}).addTo(layer);if(coords.length)map.fitBounds(L.latLngBounds(coords),{padding:[30,30],maxZoom:14});else {const c=coordinate(days.find(d=>d.date===date)?.geo);if(c)map.setView(c,11);}const center=map.getCenter();if(mapMode==='route')$('#googleMap').href='https://www.google.com/maps/@?api=1&map_action=map&center='+center.lat+','+center.lng+'&zoom='+Math.min(19,Math.max(3,map.getZoom()))+'&basemap=roadmap';$('#fit').onclick=()=>{if(coords.length)map.fitBounds(coords,{padding:[30,30],maxZoom:14});else toast('Для этих фильтров нет подтверждённых геокодированных точек.');};}
function detail(id){const p=effective().find(p=>p.id===id);modalId=id;const c=coordinate(id),priority=priorityFor(p,state.variant),lock=state.variant==='B'&&['otagi','gcans'].includes(id);const all=journeyDay(effective(),p.date,state.journey),previous=p.date?all[all.findIndex(x=>x.id===id)-1]:null;$('#detailBody').innerHTML=`<div class="eyebrow">${esc(p.category)} · ${p.date?p.date.split('-').reverse().join('.'):esc(p.city)+' · Без даты'}</div><h2>${esc(p.name)}</h2><p>${esc(p.note)}</p>${p.local?`<p lang="zh">${esc(p.local)}</p>`:''}<p><strong>${esc(p.time||'Время не зафиксировано')}</strong> · ${labels[priority]}</p><label>Приоритет<select id="editPriority" ${lock?'disabled':''}>${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${priority===k?'selected':''}>${v}</option>`).join('')}</select></label>${lock?'<p>В варианте Б эта точка обязательна.</p>':''}<button id="modalVisited">${state.visited[id]?'✓ Посещено — отменить отметку':'Отметить посещённым'}</button>${navHTML(p)}${previous?`<p>От предыдущей точки: ${esc(previous.name)}</p>${navHTML(p,previous.query)}`:''}<hr><p>Часы работы и цена на даты поездки не подтверждены. Бронирование билета не подтверждено.</p><p>${c?`Координаты объекта: ${c[0].toFixed(6)}, ${c[1].toFixed(6)}. Это приблизительное положение объекта, не проверенный вход. Источник просмотрен ${esc(geo[id].retrieved)}. ${esc(geo[id].precision)} <a target="_blank" rel="noopener" href="${sourceLink(id)}">Источник координат ↗</a>`:'Координаты не добавлены: точный результат не подтверждён.'}</p><p>Источник плана: история проекта «Поездка на декабрь» и ваше текущее задание.</p>`;$('#editPriority').onchange=e=>{state.priorities[id]=e.target.value;save();render();};$('#modalVisited').onclick=()=>{setVisited(id,!state.visited[id]);save();render();detail(id);};$('#detailBody').querySelectorAll('[data-google]').forEach(b=>b.onclick=()=>{$('#detail').close();showOnGoogle(b.dataset.google);});if(!$('#detail').open)$('#detail').showModal();}
function solar(day,id){const c=coordinate(id);if(!c)return '<p>Для расчёта восхода нет надёжной географической точки.</p>';const zone=day.country==='CN'?'Asia/Shanghai':'Asia/Tokyo';const times=SunCalc.getTimes(new Date(day.date+'T12:00:00'+(day.country==='CN'?'+08:00':'+09:00')),...c);const fmt=d=>new Intl.DateTimeFormat('ru',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(d);return `<div class="solar"><div><small>ВОСХОД</small><strong>${fmt(times.sunrise)}</strong></div><div><small>ЗАКАТ</small><strong>${fmt(times.sunset)}</strong></div></div><p>Расчёт SunCalc · ${zone} · ${day.date==='2026-12-06'?'Ryuguden, Хаконе':esc(day.city)} · ровный горизонт. Это не прогноз видимости.</p>`;}
const weatherService=createWeatherService({snapshotFetcher:(...args)=>fetch(...args)});
function forecastText(result,day,zone){
 const x=result.saved;if(result.kind==='outside')return 'Прогноз пока недоступен: выбранная дата вне горизонта до 16 дней. Климатический ориентир не является прогнозом.';
 if(!x)return 'Прогноз недоступен: нет сети или источник не ответил. Погодные значения не подставлены.';
 const fmt=new Intl.DateTimeFormat('ru',{timeZone:zone,dateStyle:'short',timeStyle:'short'});const stale=result.kind==='error'||Date.now()-x.fetchedAt>=WEATHER_HOUR;
 return (stale?'Сохранённый прогноз · обновить не удалось. ':'Модельный прогноз · ')+day.city+' · '+day.date+': '+x.min+'…'+x.max+' °C; осадки '+(x.rain===null?'нет данных':x.rain+'%')+'; макс. ветер '+(x.wind===null?'нет данных':x.wind+' км/ч')+'. Получен '+fmt.format(new Date(x.fetchedAt))+' ('+zone+'). Это прогноз, не текущие наблюдения; условия могут измениться.';
}
async function renderWeather(force=false){
 const token=++weatherToken,day=days.find(d=>d.date===date);if(!day){$('#weather').innerHTML='<h3>Каталог мест</h3><p>Для прогноза выберите день поездки.</p>';$('#mobileForecast').textContent='';return;}
 const id=date==='2026-12-06'?'ryuguden':day.geo,c=coordinate(id),zone=day.country==='CN'?'Asia/Shanghai':'Asia/Tokyo';
 const climate=day.country==='CN'?(date<'2026-12-01'?'Южный Китай: климатически мягче Японии, но возможны дождь и прохладный вечер.':'Пекин: климатически холодный и сухой сезон; возможны мороз, ветер и плохая видимость.'):(date==='2026-12-05'||date==='2026-12-06'?'Горный район Хаконе холоднее городов; погода и видимость Фудзи изменчивы.':'Конец осени / начало зимы: прохладные утро и вечер, короткий световой день.');
 $('#weather').innerHTML='<h3>Свет и погода</h3><div class="weather-light-row"><div>'+solar(day,id)+'</div><p id="forecastStatus" role="status"></p></div><p><strong>Климатический ориентир, не прогноз:</strong> '+climate+' Числовые нормы не загружены.</p><button id="loadWeather">Обновить сейчас</button><p class="weather-auto-note">Автообновление при открытии и раз в час, пока приложение открыто. Время указано по месту поездки.</p><p><a href="https://open-meteo.com/" target="_blank" rel="noopener">Погодные данные Open-Meteo ↗</a></p>';
 const show=(text,result)=>{if(token!==weatherToken)return;$('#forecastStatus').textContent=text;const x=result?.saved;if(x&&result.kind!=='outside'){const condition=weatherCondition(x.code);$('#forecastStatus').innerHTML='<span class="forecast-layout"><span class="forecast-copy"><span class="weather-condition">'+esc(condition.label)+'</span><span>'+esc(text)+'</span></span><span class="weather-side-icon" aria-hidden="true">'+condition.icon+'</span></span>';const stamp=new Intl.DateTimeFormat('ru',{timeZone:zone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(x.fetchedAt));$('#mobileForecast').innerHTML='<span class="forecast-layout"><span class="forecast-copy"><span class="forecast-label">ПРОГНОЗ</span><span class="forecast-value"><strong>'+x.min+'…'+x.max+'°</strong></span><span class="weather-condition-label">'+esc(condition.label)+'</span><span>Осадки '+(x.rain===null?'—':x.rain+'%')+' · ветер '+(x.wind===null?'—':x.wind+' км/ч')+'</span><small>'+((result.kind==='error'||Date.now()-x.fetchedAt>=WEATHER_HOUR)?'Сохранён · ':'Обновлён · ')+esc(stamp)+'</small></span><span class="weather-side-icon" aria-hidden="true">'+condition.icon+'</span></span>';$('#mobileForecast').title=text;}else {$('#mobileForecast').textContent=text;$('#mobileForecast').title='';}};
 $('#loadWeather').onclick=()=>renderWeather(true);
 if(!c){show('Нет подтверждённых координат для прогноза.');return;}
 const q={date:day.date,zone,coords:c},saved=weatherService.cached(q);show(saved?forecastText({kind:'fresh',saved},day,zone):'Автоматически загружаем модельный прогноз…');$('#loadWeather').disabled=true;
 const result=await weatherService.get(q,{force});if(token!==weatherToken)return;show(forecastText(result,day,zone),result);$('#loadWeather').disabled=false;
}
$('#variantA').onclick=()=>{state.variant='A';save();render();};$('#variantB').onclick=()=>{state.variant='B';save();render();};$('#category').innerHTML+=[...new Set(places.map(p=>p.category))].sort().map(c=>`<option>${esc(c)}</option>`).join('');$('#city').innerHTML+=[...new Set(places.map(p=>p.city).filter(Boolean))].sort().map(c=>`<option>${esc(c)}</option>`).join('');for(const s of ['#search','#category','#priority','#status','#city'])$(s).addEventListener(s==='#search'?'input':'change',render);$('#clearFilters').onclick=()=>{for(const s of ['#search','#category','#priority','#status','#city'])$(s).value='';render();};$('#closeDetail').onclick=()=>$('#detail').close();$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#detail').close();}});
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({schemaVersion:1,...state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rempel-travel-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};$('#import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>200000)throw Error('Слишком большой файл');const j=JSON.parse(await f.text());if(j.schemaVersion!==1||!j.visited||!j.priorities)throw Error('Это не файл прогресса REMPEL TRAVEL');state=cleanState(j);save();render();toast('Прогресс загружен.');}catch(err){toast('Не удалось загрузить: '+err.message);}e.target.value='';};
$('#hotels').innerHTML=hotels.map((h,i)=>`<div class="hotel"><small>0${i+1} / ${h.from.slice(8)}.${h.from.slice(5,7)} — ${h.to.slice(8)}.${h.to.slice(5,7)}</small><h3>${esc(h.name)}</h3><p>${h.nights} ноч. · оплачено по сообщению пользователя</p><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name+' '+h.city)}">Найти отель ↗</a></div>`).join('');
function connection(){ $('#connection').textContent=navigator.onLine?'● Онлайн':'○ Без сети';}addEventListener('online',connection);addEventListener('offline',connection);connection();
try{const r=await fetch('./geocodes.json',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();geo=await r.json();}catch{toast('Координаты не загрузились. Список и навигация доступны.');}
if(globalThis.L){map=L.map('map',{scrollWheelZoom:false}).setView([35,137],5);layer=L.layerGroup().addTo(map);}else $('#map').textContent='Картографическая библиотека недоступна. Используйте ссылки в карточках.';
journeyUI=mountJourney({root:$('#journeyFollow'),getModel:()=>({date,days,places:effective(),journey:state.journey,visited:state.visited,hotels}),coordinate,priority:p=>priorityFor(p,state.variant),setVisited,changed:()=>{save();render();},onMap:showOnGoogle,notify:toast});
save();render();renderWeather(true);startWeatherRefresh({refresh:()=>renderWeather(true)});applyMobileView('day',false);setMapMode('google');$('#retryMap').onclick=()=>{if(mapMode==='google'){const frame=$('#googleFrame');frame.src=googleEmbedURL(googleQuery());}else if(basemapMounted){map.invalidateSize();$('#mapProvider').onchange();}};if(map){requestAnimationFrame(()=>map.invalidateSize());if(globalThis.ResizeObserver)new ResizeObserver(()=>map.invalidateSize()).observe(document.getElementById('map'));}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Офлайн-режим не включился. Откройте приложение по HTTPS или localhost.'));



