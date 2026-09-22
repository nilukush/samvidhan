/**
 * Guard for every outbound fetch this repository makes at build time or in
 * dev scripts (model download, bill snapshots, tessdata). Rules: http and
 * https only, and the destination may never be localhost, a loopback, a
 * private, or a reserved address. Throw before any request is sent.
 */
export function assertSafeFetchUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`not a valid URL: ${rawUrl}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`only http and https are allowed, got ${parsed.protocol}`);
  }
  if (isRefusedHost(parsed.hostname)) {
    throw new Error(`refused: ${parsed.hostname} is a localhost, loopback, private, or reserved destination`);
  }
}

function isRefusedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.includes(':')) return isRefusedIpv6(host);
  return isRefusedIpv4(host);
}

function isRefusedIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    if (value > 255) return false;
    octets.push(value);
  }
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10.0.0.0/8 private
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 shared (CGNAT)
    (a === 169 && b === 254) || // 169.254.0.0/16 link local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) // 192.168.0.0/16 private
  );
}

function isRefusedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === '::' || h === '::1') return true;
  if (h.startsWith('::ffff:')) {
    const tail = h.slice('::ffff:'.length);
    if (tail.includes('.')) return isRefusedIpv4(tail);
    const hextets = tail.split(':');
    if (hextets.length === 2 && hextets.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
      const hi = parseInt(hextets[0], 16);
      const lo = parseInt(hextets[1], 16);
      const octets = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255];
      return isRefusedIpv4(octets.join('.'));
    }
    return false;
  }
  const head = h.split(':', 1)[0];
  if (head === '') return false;
  if (!/^[0-9a-f]{1,4}$/.test(head)) return false;
  const value = parseInt(head, 16);
  // fe80::/10 link local, fc00::/7 unique local
  return (value >= 0xfe80 && value <= 0xfebf) || (value >= 0xfc00 && value <= 0xfdff);
}
