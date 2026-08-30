import json,re,urllib.request,urllib.parse,xml.etree.ElementTree as ET,hashlib
from datetime import datetime,timezone
from pathlib import Path
from email.utils import parsedate_to_datetime

# Separate focused queries are intentional: one giant Google News query behaves too much like AND
# and can return only a handful of stories.
QUERIES=[
 ("geopolitics","Iran Israel conflict OR missile OR ceasefire when:1d"),
 ("geopolitics","Ukraine Russia war OR strike OR sanctions when:1d"),
 ("geopolitics","China Taiwan military OR trade tensions when:1d"),
 ("geopolitics","Red Sea shipping attack OR Hormuz tanker when:1d"),
 ("geopolitics","sanctions tariffs geopolitical markets when:1d"),
 ("energy","oil OPEC production prices when:1d"),
 ("energy","tanker shipping Hormuz Red Sea oil when:1d"),
 ("energy","gas pipeline refinery disruption when:1d"),
 ("energy","Brent WTI supply disruption when:1d"),
 ("macro","Federal Reserve rates inflation jobs when:1d"),
 ("macro","ECB rates inflation euro area when:1d"),
 ("macro","Bank of England rates inflation UK when:1d"),
 ("macro","Bank of Japan yen rates inflation when:1d"),
 ("macro","CPI GDP payrolls tariffs markets when:1d"),
]
LOCATIONS={
 "iran":(32,53),"israel":(31.5,34.8),"gaza":(31.4,34.4),"ukraine":(49,32),"russia":(55,37),
 "china":(35,103),"taiwan":(23.7,121),"japan":(36,138),"india":(22,79),"pakistan":(30,69),
 "turkey":(39,35),"türkiye":(39,35),"syria":(35,38),"iraq":(33,44),"saudi":(24,45),
 "yemen":(15.5,48),"qatar":(25.3,51.2),"uae":(24,54),"dubai":(25.2,55.3),"europe":(50,10),
 "germany":(51,10),"france":(46,2),"uk":(54,-2),"britain":(54,-2),"united states":(39,-98),
 "washington":(38.9,-77),"new york":(40.7,-74),"middle east":(29,45),"red sea":(20,38),
 "hormuz":(26.5,56.3),"persian gulf":(26,52),"black sea":(43,35),"taiwan strait":(24.5,119.5),
 "hong kong":(22.3,114.2),"south korea":(36,128),"north korea":(40,127)
}
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ECRINTEL/2.0; +https://alperen15100.github.io/ecrintel/)"})
 with urllib.request.urlopen(req,timeout=20) as r:return r.read()
def loc(text):
 t=text.lower()
 # longest phrases first avoids "taiwan" winning over "taiwan strait"
 for k in sorted(LOCATIONS,key=len,reverse=True):
  if k in t:return LOCATIONS[k]
 return (None,None)
def severity(title,cat):
 t=title.lower();s=5
 if re.search(r'\b(war|missile|attack|strike|invasion|blockade|explosion|emergency|evacuation)\b',t):s+=2
 if re.search(r'\b(sanction|tanker|pipeline|opec|tariff|rate hike|rate cut|inflation|shutdown|disruption)\b',t):s+=1
 if cat=="geopolitics" and re.search(r'\b(ceasefire|nuclear|military|troops)\b',t):s+=1
 return min(9,s)
def normalize(s):
 return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
def near_duplicate(a,b):
 A=set(x for x in normalize(a).split() if len(x)>3); B=set(x for x in normalize(b).split() if len(x)>3)
 if not A or not B:return False
 return len(A&B)/max(1,min(len(A),len(B)))>=0.72


def classify_region(title,source=""):
 t=(str(title)+" "+str(source)).lower()
 rules=[
  ("MIDDLE EAST",["iran","iranian","tehran","hormuz","persian gulf","israel","gaza","palestin","lebanon","syria","iraq","yemen","houthi","saudi","qatar","uae","dubai","oman","bahrain","kuwait","middle east"]),
  ("EUROPE",["ukraine","ukrainian","kyiv","kiev","russia","russian","britain","british","england","united kingdom","boe","bank of england","europe","european","eurozone","euro area","ecb","germany","france","spain","spanish","italy","cyprus","greece","poland","netherlands","belgium","switzerland","norway","sweden","finland","denmark","portugal","austria","albania","serbia","romania","hungary","czech","slovakia"]),
  ("ASIA",["china","chinese","taiwan","japan","japanese","boj","yen","south korea","korea","india","pakistan","bangladesh","indonesia","philippines","vietnam","thailand","malaysia","singapore","hong kong","west asia"]),
  ("AMERICAS",["united states","u.s.","usa","american","federal reserve","fed ","fed,","fed's","fomc","wall street","new york","canada","mexico","brazil","venezuela","argentina","chile","colombia","peru","puerto rico","alaska"]),
  ("AFRICA",["africa","african","south africa","nigeria","kenya","ethiopia","somalia","egypt","libya","sudan","morocco","algeria","tunisia","ghana","tanzania","uganda","congo"]),
  ("OCEANIA",["australia","new zealand","fiji","papua new guinea"])
 ]
 for region,terms in rules:
  if any(term in t for term in terms): return region
 return "GLOBAL"

events=[]
for cat,q in QUERIES:
 url="https://news.google.com/rss/search?q="+urllib.parse.quote(q)+"&hl=en-US&gl=US&ceid=US:en"
 try:root=ET.fromstring(get(url))
 except Exception as e:print("WARN",cat,q,e);continue
 for item in root.findall(".//item")[:18]:
  raw=(item.findtext("title") or "").strip()
  link=(item.findtext("link") or "").strip();pub=item.findtext("pubDate") or ""
  source=item.find("source");src=(source.text.strip() if source is not None and source.text else "Google News")
  clean=re.sub(r"\s+-\s+[^-]+$","",raw).strip()
  if not clean:continue
  # merge same/near-same story and preserve multiple sources
  existing=next((e for e in events if e["category"]==cat and near_duplicate(e["title"],clean)),None)
  if existing:
   if src not in existing["sources"]: existing["sources"].append(src)
   existing["sourceCount"]=len(existing["sources"])
   existing["severity"]=max(existing["severity"],severity(clean,cat))
   continue
  lat,lon=loc(clean)
  try:dt=parsedate_to_datetime(pub).astimezone(timezone.utc).isoformat().replace("+00:00","Z")
  except:dt=datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
  events.append({
   "id":hashlib.sha1((cat+clean).encode()).hexdigest()[:12],"category":cat,"type":cat,"title":clean,
   "source":src,"sources":[src],"sourceCount":1,"url":link,"time":dt,"severity":severity(clean,cat),
   "lat":lat,"lon":lon,"region":classify_region(clean,src),"description":"Public news signal aggregated from current RSS sources."
  })

# Keep category balance so natural events never drown out market intelligence.
balanced=[]
for cat in ("geopolitics","energy","macro"):
 balanced += sorted([e for e in events if e["category"]==cat],key=lambda x:(x["severity"],x["time"]),reverse=True)[:30]
events=sorted(balanced,key=lambda x:(x["severity"],x["time"]),reverse=True)[:80]
Path("data").mkdir(exist_ok=True)
Path("data/intel.json").write_text(json.dumps({
 "updatedAt":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
 "counts":{c:sum(1 for e in events if e["category"]==c) for c in ("geopolitics","energy","macro")},
 "events":events
},ensure_ascii=False,indent=2),encoding="utf-8")
print("intel",len(events),{c:sum(1 for e in events if e["category"]==c) for c in ("geopolitics","energy","macro")})
