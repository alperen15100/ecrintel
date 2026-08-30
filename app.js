const $=id=>document.getElementById(id);
const FALLBACK_MARKETS=[
 {symbol:"BTC",priceDisplay:"—",change:null,source:"Global feed"},
 {symbol:"GOLD",priceDisplay:"—",change:null,source:"Global feed"},
 {symbol:"BRENT",priceDisplay:"—",change:null,source:"Global feed"},
 {symbol:"S&P500",priceDisplay:"—",change:null,source:"Global feed"},
 {symbol:"NASDAQ",priceDisplay:"—",change:null,source:"Global feed"},
 {symbol:"DXY",priceDisplay:"—",change:null,source:"Global feed"}
];
let map,eqLayer,naturalLayers={},intelLayer,liveEvents=[],marketData=[...FALLBACK_MARKETS],marketMoveValue=0;
let filter="all",feedFilter="all";

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function fmtTime(ts){return new Date(ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}
function ageText(ts){const m=Math.max(0,Math.round((Date.now()-ts)/60000));return m<60?`${m}m`:m<1440?`${Math.round(m/60)}h`:`${Math.round(m/1440)}d`}
function regionOf(e){
 if(e.region && e.region!=="GLOBAL") return e.region;
 const text=`${e.title||""} ${e.description||""} ${e.source||""}`.toLowerCase();

 // Headline/entity classifier takes priority. This fixes stories whose RSS
 // item has no reliable coordinates or only a broad/ambiguous place match.
 const rules=[
  ["MIDDLE EAST",/\b(iran|iranian|tehran|hormuz|persian gulf|gulf states?|israel|israeli|gaza|palestin|jerusalem|lebanon|beirut|syria|syrian|damascus|iraq|iraqi|baghdad|yemen|yemeni|houthi|saudi|riyadh|qatar|doha|uae|emirates|dubai|abu dhabi|oman|bahrain|kuwait|middle east)\b/i],
  ["EUROPE",/\b(ukraine|ukrainian|kyiv|kiev|russia|russian|moscow|britain|british|england|english|united kingdom|u\.k\.|boe|bank of england|europe|european|eurozone|euro area|ecb|germany|german|berlin|france|french|paris|spain|spanish|madrid|italy|italian|rome|cyprus|cypriot|greece|greek|athens|poland|polish|warsaw|netherlands|dutch|belgium|brussels|switzerland|swiss|norway|sweden|finland|denmark|portugal|austria|balkans?|albania|serbia|romania|hungary|czech|slovakia)\b/i],
  ["ASIA",/\b(china|chinese|beijing|taiwan|taiwanese|japan|japanese|tokyo|boj|yen|south korea|korean|seoul|north korea|pyongyang|india|indian|delhi|pakistan|pakistani|islamabad|bangladesh|dhaka|indonesia|jakarta|philippines|manila|vietnam|hanoi|thailand|bangkok|malaysia|singapore|hong kong|west asia)\b/i],
  ["AMERICAS",/\b(united states|u\.s\.|usa|american|washington|federal reserve|fed\b|fomc|wall street|new york|canada|canadian|ottawa|mexico|mexican|brazil|brazilian|venezuela|venezuelan|argentina|argentine|chile|chilean|colombia|colombian|peru|peruvian|puerto rico|alaska)\b/i],
  ["AFRICA",/\b(africa|african|south africa|nigeria|nigerian|kenya|kenyan|ethiopia|ethiopian|somalia|somali|egypt|egyptian|cairo|libya|libyan|sudan|sudanese|morocco|moroccan|algeria|algerian|tunisia|tunisian|ghana|tanzania|uganda|congo)\b/i],
  ["OCEANIA",/\b(australia|australian|sydney|melbourne|new zealand|zealand|pacific islands?|fiji|papua new guinea)\b/i]
 ];
 for(const [region,rx] of rules) if(rx.test(text)) return region;

 // Only use coordinates when they actually exist. Never coerce null to 0,0.
 if(e.lat===null||e.lat===undefined||e.lon===null||e.lon===undefined||e.lat===""||e.lon==="")
   return e.region||"GLOBAL";
 const lat=Number(e.lat),lon=Number(e.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)) return e.region||"GLOBAL";

 // Geographic fallback.
 if(lat>=12&&lat<=42&&lon>=25&&lon<=65)return"MIDDLE EAST";
 if(lat>=34&&lat<=72&&lon>=-25&&lon<=60)return"EUROPE";
 if(lat>=-12&&lat<=60&&lon>=60&&lon<=180)return"ASIA";
 if(lat>=-60&&lat<=75&&lon>=-170&&lon<=-30)return"AMERICAS";
 if(lat>=-40&&lat<=38&&lon>=-20&&lon<=55)return"AFRICA";
 if(lat>=-50&&lat<=0&&lon>=110&&lon<=180)return"OCEANIA";
 return e.region||"GLOBAL";
}
function markerIcon(cls,size=10){return L.divIcon({className:"",html:`<div class="event-dot ${cls}"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]})}
function initMap(){
 if(map)return;
 map=L.map("map",{zoomControl:true,minZoom:2,worldCopyJump:true}).setView([24,15],2);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
 eqLayer=L.layerGroup().addTo(map);
 ["wildfire","storm","volcano","natural"].forEach(k=>naturalLayers[k]=L.layerGroup().addTo(map));
 intelLayer=L.layerGroup().addTo(map);
}
function impactForEvent(e){
 const t=((e.type||"")+" "+(e.title||"")+" "+(e.tags||[]).join(" ")).toLowerCase();
 let o={OIL:0,GOLD:0,BTC:0,NASDAQ:0,DXY:0,"S&P500":0};
 const add=(k,v)=>o[k]=Math.max(-10,Math.min(10,(o[k]||0)+v));
 if(/war|conflict|missile|attack|military|sanction|ceasefire|geopolit/.test(t)){add("GOLD",4);add("OIL",3);add("BTC",-2);add("NASDAQ",-2);add("S&P500",-2);add("DXY",2)}
 if(/oil|gas|pipeline|tanker|shipping|strait|energy|opec|refiner/.test(t)){add("OIL",5);add("GOLD",1);add("NASDAQ",-1)}
 if(/inflation|cpi|rates|interest|central bank|fed|ecb|jobs|gdp|tariff|trade/.test(t)){add("DXY",3);add("GOLD",2);add("NASDAQ",-2);add("S&P500",-2);add("BTC",-1)}
 if(/earthquake/.test(t)){add("GOLD",1)}
 if(/wildfire|fire/.test(t)){add("GOLD",1)}
 if(/storm|cyclone|hurricane/.test(t)){add("OIL",2);add("GOLD",1)}
 if(/volcano/.test(t)){add("GOLD",1)}
 const mult=Math.max(.5,Math.min(1.5,(Number(e.severity)||5)/7));
 Object.keys(o).forEach(k=>o[k]=Math.round(Math.max(-10,Math.min(10,o[k]*mult))));
 return o;
}
function scoreClass(v){return v>0?"up":v<0?"down":"flat"}
function renderImpact(e){
 const imp=impactForEvent(e), nonzero=Object.entries(imp).filter(([,v])=>v!==0);
 $("mr").textContent=`${String(e.type||"intel").toUpperCase()} · ${e.source||"SOURCE"}`;
 $("mt").textContent=e.title;
 $("md").textContent=`${e.description||"Observed source event."} Region: ${regionOf(e)}. Severity tier: ${e.severity||"—"}/10.`;
 $("mi").innerHTML=(nonzero.length?nonzero:Object.entries(imp)).map(([k,v])=>`<div><span>${k}</span><b class="${scoreClass(v)}">${v>0?"+":""}${v}</b></div>`).join("");
 const sl=$("sourceLink");if(sl){if(e.url){sl.href=e.url;sl.classList.remove("hide")}else{sl.removeAttribute("href");sl.classList.add("hide")}}$("modal").classList.remove("hide");
}
async function loadEarthquakes(){
 const r=await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",{cache:"no-store"});if(!r.ok)throw Error("USGS "+r.status);
 const j=await r.json();eqLayer.clearLayers();const events=[];
 j.features.slice(0,120).forEach(f=>{const[lon,lat]=f.geometry.coordinates,mag=Number(f.properties.mag||0);
  const e={id:"eq-"+f.id,type:"earthquake",category:"natural",source:"USGS",title:`M${mag.toFixed(1)} · ${f.properties.place||"Earthquake"}`,description:"USGS real-time earthquake feed",lat,lon,time:f.properties.time,severity:Math.min(10,Math.max(2,Math.round(mag*1.4)))};
  events.push(e);const m=L.marker([lat,lon],{icon:markerIcon("eq",10)}).bindPopup(`<b>${esc(e.title)}</b><br>USGS · ${new Date(e.time).toLocaleString("tr-TR")}`);m.on("click",()=>renderImpact(e));m.addTo(eqLayer);
 });$("eqCount").textContent=events.length;return events;
}
function eonetType(cat){const c=(cat||"").toLowerCase();if(c.includes("wildfire"))return"wildfire";if(c.includes("storm"))return"storm";if(c.includes("volcano"))return"volcano";return"natural"}
async function loadEonet(){
 const r=await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=100",{cache:"no-store"});if(!r.ok)throw Error("EONET "+r.status);
 const j=await r.json();Object.values(naturalLayers).forEach(l=>l.clearLayers());const events=[];
 (j.events||[]).forEach(ev=>{const g=(ev.geometry||[]).at(-1);if(!g||g.type!=="Point"||!Array.isArray(g.coordinates))return;
  const[lon,lat]=g.coordinates,cat=ev.categories?.[0]?.title||"Natural Event",type=eonetType(cat),sev=type==="volcano"?8:type==="storm"?7:type==="wildfire"?6:5;
  const e={id:"eo-"+ev.id,type,category:"natural",source:"NASA EONET",title:ev.title||cat,description:cat,lat,lon,time:Date.parse(g.date)||Date.now(),severity:sev};
  events.push(e);const cls=type==="wildfire"?"fire":type==="storm"?"storm":type==="volcano"?"volcano":"other";
  const m=L.marker([lat,lon],{icon:markerIcon(cls,10)}).bindPopup(`<b>${esc(e.title)}</b><br>${esc(cat)} · NASA EONET`);m.on("click",()=>renderImpact(e));m.addTo(naturalLayers[type]);
 });$("eonetCount").textContent=events.length;return events;
}
async function loadIntel(){
 const urls=[
  {name:"LOCAL",url:`data/intel.json?t=${Date.now()}`},
  {name:"RAW",url:`https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/intel.json?t=${Date.now()}`}
 ];
 const payloads=[];
 for(const s of urls){
  try{
   const r=await fetch(s.url,{cache:"no-store"});
   if(!r.ok)throw Error(`intel ${r.status}`);
   const j=await r.json();
   if(!j||!Array.isArray(j.events))throw Error("invalid intel payload");
   payloads.push({name:s.name,j,count:j.events.length});
  }catch(e){
   console.warn("intel source failed",s.name,e);
  }
 }
 if(!payloads.length){
  $("intelCount").textContent="0";
  $("intelState").textContent="INTEL FEED DEGRADED";
  return[];
 }

 // Pages can briefly serve the placeholder intel.json immediately after a deploy.
 // Always choose the freshest/non-empty payload instead of accepting an empty local file.
 payloads.sort((a,b)=>{
  const ac=Number(a.count)||0,bc=Number(b.count)||0;
  if(bc!==ac)return bc-ac;
  const at=Date.parse(a.j.updatedAt||0)||0,bt=Date.parse(b.j.updatedAt||0)||0;
  return bt-at;
 });
 const chosen=payloads[0],j=chosen.j;

 const arr=(j.events||[]).map((x,i)=>{
  const parsed=typeof x.time==="number"?x.time:Date.parse(x.time);
  return {
   ...x,
   id:String(x.id||("intel-"+i)),
   time:Number.isFinite(parsed)?parsed:Date.now(),
   severity:Number(x.severity)||5
  };
 });

 const c=j.counts||{};
 $("intelCount").textContent=arr.length;
 $("intelState").textContent=
   `${arr.length} LIVE · GEO ${c.geopolitics??arr.filter(e=>e.category==="geopolitics").length}`+
   ` · ENERGY ${c.energy??arr.filter(e=>e.category==="energy").length}`+
   ` · MACRO ${c.macro??arr.filter(e=>e.category==="macro").length}`;

 try{
  if(intelLayer)intelLayer.clearLayers();
  arr.forEach(e=>{
   if(e.lat===null||e.lat===undefined||e.lon===null||e.lon===undefined||e.lat===""||e.lon==="")return;
   const lat=Number(e.lat),lon=Number(e.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
   try{
    const cls=e.category==="geopolitics"?"geo":e.category==="energy"?"energy":e.category==="macro"?"macro":"intel";
    const marker=L.marker([lat,lon],{icon:markerIcon(cls,11)})
      .bindPopup(`<b>${esc(e.title)}</b><br>${esc(e.source||"Intel")} · ${esc(e.category||"intel")}`);
    marker.on("click",()=>renderImpact(e));
    marker.addTo(intelLayer);
   }catch(markerErr){
    console.warn("intel marker skipped",e.id,markerErr);
   }
  });
 }catch(layerErr){
  console.warn("intel map layer degraded",layerErr);
 }

 console.log("ECRINTEL intel loaded",chosen.name,arr.length);
 return arr;
}
async function loadMarkets(){
 let data=[...FALLBACK_MARKETS];
 try{const r=await fetch(`data/markets.json?t=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw Error("market "+r.status);const j=await r.json();if(Array.isArray(j.markets)&&j.markets.length)data=j.markets;
  $("marketState").textContent=j.updatedAt?`GLOBAL · ${new Date(j.updatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} UTC`:"GLOBAL MARKET FEED";
 }catch(e){console.warn(e)}
 marketData=data;const moves=data.filter(x=>Number.isFinite(x.change)).map(x=>Math.abs(x.change));marketMoveValue=moves.length?moves.reduce((a,b)=>a+b,0)/moves.length:0;renderMarkets();
}
function renderMarkets(){
 $("markets").innerHTML=marketData.map(x=>{const c=x.change,cls=c==null?"flat":c>=0?"up":"down",ch=c==null?"—":`${c>=0?"+":""}${c.toFixed(2)}%`;return `<div class="market"><span>${esc(x.symbol)}<small> ${esc(x.source||"Global feed")}</small></span><b>${esc(x.priceDisplay||x.price||"—")}</b><i class="${cls}">${ch}</i></div>`}).join("");
 $("ticker").innerHTML=marketData.slice(0,5).map(x=>{const c=x.change,cls=c==null?"flat":c>=0?"up":"down";return `<span><b>${esc(x.symbol)}</b> ${esc(x.priceDisplay||x.price||"—")}${c==null?"":` <i class="${cls}">${c>=0?"+":""}${c.toFixed(2)}%</i>`}</span>`}).join("");
}
function matchesFilter(e){
 if(filter==="all"||filter==="markets")return true;
 if(["geopolitics","macro","energy"].includes(filter))return e.category===filter;
 if(["earthquake","wildfire","storm","volcano"].includes(filter))return e.type===filter;
 if(["americas","europe","middleeast","asia","africa"].includes(filter)){const want={americas:"AMERICAS",europe:"EUROPE",middleeast:"MIDDLE EAST",asia:"ASIA",africa:"AFRICA"}[filter];return regionOf(e)===want}
 return true;
}
function matchesFeed(e){if(feedFilter==="all")return true;if(feedFilter==="natural")return e.category==="natural";return e.category===feedFilter}
function renderFeed(){
 const arr=liveEvents.filter(e=>matchesFilter(e)&&matchesFeed(e)).sort((a,b)=>(b.severity-a.severity)||(b.time-a.time)).slice(0,24);
 $("feed").innerHTML=arr.length?arr.map(e=>`<div class="feeditem" data-event="${esc(e.id)}"><time>${ageText(e.time)}</time><em>${esc(String(e.category||e.type).toUpperCase())} · ${esc(e.source)}</em><b> ${esc(e.title)}</b><p>${esc(regionOf(e))} · severity ${e.severity}/10 · open impact</p></div>`).join(""):`<div class="feeditem"><p>No signals for this filter.</p></div>`;
 document.querySelectorAll("[data-event]").forEach(el=>el.onclick=()=>{const e=liveEvents.find(x=>x.id===el.dataset.event);if(e)renderImpact(e)});
}
function updateActivity(){
 $("activeEvents").textContent=liveEvents.length;$("criticalEvents").textContent=liveEvents.filter(e=>e.severity>=7).length;
 $("activeRegions").textContent=new Set(liveEvents.map(regionOf).filter(x=>x!=="GLOBAL")).size;
 $("marketMove").textContent=marketMoveValue?marketMoveValue.toFixed(2)+"%":"—";
}
function updateImpactEngine(){
 const candidates=liveEvents.filter(e=>["geopolitics","macro","energy"].includes(e.category)).sort((a,b)=>(b.severity-a.severity)||(b.time-a.time));
 const top=candidates[0]||[...liveEvents].sort((a,b)=>b.severity-a.severity)[0];if(!top)return;
 const imp=impactForEvent(top),affected=Object.values(imp).filter(v=>v!==0).length,related=liveEvents.filter(e=>e.category===top.category).length;
 $("signalCount").textContent=`${related} RELATED`;
 $("correlation").innerHTML=`<strong>${esc(top.title)}</strong><p>${esc(String(top.category||top.type).toUpperCase())} · ${esc(regionOf(top))} · source-based relationship view.</p><div>AFFECTED MARKETS <b>${affected}</b></div><div>RELATED SIGNALS <b>${related}</b></div><div>SOURCE <b>${esc(top.source)}</b></div>`;
}
function setLayerVisibility(){
 const show=(layer,on)=>{if(!layer)return;if(on&&!map.hasLayer(layer))map.addLayer(layer);if(!on&&map.hasLayer(layer))map.removeLayer(layer)};
 show(eqLayer,filter==="all"||filter==="markets"||filter==="earthquake"||["americas","europe","middleeast","asia","africa"].includes(filter));
 Object.entries(naturalLayers).forEach(([k,l])=>show(l,filter==="all"||filter==="markets"||filter===k||["americas","europe","middleeast","asia","africa"].includes(filter)));
 show(intelLayer,filter==="all"||filter==="markets"||filter==="geopolitics"||filter==="macro"||filter==="energy"||["americas","europe","middleeast","asia","africa"].includes(filter));
}
function applyLayer(){
 setLayerVisibility();
 const views={americas:[15,-85,2],europe:[51,15,3],middleeast:[29,45,4],asia:[32,100,3],africa:[3,20,3]};
 if(views[filter])map.setView([views[filter][0],views[filter][1]],views[filter][2]);else if(filter==="all")map.setView([24,15],2);
 renderFeed();
}
async function refreshData(){
 let ok=0;
 const [eq,nat,intel]=await Promise.all([
  loadEarthquakes().catch(e=>{console.warn(e);return[]}),
  loadEonet().catch(e=>{console.warn(e);return[]}),
  loadIntel().catch(e=>{console.warn(e);return[]})
 ]);
 if(eq.length)ok++;if(nat.length)ok++;if(intel.length)ok++;
 liveEvents=dedupeEvents([...eq,...nat,...intel]);await loadMarkets();renderFeed();updateActivity();updateImpactEngine();setLayerVisibility();refreshSuite();
 $("lastUpdate").textContent=fmtTime(Date.now());$("sysStatus").className="status "+(ok>=2?"live":"warn");$("sysStatus").innerHTML=`<i></i> ${ok>=2?"LIVE":"PARTIAL LIVE"}`;
}

const ASSETS=["BTC","ETH","GOLD","BRENT","WTI","S&P500","NASDAQ","DXY","EUR/USD","NIKKEI","DAX","FTSE","HANG SENG"];
const ASSET_TERMS={
 "BTC":/\b(btc|bitcoin|crypto|cryptocurrency)\b/i,
 "ETH":/\b(eth|ethereum)\b/i,
 "GOLD":/\b(gold|bullion|xau)\b/i,
 "BRENT":/\b(brent|oil|opec|tanker|pipeline|refinery|hormuz|red sea|crude)\b/i,
 "WTI":/\b(wti|oil|crude|pipeline|refinery|inventory)\b/i,
 "S&P500":/\b(s&p|s&p500|s&p 500|wall street|u\.s\. stocks?|us stocks?)\b/i,
 "NASDAQ":/\b(nasdaq|tech stocks?|semiconductor|chip stocks?)\b/i,
 "DXY":/\b(dxy|dollar index|u\.s\. dollar|us dollar|greenback)\b/i,
 "EUR/USD":/\b(eur\/usd|euro|ecb|eurozone|euro area)\b/i,
 "NIKKEI":/\b(nikkei|japan|japanese|boj|yen)\b/i,
 "DAX":/\b(dax|germany|german|frankfurt)\b/i,
 "FTSE":/\b(ftse|britain|british|united kingdom|bank of england|boe|sterling)\b/i,
 "HANG SENG":/\b(hang seng|hong kong|china|chinese|yuan|renminbi)\b/i
};
const ASSET_CONTEXT={
 "BTC":/\b(fed|rates?|inflation|liquidity|risk assets?|geopolit|war|sanction)\b/i,
 "ETH":/\b(fed|rates?|liquidity|crypto|risk assets?)\b/i,
 "GOLD":/\b(fed|rates?|inflation|war|conflict|sanction|dollar|geopolit)\b/i,
 "BRENT":/\b(war|conflict|sanction|shipping|supply|middle east|energy)\b/i,
 "WTI":/\b(war|conflict|sanction|supply|energy|inventory)\b/i,
 "S&P500":/\b(fed|rates?|inflation|jobs?|gdp|earnings|u\.s\.|united states)\b/i,
 "NASDAQ":/\b(fed|rates?|inflation|technology|ai|semiconductor|u\.s\.|united states)\b/i,
 "DXY":/\b(fed|rates?|inflation|jobs?|gdp|fomc|united states|u\.s\.)\b/i,
 "EUR/USD":/\b(ecb|fed|rates?|inflation|europe|eurozone|united states|u\.s\.)\b/i,
 "NIKKEI":/\b(boj|yen|japan|japanese|rates?|inflation)\b/i,
 "DAX":/\b(ecb|eurozone|germany|german|europe|energy)\b/i,
 "FTSE":/\b(boe|bank of england|britain|british|sterling|uk|oil)\b/i,
 "HANG SENG":/\b(hong kong|china|chinese|yuan|renminbi|pboc|property)\b/i
};
function relevantEvents(asset){
 const direct=ASSET_TERMS[asset]||/.^/,context=ASSET_CONTEXT[asset]||/.^/;
 return liveEvents.map(e=>{
   const text=`${e.title} ${e.description||""} ${(e.tags||[]).join(" ")}`;
   let score=0;
   if(direct.test(text))score+=3;
   if(context.test(text))score+=1;
   if(asset==="HANG SENG" && regionOf(e)==="ASIA")score+=1;
   if(asset==="NIKKEI" && regionOf(e)==="ASIA")score+=1;
   if(asset==="DAX" && regionOf(e)==="EUROPE")score+=1;
   if(asset==="FTSE" && regionOf(e)==="EUROPE")score+=1;
   if(asset==="DXY" && regionOf(e)==="AMERICAS")score+=1;
   return {e,score};
  }).filter(x=>x.score>=3)
   .sort((a,b)=>(b.score-a.score)||(b.e.severity-a.e.severity)||(b.e.time-a.e.time))
   .slice(0,5).map(x=>x.e);
}
function renderWhy(asset){
 document.querySelectorAll("#assetChips button").forEach(b=>b.classList.toggle("on",b.dataset.asset===asset));
 const evs=relevantEvents(asset),md=marketData.find(x=>x.symbol===asset);
 const move=md&&Number.isFinite(md.change)?`${md.change>=0?"+":""}${md.change.toFixed(2)}%`:"—";
 $("whyBox").innerHTML=`<strong>${esc(asset)} · 24H ${move}</strong><p>Current source events that may be relevant. This is not a claim of causation.</p>`+
 (evs.length?evs.map(e=>`<div class="whySignal" data-why="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(e.source)} · ${esc(regionOf(e))} · ${ageText(e.time)}</small></div>`).join(""):`<div class="whySignal"><small>No strong current relationship signal found.</small></div>`);
 document.querySelectorAll("[data-why]").forEach(el=>el.onclick=()=>{const e=liveEvents.find(x=>x.id===el.dataset.why);if(e)renderImpact(e)});
}
function setupWhy(){
 $("assetChips").innerHTML=ASSETS.map(a=>`<button data-asset="${esc(a)}">${esc(a)}</button>`).join("");
 document.querySelectorAll("#assetChips button").forEach(b=>b.onclick=()=>renderWhy(b.dataset.asset));
}
function getWatch(){try{return JSON.parse(localStorage.getItem("ecrintel-watch")||'["BTC","GOLD","BRENT"]')}catch{return["BTC","GOLD","BRENT"]}}
function renderWatch(){
 const w=getWatch();$("watchChips").innerHTML=ASSETS.map(a=>`<button class="${w.includes(a)?"on":""}" data-watch="${esc(a)}">${esc(a)}</button>`).join("");
 $("watchStatus").textContent=w.length?`Monitoring ${w.join(" · ")} on this device.`:"No assets selected.";
 document.querySelectorAll("[data-watch]").forEach(b=>b.onclick=()=>{let x=getWatch();x=x.includes(b.dataset.watch)?x.filter(a=>a!==b.dataset.watch):[...x,b.dataset.watch];localStorage.setItem("ecrintel-watch",JSON.stringify(x));renderWatch()});
}
async function enableAlerts(){
 if(!("Notification"in window))return $("watchStatus").textContent="Browser notifications are not supported here.";
 const p=await Notification.requestPermission();$("watchStatus").textContent=p==="granted"?"Device alerts enabled while ECRINTEL is active.":"Notification permission not granted.";
}
function setupSearch(){
 const input=$("intelSearch");
 const run=()=>{const q=input.value.trim().toLowerCase();if(!q)return $("searchResults").innerHTML="<small>Search across current intelligence signals.</small>";
  const arr=liveEvents.filter(e=>`${e.title} ${e.source} ${e.category} ${regionOf(e)}`.toLowerCase().includes(q)).slice(0,20);
  $("searchResults").innerHTML=arr.length?arr.map(e=>`<div class="feeditem" data-search="${esc(e.id)}"><time>${ageText(e.time)}</time><em>${esc(String(e.category).toUpperCase())}</em><b> ${esc(e.title)}</b><p>${esc(e.source)} · ${esc(regionOf(e))}</p></div>`).join(""):"<small>No matching live signals.</small>";
  document.querySelectorAll("[data-search]").forEach(el=>el.onclick=()=>{const e=liveEvents.find(x=>x.id===el.dataset.search);if(e)renderImpact(e)});
 };
 input.addEventListener("input",run);$("searchClear").onclick=()=>{input.value="";run()};
}
async function loadCalendar(){
 try{const r=await fetch(`data/calendar.json?t=${Date.now()}`,{cache:"no-store"});const j=await r.json();const a=(j.events||[]).slice(0,12);
 $("calendarState").textContent=j.updatedAt?`UPDATED ${new Date(j.updatedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} UTC`:"UPCOMING";
 $("macroCalendar").innerHTML=a.length?a.map(x=>`<div class="calendarRow"><time>${esc(x.when||"TBD")}</time><div class="calendarText"><b>${esc(x.title)}</b><small>${esc(x.region||"GLOBAL")} · ${esc(x.source||"Official schedule")}</small></div><em>${esc(x.importance||"HIGH")}</em></div>`).join(""):`<div class="feeditem"><p>No scheduled high-impact releases in snapshot.</p></div>`;
 }catch(e){$("macroCalendar").innerHTML='<div class="feeditem"><p>Calendar feed unavailable.</p></div>'}
}
function dedupeEvents(arr){
 const groups=[];
 for(const e of arr){
  const words=new Set(String(e.title).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(x=>x.length>4));
  let g=groups.find(x=>{const w=new Set(String(x.title).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(y=>y.length>4));const common=[...words].filter(y=>w.has(y)).length;return common>=Math.min(4,Math.max(2,Math.floor(Math.min(words.size,w.size)*.55)))});
  if(g){g.sources=g.sources||[g.source];if(!g.sources.includes(e.source))g.sources.push(e.source);g.severity=Math.max(g.severity,e.severity);if(!g.url&&e.url)g.url=e.url}
  else groups.push({...e,sources:[e.source]});
 }
 return groups;
}
function checkWatchAlerts(){
 if(!("Notification"in window)||Notification.permission!=="granted")return;
 const w=getWatch(),last=Number(localStorage.getItem("ecrintel-alert-ts")||0),now=Date.now();
 const hits=[];
 w.forEach(a=>relevantEvents(a).filter(e=>e.severity>=8&&e.time>last).forEach(e=>hits.push({a,e})));
 if(hits.length){const h=hits[0];new Notification(`ECRINTEL · ${h.a}`,{body:h.e.title});localStorage.setItem("ecrintel-alert-ts",String(now))}
}

function setup(){
 initMap();
 document.querySelectorAll("#toolbar button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#toolbar button").forEach(x=>x.classList.remove("on"));b.classList.add("on");filter=b.dataset.layer;applyLayer()});
 document.querySelectorAll("#intelTabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#intelTabs button").forEach(x=>x.classList.remove("on"));b.classList.add("on");feedFilter=b.dataset.feed;renderFeed()});
 $("x").onclick=()=>$("modal").classList.add("hide");$("modal").onclick=e=>{if(e.target===$("modal"))$("modal").classList.add("hide")};
 const nav=$("bottomNav"),buttons=[...nav.querySelectorAll("button[data-target]")];buttons.forEach(btn=>btn.onclick=()=>{const target=$(btn.dataset.target);if(!target)return;buttons.forEach(b=>b.classList.remove("on"));btn.classList.add("on");window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+scrollY-84),behavior:"smooth"})});
 setupWhy();setupAssetIntel();renderWatch();setupSearch();$("notifyBtn").onclick=enableAlerts;loadCalendar();
 refreshData().then(()=>checkWatchAlerts()).catch(console.warn);setInterval(()=>refreshData().then(()=>checkWatchAlerts()).catch(console.warn),10*60*1000);
}
document.addEventListener("DOMContentLoaded",setup);


/* ECRINTEL INTELLIGENCE SUITE 208 */
let breakingEvent=null, selectedAssetIntel="BRENT";
function sourceNames(e){return [...new Set((e.sources&&e.sources.length?e.sources:[e.source]).filter(Boolean))]}
function renderBreaking(){
 const arr=liveEvents.filter(e=>["geopolitics","energy","macro"].includes(e.category)&&e.severity>=8&&(Date.now()-e.time)<43200000).sort((a,b)=>(b.severity-a.severity)||(b.time-a.time));
 breakingEvent=arr[0]||null;const bar=$("breakingBar");if(!bar)return;
 if(!breakingEvent){bar.classList.add("hide");return}bar.classList.remove("hide");
 $("breakingText").textContent=`${breakingEvent.category.toUpperCase()} · ${regionOf(breakingEvent)} · ${breakingEvent.title}`;
 $("breakingOpen").onclick=()=>renderImpact(breakingEvent);
}
function renderAssetIntel(asset){
 selectedAssetIntel=asset;document.querySelectorAll("#assetIntelChips button").forEach(b=>b.classList.toggle("on",b.dataset.assetintel===asset));
 const md=marketData.find(x=>x.symbol===asset),evs=relevantEvents(asset),price=md?.priceDisplay||md?.price||"—",ch=Number.isFinite(md?.change)?`${md.change>=0?"+":""}${md.change.toFixed(2)}%`:"—";
 const cats={};evs.forEach(e=>cats[e.category]=(cats[e.category]||0)+1);
 $("assetIntelBody").innerHTML=`<div class="assetHero"><div><small>ASSET DOSSIER</small><strong>${esc(asset)}</strong></div><div><b>${esc(price)}</b><em class="${Number(md?.change)>=0?"up":"down"}">${ch}</em></div></div><div class="assetMetrics"><div>GEO<b>${cats.geopolitics||0}</b></div><div>MACRO<b>${cats.macro||0}</b></div><div>ENERGY<b>${cats.energy||0}</b></div><div>RELATED<b>${evs.length}</b></div></div><p class="assetDisclaimer">Observed intelligence relationships, not a claim of causation or a price forecast.</p>${evs.length?evs.map(e=>`<div class="whySignal" data-dossier="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(e.source)} · ${esc(regionOf(e))} · ${ageText(e.time)} · severity ${e.severity}/10</small></div>`).join(""):"<div class='whySignal'><small>No strong current relationship signal.</small></div>"}`;
 document.querySelectorAll("[data-dossier]").forEach(el=>el.onclick=()=>{const e=liveEvents.find(x=>x.id===el.dataset.dossier);if(e){renderTimeline(e);renderImpact(e)}});renderTimelineForAsset(asset);
}
function setupAssetIntel(){$("assetIntelChips").innerHTML=ASSETS.map(a=>`<button data-assetintel="${esc(a)}">${esc(a)}</button>`).join("");document.querySelectorAll("[data-assetintel]").forEach(b=>b.onclick=()=>renderAssetIntel(b.dataset.assetintel))}
function renderTimeline(e){const related=liveEvents.filter(x=>x.category===e.category&&regionOf(x)===regionOf(e)).sort((a,b)=>a.time-b.time).slice(-8);$("intelTimeline").innerHTML=`<div class="timelineTitle"><b>${esc(e.title)}</b><small>${esc(regionOf(e))} · ${esc(e.category.toUpperCase())}</small></div>`+related.map(x=>`<div class="timelineRow" data-timeevent="${esc(x.id)}"><time>${new Date(x.time).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time><i></i><div><b>${esc(x.title)}</b><small>${esc(sourceNames(x).join(" · "))} · ${sourceNames(x).length} source${sourceNames(x).length===1?"":"s"}</small></div></div>`).join("");document.querySelectorAll("[data-timeevent]").forEach(el=>el.onclick=()=>{const x=liveEvents.find(y=>y.id===el.dataset.timeevent);if(x)renderImpact(x)})}
function renderTimelineForAsset(asset){const evs=relevantEvents(asset).slice().sort((a,b)=>a.time-b.time);if(!evs.length)return;$("intelTimeline").innerHTML=`<div class="timelineTitle"><b>${esc(asset)} INTELLIGENCE TIMELINE</b><small>RELATED OBSERVED EVENTS</small></div>`+evs.map(x=>`<div class="timelineRow" data-timeevent="${esc(x.id)}"><time>${new Date(x.time).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time><i></i><div><b>${esc(x.title)}</b><small>${esc(regionOf(x))} · ${esc(sourceNames(x).join(" · "))}</small></div></div>`).join("");document.querySelectorAll("[data-timeevent]").forEach(el=>el.onclick=()=>{const x=liveEvents.find(y=>y.id===el.dataset.timeevent);if(x)renderImpact(x)})}
function renderVerification(){const arr=liveEvents.filter(e=>["geopolitics","energy","macro"].includes(e.category)).sort((a,b)=>sourceNames(b).length-sourceNames(a).length||b.severity-a.severity).slice(0,12);$("verificationFeed").innerHTML=arr.length?arr.map(e=>{const s=sourceNames(e),level=s.length>=3?"MULTI-SOURCE":s.length===2?"CORROBORATED":"SINGLE SOURCE";return `<div class="verifyRow" data-verify="${esc(e.id)}"><div><em class="${s.length>=2?"verified":"single"}">${level}</em><b>${esc(e.title)}</b><small>${esc(s.join(" · "))}</small></div><strong>${s.length}<small>SOURCES</small></strong></div>`}).join(""):"<div class='feeditem'><p>No intelligence signals.</p></div>";document.querySelectorAll("[data-verify]").forEach(el=>el.onclick=()=>{const e=liveEvents.find(x=>x.id===el.dataset.verify);if(e)renderImpact(e)})}
function refreshSuite(){renderBreaking();renderVerification();renderAssetIntel(selectedAssetIntel)}

document.addEventListener("click",e=>{const row=e.target.closest?.("#markets .market");if(!row)return;const sym=row.querySelector("span")?.childNodes?.[0]?.textContent?.trim();if(sym&&ASSETS.includes(sym)){renderAssetIntel(sym);$("assetIntelSection")?.scrollIntoView({behavior:"smooth",block:"start"})}});
