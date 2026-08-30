import json, urllib.request, urllib.parse, time
from pathlib import Path
from datetime import datetime, timezone
ASSETS=[
 ('BTC','BTC-USD'),('ETH','ETH-USD'),('GOLD','GC=F'),('BRENT','BZ=F'),('WTI','CL=F'),
 ('S&P500','^GSPC'),('NASDAQ','^IXIC'),('DXY','DX-Y.NYB'),('EUR/USD','EURUSD=X'),
 ('NIKKEI','^N225'),('DAX','^GDAXI'),('FTSE','^FTSE'),('HANG SENG','^HSI')
]
def fetch(sym):
    url='https://query1.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(sym,safe='')+'?interval=1d&range=5d'
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=15) as r: j=json.load(r)
    x=j['chart']['result'][0]; m=x.get('meta',{})
    closes=x.get('indicators',{}).get('quote',[{}])[0].get('close') or []
    vals=[float(v) for v in closes if v is not None]
    p=m.get('regularMarketPrice') or (vals[-1] if vals else None)
    prev=m.get('chartPreviousClose') or m.get('previousClose') or (vals[-2] if len(vals)>1 else None)
    if p is None: raise ValueError('no price')
    p=float(p); ch=((p-float(prev))/float(prev)*100) if prev else None
    return p,ch
def fmt(s,p):
    if s in ('BTC','ETH','GOLD','BRENT','WTI'):
        return ('$'+f'{p:,.0f}') if p>=10000 else ('$'+f'{p:,.2f}')
    if s=='EUR/USD': return f'{p:.4f}'
    return f'{p:,.2f}'
out=[]
for s,y in ASSETS:
    z={'symbol':s,'priceDisplay':'—','change':None,'source':'Global feed'}
    try:
        p,ch=fetch(y); z.update(priceDisplay=fmt(s,p),change=round(ch,2) if ch is not None else None)
    except Exception as e: z['error']=str(e)[:100]
    out.append(z); time.sleep(.25)
Path('data/markets.json').write_text(json.dumps({'updatedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'markets':out},indent=2))
