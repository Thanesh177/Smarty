"""Bounded, key-free source retrieval. Retrieval is not independent fact checking."""
import hashlib
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

SOURCE_VERSION = 1
MAX_BYTES = 1024 * 1024
CURRENT_MAX_AGE = 7 * 86400
STOP = set("how why a an the of in on to for from with and or by is are can its one that this into as more through than what at about between uses use changes change became become works work history".split())
FEEDS = (
    ("NASA", "https://www.nasa.gov/feed/", {"www.nasa.gov", "science.nasa.gov"}),
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml", {"www.bbc.com", "www.bbc.co.uk", "bbc.com", "bbc.co.uk"}),
)
FETCH_HOSTS = {"en.wikipedia.org", "www.nasa.gov", "feeds.bbci.co.uk"}


def words(text):
    return {word for word in re.findall(r"[a-z]{3,}", str(text).lower()) if word not in STOP}


def plain(text, limit=3400):
    text = re.sub(r"<[^>]*>", " ", str(text or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()[:limit]


def safe_url(url, hosts):
    try:
        parsed = urllib.parse.urlsplit(str(url))
        return parsed.scheme == "https" and parsed.hostname in hosts and not parsed.username and not parsed.password and parsed.port in (None, 443)
    except ValueError:
        return False


class _TrustedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        if not safe_url(newurl, FETCH_HOSTS):
            raise ValueError("Untrusted source redirect")
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def download(url):
    if not safe_url(url, FETCH_HOSTS):
        raise ValueError("Untrusted source endpoint")
    request = urllib.request.Request(url, headers={"User-Agent": "SmartyLearning/1.0 (https://smarty.wiki)", "Accept": "application/json, application/rss+xml, application/xml"})
    with urllib.request.build_opener(_TrustedRedirect()).open(request, timeout=5) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Source response exceeded limit")
    return raw


def historical_sources(subject, now):
    # Use only retrieved pages. Never let the model invent a bibliography.
    terms = [word for word in re.findall(r"[A-Za-z]{3,}", subject) if word.lower() not in STOP]
    params = {"action": "query", "format": "json", "formatversion": "2", "generator": "search", "gsrsearch": " ".join(terms[:12]), "gsrnamespace": "0", "gsrlimit": "2", "prop": "extracts|info", "explaintext": "1", "exchars": "3400", "exlimit": "2", "inprop": "url"}
    data = json.loads(download("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    sources = []
    for page in data.get("query", {}).get("pages", []):
        title, excerpt = plain(page.get("title"), 180), plain(page.get("extract"))
        url = page.get("fullurl", "")
        if len(excerpt.split()) < 80 or len(words(subject) & words(title + " " + excerpt)) < 2 or not safe_url(url, {"en.wikipedia.org"}):
            continue
        sources.append({"id": "history-" + str(page["pageid"]), "label": title + " · Wikipedia", "url": url, "publisher": "Wikipedia", "kind": "reference", "excerpt": excerpt, "retrievedAt": int(now)})
    return sources[:2]


def recent_sources(subject, now):
    sources = []
    for publisher, endpoint, hosts in FEEDS:
        try:
            raw = download(endpoint)
            # ElementTree does not resolve external entities; reject DTDs anyway.
            if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
                continue
            root = ET.fromstring(raw)
            for item in root.findall("./channel/item")[:50]:
                title = plain(item.findtext("title"), 180)
                excerpt = plain(item.findtext("description"), 1500 if publisher == "NASA" else 750)
                url = item.findtext("link", "").strip()
                date = parsedate_to_datetime(item.findtext("pubDate", ""))
                if date.tzinfo is None:
                    continue
                published = int(date.timestamp())
                if not -300 <= now - published <= CURRENT_MAX_AGE or not safe_url(url, hosts):
                    continue
                if len(excerpt.split()) < 25 or len(words(subject) & words(title + " " + excerpt)) < 2:
                    continue
                sources.append({"id": "report-" + hashlib.sha256(url.encode()).hexdigest()[:16], "label": title + " · " + publisher, "url": url, "publisher": publisher, "kind": "report", "publishedAt": published, "retrievedAt": int(now), "excerpt": excerpt})
        except (OSError, ValueError, TypeError, ET.ParseError):
            # An unavailable provider cannot turn model memory into a news source.
            continue
    return sorted(sources, key=lambda item: item["publishedAt"], reverse=True)[:2]


def retrieve_sources(topic, subject, domain, angle, now):
    historical = domain == "History and civilization" or "history" in topic.lower()
    if historical:
        mode = "history"
        try:
            sources = historical_sources(subject, now)
        except (OSError, ValueError, TypeError, KeyError):
            sources = []
    elif angle == "current_connection":
        mode, sources = "current", recent_sources(subject, now)
    else:
        mode, sources = "concept", []
    return {"version": SOURCE_VERSION, "mode": mode, "asOf": datetime.fromtimestamp(now, timezone.utc).date().isoformat(), "sources": sources}


def evidence_context(pack):
    return json.dumps(pack or {"mode": "concept", "sources": []}, ensure_ascii=False, default=str)


def selected_sources(pack, ids):
    if not isinstance(ids, list) or not ids or len(ids) > 2 or any(not isinstance(value, str) for value in ids):
        return []
    available = {source["id"]: source for source in pack.get("sources", [])}
    if len(ids) != len(set(ids)) or any(value not in available for value in ids):
        return []
    return [available[value] for value in ids]


def claims_current(text):
    return bool(re.search(r"\b(today|yesterday|currently|latest|this (week|month|year)|ongoing|breaking news)\b", str(text), re.I))
