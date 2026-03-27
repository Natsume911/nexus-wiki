#!/usr/bin/env python3
"""
Confluence → Nexus daily sync checker.
Downloads attachments from pages modified today on Confluence and uploads to Nexus.
Generates a report of what changed.

Run: python3 /opt/nexus/scripts/confluence-sync.py
"""

import requests
import json
import time
import os
import sys
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────

EXTERNAL_ENV = '/opt/external-platform/.env.runtime'
NEXUS_API = 'http://localhost:4000/api'
NEXUS_EMAIL = 'admin@example.com'
CONFLUENCE_SPACE = 'YOUR_SPACE'
LOG_FILE = '/opt/nexus/logs/confluence-sync.log'
UPLOAD_THROTTLE = 2  # seconds between uploads to avoid rate limit

# ── Load credentials ──────────────────────────────────────────────

def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    return env

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f'[{ts}] {msg}'
    print(line)
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

# ── Main ──────────────────────────────────────────────────────────

def main():
    log('=== Confluence → Nexus sync started ===')

    # Load External platform credentials
    try:
        env = load_env(EXTERNAL_ENV)
    except FileNotFoundError:
        log(f'ERROR: {EXTERNAL_ENV} not found')
        sys.exit(1)

    email = env.get('CONFLUENCE_EMAIL', '')
    token = env.get('CONFLUENCE_API_TOKEN', '')
    if not email or not token:
        log('ERROR: CONFLUENCE_EMAIL or CONFLUENCE_API_TOKEN not set')
        sys.exit(1)

    # Setup sessions
    conf = requests.Session()
    conf.auth = (email, token)
    conf.headers['Accept'] = 'application/json'

    nexus = requests.Session()
    nexus.headers['X-Auth-Request-Email'] = NEXUS_EMAIL

    # Test Confluence connection
    r = conf.get(f'https://your-confluence.atlassian.net/wiki/rest/api/space/{CONFLUENCE_SPACE}')
    if r.status_code != 200:
        log(f'ERROR: Cannot connect to Confluence: {r.status_code}')
        sys.exit(1)
    log('Connected to Confluence')

    # Get pages modified today
    r = conf.get('https://your-confluence.atlassian.net/wiki/rest/api/content/search', params={
        'cql': f'space={CONFLUENCE_SPACE} AND type=page AND lastModified >= now("-1d") ORDER BY lastModified DESC',
        'expand': 'version',
        'limit': 50,
    })
    pages = r.json().get('results', [])
    log(f'Pages modified today: {len(pages)}')

    if not pages:
        log('Nothing to sync. Done.')
        return

    report = []

    for p in pages:
        title = p['title']
        pid = p['id']
        ver = p['version']['number']
        who = p['version']['by']['displayName']
        when = p['version']['when'][:16]

        log(f'\nProcessing: {title} (v{ver} by {who} at {when})')

        # Find matching page in Nexus
        sr = nexus.get(f'{NEXUS_API}/search/pages', params={'q': title})
        if sr.status_code != 200:
            log(f'  Nexus search failed: {sr.status_code}')
            report.append({'title': title, 'status': 'SEARCH_FAILED', 'who': who, 'when': when})
            continue

        nexus_pages = sr.json().get('data', [])
        match = next((np for np in nexus_pages if np['title'].lower() == title.lower()), None)

        if not match:
            log(f'  NOT FOUND in Nexus — new page on Confluence')
            report.append({'title': title, 'status': 'NEW_ON_CONFLUENCE', 'who': who, 'when': when})
            continue

        nid = match['id']
        space_slug = match['space']['slug']

        # Get Confluence attachments
        ar = conf.get(f'https://your-confluence.atlassian.net/wiki/rest/api/content/{pid}/child/attachment', params={'limit': 50})
        atts = ar.json().get('results', [])

        # Upload attachments to Nexus (with throttle + retry)
        uploaded = 0
        for a in atts:
            dl_url = f'https://your-confluence.atlassian.net/wiki/rest/api/content/{pid}/child/attachment/{a["id"]}/download'
            try:
                img_r = conf.get(dl_url, timeout=30)
            except Exception:
                continue
            if img_r.status_code != 200:
                continue

            mt = a.get('extensions', {}).get('mediaType', 'image/png')
            for attempt in range(3):
                try:
                    ur = nexus.post(
                        f'{NEXUS_API}/spaces/{space_slug}/attachments',
                        files={'file': (a['title'], img_r.content, mt)},
                        data={'pageId': nid},
                        timeout=30,
                    )
                    if ur.status_code in (200, 201):
                        uploaded += 1
                        break
                    elif ur.status_code == 429:
                        log(f'  Rate limited, waiting 60s...')
                        time.sleep(60)
                    else:
                        break
                except Exception as e:
                    log(f'  Upload retry {attempt+1} failed: {e}')
                    time.sleep(5)

            time.sleep(UPLOAD_THROTTLE)

        # Get Confluence body for size comparison
        cr = conf.get(f'https://your-confluence.atlassian.net/wiki/rest/api/content/{pid}', params={'expand': 'body.storage'})
        conf_body_len = len(cr.json().get('body', {}).get('storage', {}).get('value', ''))

        log(f'  Synced: {uploaded}/{len(atts)} attachments, Confluence body: {conf_body_len} chars')
        report.append({
            'title': title,
            'status': 'SYNCED',
            'who': who,
            'when': when,
            'attachments_uploaded': uploaded,
            'attachments_total': len(atts),
            'confluence_body_chars': conf_body_len,
        })

    # Print report
    log('\n=== SYNC REPORT ===')
    for r in report:
        if r['status'] == 'NEW_ON_CONFLUENCE':
            log(f'  🆕 {r["title"]} — NUOVA su Confluence (by {r["who"]})')
        elif r['status'] == 'SYNCED':
            log(f'  ✅ {r["title"]} — {r["attachments_uploaded"]}/{r["attachments_total"]} img synced (by {r["who"]})')
        else:
            log(f'  ❌ {r["title"]} — {r["status"]}')

    log(f'\nTotal: {len(report)} pages processed')
    log('=== Sync complete ===')

if __name__ == '__main__':
    main()
