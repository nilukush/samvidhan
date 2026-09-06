import { describe, expect, test } from 'vitest';
import { splitHindiClauses } from '../../src/lib/hindi/clauses';

describe('splitHindiClauses', () => {
  test('clause enumerations at sentence boundaries split', () => {
    const clauses = splitHindiClauses(
      'राज्य किसी नागरिक को केवल धर्म के आधार पर भेद नहीं करेगा । (2) कोई नागरिक केवल धर्म के आधार पर अयोग्य नहीं होगा ।',
    );
    expect(clauses).toHaveLength(2);
    expect(clauses[0]).toMatchObject({ number: null });
    expect(clauses[1]).toMatchObject({ number: '2' });
  });

  test('mid-sentence clause references never split (खंड (1) के अधीन)', () => {
    const text = '(4) जहां खंड (1) के अधीन किसी राज्य को दिए गए किसी निदेश के पालन में खर्च हो गया ।';
    expect(splitHindiClauses(text)).toHaveLength(1);
  });

  test('Devanagari letter enumerations split at boundaries', () => {
    const clauses = splitHindiClauses(
      'भारत के राज्यक्षेत्र में,- (क) राज्यों के राज्यक्षेत्र; (ख) अनुसूची में संघ राज्यक्षेत्र; और (ग) ऐसे अन्य राज्यक्षेत्र ।',
    );
    expect(clauses.map((clause) => clause.number)).toEqual([null, 'क', 'ख', 'ग']);
  });

  test('letter-suffixed numbered clauses split (GST shape)', () => {
    const clauses = splitHindiClauses('प्रारंभिक बात । (1क) संघ द्वारा कर भी । (1ख) राज्य द्वारा कर ।');
    expect(clauses.map((clause) => clause.number)).toEqual([null, '1क', '1ख']);
  });

  test('explanations become their own kind', () => {
    const clauses = splitHindiClauses('मूल उपबंध । स्पष्टीकरण-इस अनुच्छेद में "विहित" से अभिप्रेत है-');
    expect(clauses[1]).toMatchObject({ kind: 'explanation' });
  });

  test('text without markers stays one clause', () => {
    expect(
      splitHindiClauses('राज्य, भारत के राज्यक्षेत्र में किसी व्यक्ति को विधि के समक्ष समता प्राप्त होगी ।'),
    ).toHaveLength(1);
  });

  test('real article 1 shape: opening words then bracketed clause (2)', () => {
    const clauses = splitHindiClauses(
      'भारत, अर्थात्‌ इंडिया, राज्यों का संघ होगा । [(2) राज्य और उनके राज्यक्षेत्र वे होंगे जो पहली अनुसूची में विनिर्दिष्ट हैं ।] (3) भारत के राज्यक्षेत्र में,-',
    );
    expect(clauses.map((clause) => clause.number)).toEqual([null, '2', '3']);
  });
});

describe('splitHindiClauses OCR noise', () => {
  test('empty-paren noise before the first numbered clause is stripped', () => {
    const clauses = splitHindiClauses('() (1) प्रत्येक वर्ष के संबंध में संसद् विवरण रखवाएगी । (2) अन्य बात ।');
    expect(clauses.map((clause) => clause.number)).toEqual(['1', '2']);
    expect(clauses[0]?.text).not.toContain('()');
  });
});
