import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(resolve(root, ...parts), 'utf8');

const HOMEWORK_PAGES = [
  'public/rfc3/unit2hw.html',
  'public/rfc3/unit3hw.html',
  'public/rfc3/unit4hw.html',
  'public/rfc3/unit13hw.html',
  'public/rfc3/unit15hw.html',
  'public/rfc3/doctor-fish.html',
];

/**
 * "Check the Submit to Teacher function again — I'm not getting SOME
 * students' submitted scores." The pages' submit code was uniform and the
 * signed-in path matched the rules, but two holes lost real submissions:
 *  1. a failed RETRY toasted the SUCCESS text ("✓ Submitted! … sent to
 *     your teacher"), so students honestly reported having submitted;
 *  2. any failed send (dead Wi-Fi, expired token) evaporated with its
 *     toast — nothing was kept, nothing retried.
 * Every Kid 11 homework page now keeps a device outbox: failed sends are
 * stored, a visible note counts the unsent ones, and the outbox flushes
 * automatically on load and on reconnect. Only a server-confirmed send
 * may say ✓.
 */
describe('kid 11 homework submit — failed sends are kept and retried', () => {
  it.each(HOMEWORK_PAGES)('%s keeps an outbox and flushes it automatically', (file) => {
    const html = read(file);
    expect(html).toContain('cmcOutboxSave');
    expect(html).toContain('cmcFlushOutbox');
    expect(html).toContain('cmc-hw-outbox:');
    expect(html).toContain('cmcOutboxNote');
    expect(html).toContain("window.addEventListener('online', cmcFlushOutbox)");
    expect(html).toContain('NOT sent yet');
    // done() is the single funnel: success clears the outbox, failure saves to it.
    expect(html).toContain('if (ok) cmcOutboxDrop(name, mode); else cmcOutboxSave(name, mode, score);');
  });

  it.each(HOMEWORK_PAGES)('%s never toasts the success text for a failed retry', (file) => {
    const html = read(file);
    expect(html).not.toContain('done(r2.ok, okMsg)');
    expect(html).not.toContain('done(r3.ok, okMsg)');
    expect(html).not.toContain("done(false, 'Could not submit");
    expect(html).not.toContain("done(false, 'Could not reach");
    expect(html).toContain('done(r2.ok, r2.ok ? okMsg : failMsg)');
    expect(html).toContain('done(r3.ok, r3.ok ? okMsg : failMsg)');
    expect(html).toContain("var failMsg = '⚠ Not sent yet — saved on this device.");
  });

  it('the teacher sheet explains the device outbox to the teacher', () => {
    const sheet = read('src/components/KidHomeworkScores.tsx');
    expect(sheet).toContain('keeps it on the student’s device');
    expect(sheet).toContain('NOT sent yet');
  });
});
