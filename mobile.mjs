export const mobileSections=['day','map','catalog','stays','more'];
export function resolveMobileView({date,lastDay='2026-11-29',lastCatalog='catalog'},target){
 const screen=mobileSections.includes(target)?target:'day';
 const isDay=/^2026-\d{2}-\d{2}$/.test(date);
 return {screen,date:screen==='day'?(isDay?date:lastDay):screen==='catalog'?(!isDay?date:lastCatalog):date,lastDay:isDay?date:lastDay,lastCatalog:!isDay&&['catalog','reserve'].includes(date)?date:lastCatalog};
}
export function shareableAppURL(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||/^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))return null;u.hash='';return u.href;}catch{return null;}
}
