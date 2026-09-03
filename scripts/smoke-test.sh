#!/bin/sh
# Smoke tests against a deployed Samvidhan instance.
# Usage: ./scripts/smoke-test.sh https://samvidhan.pages.dev
set -e
URL="${1:?Usage: ./scripts/smoke-test.sh <deployed-url>}"
PASS=true

check() {
  local description="$1" condition="$2"
  if eval "$condition"; then
    echo "  OK: $description"
  else
    echo "  FAIL: $description"
    PASS=false
  fi
}

echo "Smoke testing $URL"

# Home page
BODY=$(curl -sL "$URL/" --max-time 30)
check "home returns 200" '[ -n "$BODY" ]'
check "home contains site name" 'echo "$BODY" | grep -q "Samvidhan"'
check "home contains preamble opening" 'echo "$BODY" | grep -q "WE, THE PEOPLE OF INDIA"'

# Article 14
BODY=$(curl -sL "$URL/articles/14/" --max-time 30)
check "article 14 returns 200" '[ -n "$BODY" ]'
check "article 14 contains title" 'echo "$BODY" | grep -q "Equality before law"'
check "article 14 contains legal text" 'echo "$BODY" | grep -q "equality before the law or the equal protection"'
check "article 14 contains JSON-LD" 'echo "$BODY" | grep -q "application/ld+json"'
check "article 14 contains lede" 'echo "$BODY" | grep -q "article-lede"'

# Amendment 42
BODY=$(curl -sL "$URL/amendments/42/" --max-time 30)
check "amendment 42 returns 200" '[ -n "$BODY" ]'
check "amendment 42 contains year" 'echo "$BODY" | grep -q "1976"'

# Amendment 106 milestones
BODY=$(curl -sL "$URL/amendments/106/" --max-time 30)
check "amendment 106 contains in-force date" 'echo "$BODY" | grep -q "2026-04-16"'

# Sitemap
BODY=$(curl -sL "$URL/sitemap-index.xml" --max-time 30)
check "sitemap reachable" '[ -n "$BODY" ]'
check "sitemap contains article" 'echo "$BODY" | grep -q "sitemap-0.xml"'

# Sitemap detail
BODY=$(curl -sL "$URL/sitemap-0.xml" --max-time 30)
check "sitemap lists article 14" 'echo "$BODY" | grep -q "/articles/14/"'
check "sitemap lists amendment 106" 'echo "$BODY" | grep -q "/amendments/106/"'

# Robots
BODY=$(curl -sL "$URL/robots.txt" --max-time 30)
check "robots.txt reachable" '[ -n "$BODY" ]'
check "robots.txt allows crawlers" 'echo "$BODY" | grep -q "Allow: /"'
check "robots.txt references sitemap" 'echo "$BODY" | grep -q "Sitemap:"'

# llms.txt
BODY=$(curl -sL "$URL/llms.txt" --max-time 30)
check "llms.txt reachable" '[ -n "$BODY" ]'
check "llms.txt is markdown" 'echo "$BODY" | head -1 | grep -q "^# "'
check "llms.txt links articles" 'echo "$BODY" | grep -q "/articles/"'

# Bills tracker
BODY=$(curl -sL "$URL/changes/upcoming/" --max-time 30)
check "bills tracker returns 200" '[ -n "$BODY" ]'
check "bills tracker has verified banner" 'echo "$BODY" | grep -q "last verified"'

# Search assets
BODY=$(curl -sL -o /dev/null -w "%{http_code}" "$URL/search.js" --max-time 30)
check "search controller served" '[ "$BODY" = "200" ]'

BODY=$(curl -sL -o /dev/null -w "%{http_code}" "$URL/pagefind/pagefind.js" --max-time 30)
check "pagefind bundle served" '[ "$BODY" = "200" ]'

BODY=$(curl -sL -o /dev/null -w "%{http_code}" "$URL/concept.js" --max-time 30)
check "concept module served" '[ "$BODY" = "200" ]'

# 404 handling
BODY=$(curl -s -o /dev/null -w "%{http_code}" "$URL/this-page-does-not-exist" --max-time 30)
check "unknown path returns 404" '[ "$BODY" = "404" ]'

if [ "$PASS" = false ]; then
  echo "SMOKE TESTS FAILED"
  exit 1
fi
echo "All smoke tests passed"
