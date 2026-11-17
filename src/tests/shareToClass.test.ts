import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(resolve(root, ...parts), 'utf8');
const gamesPage = read('src/components/LearningGamesPage.tsx');

/**
 * "Share to class doesn't respond when I push it" — the old buttons called
 * navigator.share() first and swallowed the rejection (.catch(() => {})).
 * In iframes, preview frames and blocked webviews the native sheet is
 * denied, the promise rejects, and NOTHING visibly happens. These tests pin
 * the fix: every press opens an on-page share sheet, and the native sheet is
 * only ever one option inside it (with an AbortError-aware fallback).
 */
describe('share to class — always responds', () => {
  it('Learning Games cards open the share dialog instead of firing navigator.share blindly', () => {
    expect(gamesPage).toContain('ShareDialog');
    expect(gamesPage).toContain('setShareTarget(shareTargetForGame(game))');
    expect(gamesPage).toContain('Share to class');
    expect(gamesPage).not.toContain('void shareGame');
    expect(gamesPage).not.toContain('navigator.share({ title: game.title');
    for (const option of ['Copy link', 'Google Classroom', 'WhatsApp', 'Telegram', 'Email']) {
      expect(gamesPage, option).toContain(option);
    }
    expect(gamesPage).toContain('https://classroom.google.com/share?url=');
    // A blocked native sheet explains itself and keeps the dialog open.
    expect(gamesPage).toContain('Share sheet unavailable here');
    expect(gamesPage).toContain("name !== 'AbortError'");
    // Copy has a non-clipboard fallback for permission-denied frames.
    expect(gamesPage).toContain("document.execCommand('copy')");
  });

  it.each([
    'public/voice-quest.html',
    'public/word-forge.html',
    'public/writequest.html',
    'public/syntax-clash-pro.html',
  ])('%s FAB toggles its panel on every press', (file) => {
    const html = read(file);
    expect(html).toContain("fab.addEventListener('click',function(){panel.classList.toggle('open');});");
    expect(html).not.toContain('if(navigator.share){navigator.share({title:T,text:TXT,url:U}).catch(function(){});return;}');
    for (const hook of ['data-c="copy"', 'data-c="wa"', 'data-c="tg"', 'data-c="em"', 'data-c="native"', 'data-c="room"']) {
      expect(html, hook).toContain(hook);
    }
    expect(html).toContain('https://classroom.google.com/share?url=');
    expect(html).toContain('Share sheet unavailable');
  });

  it.each([
    'public/reason-lab.html',
    'public/cryo-lockdown.html',
    'public/dev-pick-ghost-mountain.html',
  ])('%s share button toggles its panel and offers Google Classroom', (file) => {
    const html = read(file);
    expect(html).toContain('data-cmc-share');
    expect(html).toContain("classList.toggle('show')");
    expect(html).toContain('data-cmc-classroom');
    expect(html).toContain('https://classroom.google.com/share?url=');
    for (const hook of ['data-cmc-copy', 'data-cmc-wa', 'data-cmc-tg', 'data-cmc-email', 'data-cmc-close']) {
      expect(html, hook).toContain(hook);
    }
  });

  it('worksheet share opens its fallback panel when the native sheet is blocked', () => {
    for (const file of [
      'public/rfc1/dictation.html', 'public/rfc1/unit-test.html', 'public/rfc1/unscramble.html', 'public/rfc1/word-list.html',
      'public/rfc2/rfc2dic.html', 'public/rfc2/rfc2un.html', 'public/rfc2/rfc2unittest.html', 'public/rfc2/rfc2unitwords.html',
      'public/rfc3/dictation.html', 'public/rfc3/review-tests.html', 'public/rfc3/unscramble.html',
    ]) {
      const html = read(file);
      expect(html, file).toContain("e.name!=='AbortError'");
      expect(html, file).toContain("getElementById('sharePanel').classList.add('open')");
      expect(html, file).not.toContain('.catch(()=>{});return;}');
    }
  });

  it('homework share opens its fallback panel when the native sheet is blocked', () => {
    for (const file of [
      'public/rfc3/doctor-fish.html', 'public/rfc3/unit13hw.html', 'public/rfc3/unit15hw.html',
      'public/rfc3/unit2hw.html', 'public/rfc3/unit3hw.html', 'public/rfc3/unit4hw.html',
    ]) {
      const html = read(file);
      const block = /function cmcNativeShare\(\) \{[\s\S]*?\n[ ]{2}\}/.exec(html)?.[0] ?? '';
      expect(block, file).toContain('cmcToggleShare(true)');
      expect(block, file).toContain("e.name !== 'AbortError'");
      expect(block, file).not.toContain('.catch(function () {});');
    }
  });
});
