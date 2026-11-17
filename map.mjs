// Esri English reference labels are separate from the neutral cartographic base.
export function mountBasemap(map,{L,status,selector,retry,schedule=setTimeout,cancel=clearTimeout}){
  const root='https://services.arcgisonline.com/ArcGIS/rest/services/';
  const providers={
    english:[root+'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',root+'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
    streets:[root+'World_Street_Map/MapServer/tile/{z}/{y}/{x}']
  };
  let layers=[],generation=0,timer,current='english',disposed=false;
  function select(id,automatic=false){
    if(disposed)return;
    current=providers[id]?id:'english';selector.value=current;
    cancel(timer);generation++;const thisGeneration=generation;
    for(const l of layers)map.removeLayer(l);layers=[];
    let baseLoaded=0,labelsLoaded=0,errors=0;
    const active=()=>!disposed&&generation===thisGeneration;
    status.textContent=automatic?'Основная подложка не ответила. Загружаем резервную карту…':'Загружаем карту…';
    function unavailable(){
      if(!active())return;
      if(current==='english'){select('streets',true);return;}
      status.textContent='Подложка недоступна. Проверьте интернет и нажмите «Повторить». Точки и линии маршрута остаются доступны.';
    }
    providers[current].forEach((url,index)=>{
      const layer=L.tileLayer(url,{
        minZoom:0,maxZoom:19,maxNativeZoom:current==='english'?16:19,
        referrerPolicy:'no-referrer',
        attribution:index===0?'Tiles © <a href="https://www.esri.com/">Esri</a> · Esri, HERE, Garmin, USGS, OpenStreetMap contributors':'',
        ...(index===1?{pane:'englishLabels'}:{})
      });
      layer.on('tileload',()=>{
        if(!active())return;
        if(index===0)baseLoaded++;else labelsLoaded++;
        if(baseLoaded){
          status.textContent=current==='english'?(labelsLoaded?'Карта Esri · английские названия':'Подложка загружена. Загружаем английские названия…'):'Резервная карта Esri · английские и местные названия';
          if(current!=='english'||labelsLoaded)cancel(timer);
        }
      });
      layer.on('tileerror',()=>{
        if(!active())return;
        errors++;
        if(errors>=3&&baseLoaded===0)unavailable();
        else if(index===1&&baseLoaded)status.textContent='Карта загружена, но английские подписи пока недоступны. Нажмите «Повторить».';
      });
      layers.push(layer);layer.addTo(map);
    });
    timer=schedule(()=>{if(!active())return;if(!baseLoaded)unavailable();else if(current==='english'&&!labelsLoaded)status.textContent='Подложка загружена. Слой английских названий не ответил — нажмите «Повторить».';},12000);
  }
  selector.onchange=()=>select(selector.value);retry.onclick=()=>{map.invalidateSize();select(selector.value);};
  map.createPane('englishLabels');map.getPane('englishLabels').style.zIndex='350';map.getPane('englishLabels').style.pointerEvents='none';
  select('english');
  return {select,destroy(){disposed=true;generation++;cancel(timer);layers.forEach(l=>map.removeLayer(l));}};
}
