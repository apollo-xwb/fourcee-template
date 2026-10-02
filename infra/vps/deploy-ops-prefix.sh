#!/usr/bin/env bash
# Publishes a Fourcee template build under https://ops.lutho.app/fourcee-template/ (static, public). Run as root ON THE VPS.
# It only manages /var/www/fourcee-template. It never touches /etc/nginx (see RUNBOOK.md) and never runs /opt/deploy/deploy.sh.
#
#   deploy-ops-prefix.sh install <dist.tgz> [sha256]   unpack a build made with VITE_BASE=/fourcee-template/ into a NEW release dir,
#                                                      check it, then switch the `current` symlink atomically. Old releases are kept (last 5).
#   deploy-ops-prefix.sh rollback [release-name]       point `current` at the previous (or the named) release, atomically.
#   deploy-ops-prefix.sh status                        show current + releases.
#
# Layout:  /var/www/fourcee-template/releases/<UTC ts>/fourcee-template/...   (nginx: root /var/www/fourcee-template/current + $uri)
#          /var/www/fourcee-template/current -> releases/<UTC ts>
set -euo pipefail
BASE=/var/www/fourcee-template
REL="$BASE/releases"
KEEP=5
die() { echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run as root"
mkdir -p "$REL"

switch() {  # atomic: build the new link beside `current`, then rename over it
  local target="$1"
  ln -sfn "$target" "$BASE/.current.new" && mv -T "$BASE/.current.new" "$BASE/current"
}
cur() { readlink "$BASE/current" 2>/dev/null | sed 's#.*/##' || true; }

case "${1:-}" in
  install)
    TGZ="${2:-}"; WANT="${3:-}"
    [ -f "$TGZ" ] || die "usage: $0 install <dist.tgz> [sha256]"
    if [ -n "$WANT" ]; then echo "$WANT  $TGZ" | sha256sum -c - || die "checksum mismatch"; fi
    TS="$(date -u +%Y%m%dT%H%M%SZ)"; DEST="$REL/$TS"
    [ ! -e "$DEST" ] || die "release $TS exists"
    mkdir -p "$DEST/fourcee-template"
    tar -xzf "$TGZ" -C "$DEST/fourcee-template" --no-same-owner --no-same-permissions
    # a build for the wrong base path would 404 every asset: refuse it before it goes live
    f="$DEST/fourcee-template/index.html"
    [ -s "$f" ] || { rm -rf "$DEST"; die "no index.html in the archive"; }
    grep -q '/fourcee-template/assets/' "$f" || { rm -rf "$DEST"; die "index.html is not built with VITE_BASE=/fourcee-template/"; }
    [ -s "$DEST/fourcee-template/mediapipe/wasm/vision_wasm_internal.wasm" ] || { rm -rf "$DEST"; die "mediapipe wasm missing"; }
    [ -s "$DEST/fourcee-template/ar/hand_landmarker.task" ] || { rm -rf "$DEST"; die "hand_landmarker.task missing"; }
    find "$DEST" -name '*.3dm' -delete          # Rhino CAD source in public/: never needed in the browser
    chown -R root:root "$DEST"; chmod -R u=rwX,go=rX "$DEST"
    PREV="$(cur)"
    switch "releases/$TS"
    echo "$PREV" > "$BASE/.previous"
    echo "live: releases/$TS (previous: ${PREV:-none})"
    # prune: keep the newest $KEEP releases and always the previous one
    ls -1 "$REL" | sort | head -n -"$KEEP" | while read -r old; do
      [ "$old" = "$PREV" ] || [ "$old" = "$(cur)" ] || rm -rf "${REL:?}/$old"
    done
    ;;
  rollback)
    TO="${2:-$(cat "$BASE/.previous" 2>/dev/null || true)}"
    [ -n "$TO" ] && [ -d "$REL/$TO" ] || die "no such release '$TO' (see: $0 status)"
    NOW="$(cur)"; switch "releases/$TO"; echo "$NOW" > "$BASE/.previous"
    echo "rolled back: current -> releases/$TO (was $NOW)"
    ;;
  status)
    echo "current: $(cur)"; echo "previous: $(cat "$BASE/.previous" 2>/dev/null || echo none)"; ls -1 "$REL"
    ;;
  *) die "usage: $0 install <dist.tgz> [sha256] | rollback [release] | status" ;;
esac
