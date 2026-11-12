// Pins for the student-name helpers — the "Gmail sign-ins show emails on
// the completion ticker" fix (owner report, Nov 2026). The helpers must:
// never treat an email as a name, always derive a friendly name from the
// local part, and never touch real typed names.
import { describe, expect, it } from 'vitest';
import { displayStudentName, friendlyNameFromEmail, looksLikeEmail, selfHealStoredStudentName } from './studentName';

describe('looksLikeEmail', () => {
  it('detects email-shaped values', () => {
    expect(looksLikeEmail('mam.ry@aii.edu.kh')).toBe(true);
    expect(looksLikeEmail('sophea2005@gmail.com')).toBe(true);
    expect(looksLikeEmail('  dara@mail.example.com  ')).toBe(true);
  });

  it('never flags real names, guests or partial strings', () => {
    expect(looksLikeEmail('Ry Sovanreach')).toBe(false);
    expect(looksLikeEmail('Guest')).toBe(false);
    expect(looksLikeEmail('Sophea K.')).toBe(false);
    expect(looksLikeEmail('dara@')); // no domain — not an email
    expect(looksLikeEmail('@home team')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
    expect(looksLikeEmail(null)).toBe(false);
  });
});

describe('friendlyNameFromEmail', () => {
  it('prettifies the observed failing account', () => {
    expect(friendlyNameFromEmail('mam.ry@aii.edu.kh')).toBe('Mam Ry');
  });

  it('handles common gmail shapes', () => {
    expect(friendlyNameFromEmail('sophea_chan05@gmail.com')).toBe('Sophea Chan05');
    expect(friendlyNameFromEmail('dara.v@gmail.com')).toBe('Dara V');
    expect(friendlyNameFromEmail('ritaa@gmail.com')).toBe('Ritaa');
    expect(friendlyNameFromEmail('first-last+tag@x.co')).toBe('First Last Tag');
  });

  it('keeps single-token locals and returns empty for garbage', () => {
    expect(friendlyNameFromEmail('123abc@x.co')).toBe('123abc');
    expect(friendlyNameFromEmail('....@x.co')).toBe('....'); // nothing usable — local kept
    expect(friendlyNameFromEmail('')).toBe('');
    expect(friendlyNameFromEmail('@x.co')).toBe('');
  });
});

describe('displayStudentName', () => {
  it('converts historical email-named rows to friendly names', () => {
    expect(displayStudentName('mam.ry@aii.edu.kh')).toBe('Mam Ry');
  });

  it('passes real names and honest labels through untouched', () => {
    expect(displayStudentName('Ry Sovanreach')).toBe('Ry Sovanreach');
    expect(displayStudentName('Guest')).toBe('Guest');
    expect(displayStudentName('Anonymous')).toBe('Anonymous');
    expect(displayStudentName('  Vattey Viphea ')).toBe('Vattey Viphea');
  });

  it('empty stays empty', () => {
    expect(displayStudentName('')).toBe('');
    expect(displayStudentName(null)).toBe('');
  });
});

describe('selfHealStoredStudentName', () => {
  const makeStorage = (initial: Record<string, string>) => {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    } as Storage;
  };

  it('replaces an email-as-name with the friendly form, keeping the email key', () => {
    const s = makeStorage({ 'cmc-student-name': 'mam.ry@aii.edu.kh', 'cmc-student-email': 'mam.ry@aii.edu.kh' });
    selfHealStoredStudentName(s);
    expect(s.getItem('cmc-student-name')).toBe('Mam Ry');
    expect(s.getItem('cmc-student-email')).toBe('mam.ry@aii.edu.kh');
  });

  it('is idempotent and never touches real names', () => {
    const s = makeStorage({ 'cmc-student-name': 'Ry Sovanreach' });
    selfHealStoredStudentName(s);
    selfHealStoredStudentName(s);
    expect(s.getItem('cmc-student-name')).toBe('Ry Sovanreach');
  });

  it('only rewrites true email-shaped values — malformed ones pass through', () => {
    const s = makeStorage({ 'cmc-student-name': '@x.co' });
    selfHealStoredStudentName(s);
    expect(s.getItem('cmc-student-name')).toBe('@x.co'); // not an email → untouched
  });

  it('survives a null storage', () => {
    expect(() => selfHealStoredStudentName(null)).not.toThrow();
  });
});
