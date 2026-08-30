import json,re,urllib.request
from datetime import datetime,timezone
from pathlib import Path
from zoneinfo import ZoneInfo

NOW=datetime.now(timezone.utc)
events=[]

def add(dt,title,region,source,importance="HIGH",url="",exact=True):
 if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
 dt=dt.astimezone(timezone.utc)
 if dt < NOW.replace(hour=0,minute=0,second=0,microsecond=0):return
 events.append({
  "datetime":dt.isoformat().replace("+00:00","Z"),
  "when":dt.strftime("%d %b · %H:%M UTC") if exact else dt.strftime("%d %b"),
  "title":title,"region":region,"source":source,"importance":importance,"url":url
 })

# 1) BLS official 2026 schedule snapshot.
# Source: https://www.bls.gov/schedule/2026/ (published BLS release calendar).
# GitHub-hosted runners currently receive HTTP 403 from bls.ics, so we use the
# dates/times already published by BLS instead of pretending the feed succeeded.
BLS_EVENTS=[
 ("2026-09-04T08:30:00","Employment Situation for August 2026"),
 ("2026-09-10T08:30:00","Producer Price Index for August 2026"),
 ("2026-09-11T08:30:00","Consumer Price Index for August 2026"),
 ("2026-09-29T10:00:00","Job Openings and Labor Turnover Survey for August 2026"),
 ("2026-10-02T08:30:00","Employment Situation for September 2026"),
 ("2026-10-14T08:30:00","Consumer Price Index for September 2026"),
 ("2026-10-15T08:30:00","Producer Price Index for September 2026"),
 ("2026-10-30T08:30:00","Employment Cost Index for Third Quarter 2026"),
 ("2026-11-03T10:00:00","Job Openings and Labor Turnover Survey for September 2026"),
 ("2026-11-06T08:30:00","Employment Situation for October 2026"),
 ("2026-11-10T08:30:00","Consumer Price Index for October 2026"),
 ("2026-11-13T08:30:00","Producer Price Index for October 2026"),
 ("2026-12-04T08:30:00","Employment Situation for November 2026")
]
et=ZoneInfo("America/New_York")
for ds,title in BLS_EVENTS:
 dt=datetime.strptime(ds,"%Y-%m-%dT%H:%M:%S").replace(tzinfo=et)
 add(dt,title,"US","BLS","HIGH","https://www.bls.gov/schedule/2026/",True)

# 2) Official central-bank policy dates. Where the source publishes a date but no guaranteed
# intraday release time, we show the real date without inventing an hour.
DATE_EVENTS=[
 # Federal Reserve FOMC 2026/27
 ("2026-09-16","FOMC monetary policy decision day","US","Federal Reserve","https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
 ("2026-10-28","FOMC monetary policy decision day","US","Federal Reserve","https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
 ("2026-12-09","FOMC monetary policy decision day","US","Federal Reserve","https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
 ("2027-01-27","FOMC monetary policy decision day","US","Federal Reserve","https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"),
 # ECB second/final meeting day + press conference
 ("2026-09-10","ECB monetary policy meeting · decision / press conference","EU","ECB","https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"),
 ("2026-10-29","ECB monetary policy meeting · decision / press conference","EU","ECB","https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"),
 ("2026-12-17","ECB monetary policy meeting · decision / press conference","EU","ECB","https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"),
 # Bank of England confirmed MPC dates
 ("2026-09-17","Bank of England MPC decision","UK","Bank of England","https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates"),
 ("2026-11-05","Bank of England MPC decision","UK","Bank of England","https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates"),
 ("2026-12-17","Bank of England MPC decision","UK","Bank of England","https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates"),
 # Bank of Japan final meeting day
 ("2026-09-18","Bank of Japan monetary policy meeting","JP","Bank of Japan","https://www.boj.or.jp/en/mopo/mpmsche_minu/"),
 ("2026-10-30","Bank of Japan monetary policy meeting","JP","Bank of Japan","https://www.boj.or.jp/en/mopo/mpmsche_minu/"),
 ("2026-12-18","Bank of Japan monetary policy meeting","JP","Bank of Japan","https://www.boj.or.jp/en/mopo/mpmsche_minu/")
]
for ds,title,region,source,url in DATE_EVENTS:
 dt=datetime.strptime(ds,"%Y-%m-%d").replace(tzinfo=timezone.utc)
 add(dt,title,region,source,"HIGH",url,False)

# De-dupe and nearest first
uniq={}
for e in events:uniq[(e["datetime"],e["title"])]=e
events=sorted(uniq.values(),key=lambda e:e["datetime"])[:24]
Path("data").mkdir(exist_ok=True)
Path("data/calendar.json").write_text(json.dumps({
 "updatedAt":NOW.isoformat().replace("+00:00","Z"),
 "sourceNote":"Official BLS schedule plus published central-bank meeting dates. Times appear only where sourced.",
 "events":events
},ensure_ascii=False,indent=2),encoding="utf-8")
print("calendar",len(events))
