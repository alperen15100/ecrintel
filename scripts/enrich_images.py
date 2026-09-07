import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path("data/intel.json")
CATEGORY_QUERIES = {
    "geopolitics": "Iran Israel Ukraine Russia Taiwan Hormuz Red Sea sanctions tariffs",
    "energy": "oil OPEC Brent WTI tanker pipeline refinery natural gas",
    "macro": "Federal Reserve ECB Bank of England Bank of Japan inflation CPI GDP payrolls tariffs",
}
STOP = {"the","and","for","with","from","that","this","into","over","after","before","amid","says","say","how","why","what","when","where","will","could","would","about","latest","live","news","update","updates","today","report","reports","analysis"}
UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36"


def get_text(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def normalize(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def tokens(s):
    return {x for x in normalize(s).split() if len(x) > 2 and x not in STOP}


def score(a, b):
    A, B = tokens(a), tokens(b)
    if not A or not B:
        return 0.0
    shared = len(A & B)
    if shared < 3:
        return 0.0
    coverage = shared / max(1, min(len(A), len(B)))
    jacc = shared / max(1, len(A | B))
    return coverage * 0.75 + jacc * 0.25


def clean_text(fragment):
    fragment = re.sub(r"<script\b[^>]*>.*?</script>", " ", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<style\b[^>]*>.*?</style>", " ", fragment, flags=re.I | re.S)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(fragment)).strip()


def image_key(url):
    try:
        p = urllib.parse.urlsplit(url)
        return (p.hostname or "") + (p.path or "")
    except Exception:
        return url


def google_cards(query):
    url = "https://news.google.com/search?" + urllib.parse.urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    text = get_text(url)
    cards = []
    # Google News renders story cards as article blocks. We only use the visible story text + its thumbnail.
    for block in re.findall(r"<article\b.*?</article>", text, flags=re.I | re.S):
        imgs = re.findall(r"<img\b[^>]+(?:src|data-src)=[\"']([^\"']+)[\"']", block, flags=re.I)
        if not imgs:
            continue
        title = clean_text(block)
        if len(title) < 12:
            continue
        chosen = ""
        for raw in imgs:
            u = html.unescape(raw)
            if u.startswith("//"):
                u = "https:" + u
            if u.startswith("https://") and "googleusercontent.com" in u:
                chosen = u
                break
        if chosen:
            cards.append((title, chosen))
    # Fallback for layout changes: pair image tags with nearby text windows.
    if len(cards) < 5:
        for m in re.finditer(r"<img\b[^>]+(?:src|data-src)=[\"'](https://[^\"']*googleusercontent\.com[^\"']*)[\"'][^>]*>", text, flags=re.I):
            start = max(0, m.start() - 2200)
            end = min(len(text), m.end() + 2200)
            title = clean_text(text[start:end])
            if len(title) >= 12:
                cards.append((title, html.unescape(m.group(1))))
    dedup = []
    seen = set()
    for title, image in cards:
        k = image_key(image)
        if not k or k in seen:
            continue
        seen.add(k)
        dedup.append((title, image))
    print("GOOGLE_CARDS", query[:18], len(dedup))
    return dedup


def best_image(title, cards):
    best = (0.0, "")
    for card_title, image in cards:
        s = score(title, card_title)
        if s > best[0]:
            best = (s, image)
    return best


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    events = data.get("events", [])
    pools = {}
    for cat, q in CATEGORY_QUERIES.items():
        try:
            pools[cat] = google_cards(q)
        except Exception as e:
            print("GOOGLE_IMAGE_WARN", cat, e)
            pools[cat] = []

    used = {}
    matched = 0
    for e in events:
        # Keep an already-good distinct image if the primary generator supplied one.
        existing = (e.get("image") or "").strip()
        if existing and "J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc" not in existing:
            used[image_key(existing)] = used.get(image_key(existing), 0) + 1
            continue
        s, image = best_image(e.get("title", ""), pools.get(e.get("category"), []))
        # Strong title overlap only. This prevents attaching a random picture to a story.
        if image and s >= 0.58:
            k = image_key(image)
            if used.get(k, 0) < 2:
                e["image"] = image
                e["imageMatchConfidence"] = round(s, 3)
                used[k] = used.get(k, 0) + 1
                matched += 1
            else:
                e["image"] = ""
        else:
            e["image"] = ""

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    images = [e.get("image") for e in events if e.get("image")]
    unique = len({image_key(x) for x in images})
    print("IMAGE_ENRICH", "events", len(events), "matched", matched, "images", len(images), "unique", unique)


if __name__ == "__main__":
    main()
