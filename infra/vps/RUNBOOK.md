# Fourcee template on https://ops.lutho.app/fourcee-template/

Static, **public** (no PIN, no Basic auth), served by nginx straight from a release directory on the VPS (187.124.209.31).
It uses the existing `ops.lutho.app` vhost and certificate: no new domain, DNS record or cert. `fourcee.lutho.app` is a separate, older vhost and is not used here.

| Piece | Where |
|---|---|
| nginx location (source of truth) | **lutho-ops** `infra/vps/nginx/sites-enabled/ops`, block "Fourcee template" (live file `/etc/nginx/sites-enabled/ops`) |
| Applying nginx | lutho-ops `infra/vps/apps/install-nginx.sh` (backs up `/etc/nginx`, `nginx -t`, reload, restores on failure) |
| Build | `VITE_BASE=/fourcee-template/ npm run build` (default build with no env is unchanged: base `/`) |
| Release deploy | this repo `infra/vps/deploy-ops-prefix.sh` (run on the VPS) |
| Files | `/var/www/fourcee-template/releases/<UTC ts>/fourcee-template/…`, `current` symlink → newest release |

The old preview at `https://ops.lutho.app/fourcee/` (`/var/www/fourcee-ops-preview`) is a different, longer prefix and is untouched (`/fourcee/` does not match `/fourcee-template/`).

## What the nginx block does (all scoped to `^~ /fourcee-template/`)
- `Content-Type`: glb `model/gltf-binary`, usdz `model/vnd.usdz+zip`, wasm `application/wasm`, `.task` `application/octet-stream`, js `text/javascript`, json `application/json`.
- Byte ranges (`206`) on every file; gzip for html/css/js/json/svg/wasm only (never glb/usdz/task, which are already compressed).
- Cache: content-hashed `assets/*-<hash>.js|css` immutable 1y; models/images 1h-1d; `index.html`, `content.json` `no-cache`; 404s are not cached.
- SPA fallback to `/fourcee-template/index.html` for paths **without** a file extension; anything with an extension that does not exist is a real 404.
- Headers: `Permissions-Policy: camera=(self), microphone=(), geolocation=(), xr-spatial-tracking=(self)`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a mild CSP (`object-src 'none'; base-uri 'self'; frame-ancestors 'self'; worker-src 'self' blob:`). The CSP is deliberately not a strict `script-src`: the template legitimately loads Google Fonts, the Cal.com embed and external webhooks.
- Not sent: HSTS (shared host), `Set-Cookie`, COOP/COEP (no SharedArrayBuffer). Methods other than GET/HEAD are refused. No proxying, so no Ops cookie or `Authorization` is forwarded to anything.
- Everything outside the prefix is unchanged, including the Ops PIN gate on `location /`.

Same-origin note: the page runs on the `ops.lutho.app` origin. The camera grant is per-origin, so a granted camera permission also covers other `ops.lutho.app` pages (the `Permissions-Policy` header is only sent from this prefix, so Ops pages do not get camera delegation to frames). First-party template JS can read non-HttpOnly cookies and call same-origin Ops APIs with the visitor's session. That is acceptable only because this is our own reviewed static code; do not host third-party or generated code under this prefix.

## Deploy a new build
On a build machine (repo checkout, `npm ci`):
```
VITE_BASE=/fourcee-template/ npm run build
tar czf fct.tgz --exclude='*.3dm' -C dist .
sha256sum fct.tgz
```
Copy `fct.tgz` and `deploy-ops-prefix.sh` to the VPS (scp/sftp), then on the VPS as root:
```
./deploy-ops-prefix.sh install /root/fct.tgz <sha256>
./deploy-ops-prefix.sh status
```
The script unpacks into a new release dir, refuses a build that is not built for `/fourcee-template/` or lacks the MediaPipe wasm / `hand_landmarker.task`, then switches `current` atomically (`ln` + `mv -T`). It keeps the last 5 releases. It never touches `/etc/nginx` and nothing here runs `/opt/deploy/deploy.sh`.

## First-time / nginx change (backed-up flow)
1. `cp -a /etc/nginx /root/backups/fourcee-<UTC ts>/nginx`  (install-nginx.sh also makes `/root/backups/apps-<ts>`).
2. From a lutho-ops checkout on the VPS: `infra/vps/apps/install-nginx.sh --check` (shows the diff) then `infra/vps/apps/install-nginx.sh`. It runs `nginx -t` and `systemctl reload nginx` (reload, never restart) and restores the old files if `nginx -t` fails.
3. Verify (below). Record the backup path.

## Verify
```
curl -sI https://ops.lutho.app/fourcee-template/                      # 200, no-cache, Permissions-Policy camera=(self)
curl -sI https://ops.lutho.app/fourcee-template/assets/ar/ring-platinum.glb    # model/gltf-binary
curl -sI https://ops.lutho.app/fourcee-template/assets/ar/ring-platinum.usdz   # model/vnd.usdz+zip
curl -sI https://ops.lutho.app/fourcee-template/mediapipe/wasm/vision_wasm_internal.wasm   # application/wasm
curl -sI https://ops.lutho.app/fourcee-template/ar/hand_landmarker.task        # application/octet-stream
curl -s -o /dev/null -w '%{http_code}\n' -H 'Range: bytes=0-99' https://ops.lutho.app/fourcee-template/assets/ar/ring-platinum.glb   # 206
curl -s -o /dev/null -w '%{http_code}\n' https://ops.lutho.app/                # unchanged (Ops auth)
```

## Rollback
- Bad release: `deploy-ops-prefix.sh rollback` (previous release) or `rollback <release-name>`. Instant, no nginx change.
- Take the prefix offline entirely: restore the nginx backup, then reload:
  `cp -a /root/backups/fourcee-<ts>/nginx/sites-enabled/ops /etc/nginx/sites-enabled/ops && nginx -t && systemctl reload nginx`
  (or revert the lutho-ops PR and run `install-nginx.sh`). `/var/www/fourcee-template` can stay; nothing links to it once the location is gone and the prefix falls through to the Ops PIN gate.
