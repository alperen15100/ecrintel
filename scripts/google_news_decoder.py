# Adapted from SSujitX/google-news-url-decoder (MIT License).
# Copyright (c) 2024 Sujit Biswas. See THIRD_PARTY_NOTICES.md.

import base64
import urllib.parse
import urllib.request

_BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je"


def _extract_id(source_url):
    try:
        p = urllib.parse.urlsplit(source_url)
        parts = [x for x in p.path.split("/") if x]
        if p.hostname == "news.google.com" and len(parts) >= 2 and parts[-2] in ("articles", "read"):
            return parts[-1]
    except Exception:
        pass
    return ""


def _local_decode(encoded_id):
    try:
        raw = base64.urlsafe_b64decode(encoded_id + "==").decode("latin1")
        prefix = b"\x08\x13\x22".decode("latin1")
        suffix = b"\xd2\x01\x00".decode("latin1")
        if raw.startswith(prefix):raw = raw[len(prefix):]
        if raw.endswith(suffix):raw = raw[:-len(suffix)]
        arr = bytearray(raw, "latin1")
        if not arr:return ""
        length = arr[0]
        return raw[2:length + 1] if length >= 0x80 else raw[1:length + 1]
    except Exception:
        return ""


def _batch_decode(ids, timeout=15):
    if not ids:return []
    envelopes=[]
    for i,encoded_id in enumerate(ids,start=1):
        envelopes.append(
            f'["Fbv4je","[\\"garturlreq\\",[[\\"en-US\\",\\"US\\",[\\"FINANCE_TOP_INDICES\\",\\"WEB_TEST_1_0_0\\"],'
            f'null,null,1,1,\\"US:en\\",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],'
            f'\\"en-US\\",\\"US\\",1,[2,3,4,8],1,0,\\"655000234\\",0,0,null,0],\\"{encoded_id}\\"]",null,"{i}"]'
        )
    payload='[['+','.join(envelopes)+']]'
    data=urllib.parse.urlencode({"f.req":payload}).encode()
    req=urllib.request.Request(_BATCH_URL,data=data,headers={"Content-Type":"application/x-www-form-urlencoded;charset=utf-8","Referer":"https://news.google.com/","User-Agent":"Mozilla/5.0 (compatible; ECRINTEL/2.4)"},method="POST")
    with urllib.request.urlopen(req,timeout=timeout) as r:text=r.read().decode("utf-8","ignore")
    header='[\\"garturlres\\",\\"';footer='\\",'
    urls=[]
    rest=text
    while header in rest:
        rest=rest.split(header,1)[1]
        if footer not in rest:break
        u,rest=rest.split(footer,1)
        u=u.replace('\\u003d','=').replace('\\u0026','&').replace('\\/','/')
        urls.append(u)
    if not urls:print('DECODE FORMAT WARN',text[:500].replace('\n',' '))
    return urls


def decode_google_news_urls(source_urls):
    """Return one publisher URL (or original URL) for every input URL."""
    results=list(source_urls);batch_ids=[];batch_positions=[]
    for i,source_url in enumerate(source_urls):
        encoded_id=_extract_id(source_url)
        if not encoded_id:continue
        local=_local_decode(encoded_id)
        if local.startswith(("http://","https://")):results[i]=local
        elif local.startswith("AU_yqL"):
            batch_ids.append(encoded_id);batch_positions.append(i)
    if batch_ids:
        try:
            decoded=_batch_decode(batch_ids)
            for pos,publisher_url in zip(batch_positions,decoded):
                if publisher_url.startswith(("http://","https://")):results[pos]=publisher_url
        except Exception as e:print("DECODE WARN",e)
    return results
