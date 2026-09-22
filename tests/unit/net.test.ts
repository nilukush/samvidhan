import { describe, expect, it } from 'vitest';
import { assertSafeFetchUrl } from '../../src/lib/net.ts';

describe('assertSafeFetchUrl', () => {
  it('accepts an https URL on a public host', () => {
    expect(() =>
      assertSafeFetchUrl('https://github.com/tesseract-ocr/tessdata_best/raw/main/hin.traineddata'),
    ).not.toThrow();
  });

  it('accepts an http URL on a public host', () => {
    expect(() => assertSafeFetchUrl('http://example.com/file.bin')).not.toThrow();
  });

  it('accepts a public IPv4 literal', () => {
    expect(() => assertSafeFetchUrl('https://8.8.8.8/file')).not.toThrow();
  });

  it('accepts a public IPv6 literal', () => {
    expect(() => assertSafeFetchUrl('https://[2606:4700::6810:85e5]/file')).not.toThrow();
  });

  it('accepts the address just above the 172.16/12 private range', () => {
    expect(() => assertSafeFetchUrl('https://172.32.0.1/file')).not.toThrow();
  });

  it('rejects a string that is not a URL', () => {
    expect(() => assertSafeFetchUrl('not a url')).toThrow();
  });

  it('rejects schemes other than http and https', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com/f', 'data:text/plain,hi']) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/only http and https/);
    }
  });

  it('rejects localhost and its subdomains', () => {
    for (const url of ['http://localhost/x', 'https://api.localhost/x', 'https://localhost:8080/x']) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });

  it('rejects IPv4 loopback addresses', () => {
    for (const url of ['http://127.0.0.1/x', 'https://127.9.9.9/x', 'http://127.0.0.0/x']) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });

  it('rejects IPv4 private ranges', () => {
    for (const url of [
      'http://10.0.0.1/x',
      'http://10.255.255.255/x',
      'http://172.16.0.1/x',
      'http://172.31.255.255/x',
      'http://192.168.1.1/x',
    ]) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });

  it('rejects link local, shared, and unspecified IPv4 addresses', () => {
    for (const url of ['http://169.254.1.1/x', 'http://100.64.0.1/x', 'http://0.0.0.0/x']) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });

  it('rejects IPv6 loopback, link local, unique local, and unspecified addresses', () => {
    for (const url of [
      'http://[::1]/x',
      'http://[::]/x',
      'https://[fe80::1]/x',
      'https://[fd12::1]/x',
      'https://[fc00::1]/x',
    ]) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });

  it('rejects IPv4 mapped IPv6 loopback', () => {
    expect(() => assertSafeFetchUrl('https://[::ffff:127.0.0.1]/x')).toThrow(/refused/);
  });

  it('rejects non dotted quad loopback spellings the URL parser normalizes', () => {
    for (const url of ['http://2130706433/x', 'http://0x7f000001/x', 'http://127.1/x']) {
      expect(() => assertSafeFetchUrl(url)).toThrow(/refused/);
    }
  });
});
