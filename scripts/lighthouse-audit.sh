#!/bin/sh
# Runs Lighthouse mobile audits on five representative pages against the
# preview server. Budgets per docs/DESIGN-SYSTEM.md section 12:
# performance 95, accessibility 100, best practices 100, SEO 100.
set -e
PORT=${1:-4321}
CHROME="$(node -e "console.log(require('playwright-core').chromium.executablePath())")"
PASS=true

for PAGE in / /articles/14/ /amendments/ /changes/upcoming/ /preamble/ /essentials/; do
  NAME=$(echo "$PAGE" | sed 's|/articles/||;s|/changes/||;s|/$||;s|^$|home|;s|/|_|g')
  npx lighthouse "http://127.0.0.1:$PORT$PAGE" \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path="/tmp/lh-$NAME.json" \
    --chrome-flags="--headless" --quiet 2>/dev/null || true

  if [ -f "/tmp/lh-$NAME.json" ]; then
    SCORES=$(node -e "
      const r = require('/tmp/lh-$NAME.json');
      const p = Math.round((r.categories.performance?.score ?? 0) * 100);
      const a = Math.round((r.categories.accessibility?.score ?? 0) * 100);
      const b = Math.round((r.categories['best-practices']?.score ?? 0) * 100);
      const s = Math.round((r.categories.seo?.score ?? 0) * 100);
      console.log(p + ' ' + a + ' ' + b + ' ' + s);
      if (p < 95 || a < 100 || b < 100 || s < 100) process.exit(1);
    ") || PASS=false
    echo "$PAGE: $SCORES"
  else
    echo "$PAGE: FAILED to run"
    PASS=false
  fi
done

if [ "$PASS" = false ]; then
  echo "Lighthouse budgets NOT met"
  exit 1
fi
echo "All Lighthouse budgets met"
