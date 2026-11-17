import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KID_GRADE_RESOURCES } from '../data/kidGradeResources';

const root = process.cwd();
const hub = readFileSync(resolve(root, 'src/components/KidGradeHub.tsx'), 'utf8');
const quiz = readFileSync(resolve(root, 'public/rfc3/unit12-13-quiz.html'), 'utf8');

/**
 * "As admin, the share button for the quiz won't allow me to share it, but
 * will allow me to [open] it." The Kid 11 Units 12–13 Secure Quiz is kind
 * 'Review test', but KidGradeHub only polled share docs for kind
 * 'Online homework' — so the quiz's status stayed 'pending' forever, its
 * Share button rendered permanently disabled, and the toggle early-returned.
 * The teacher could still open the quiz through the teacher bypass
 * (sOpen || isTeacher), which is exactly the reported split behaviour.
 */
describe('Kid 11 secure quiz — share switch actually fires', () => {
  it('the quiz material carries the share gate that broke', () => {
    const quizMaterial = KID_GRADE_RESOURCES.flatMap((g) => g.materials)
      .find((m) => m.id === 'kid-11-secure-quiz-u12-13');
    expect(quizMaterial).toBeDefined();
    expect(quizMaterial?.kind).toBe('Review test');
    expect(quizMaterial?.shareDoc).toBe('hw-kid11-u12-13-quiz');
    expect(quizMaterial?.hideUntilShared).toBe(true);
  });

  it('the hub polls EVERY shareDoc, not only Online homework ones', () => {
    expect(hub).not.toContain("material.kind === 'Online homework' && material.shareDoc");
    expect(hub).toContain('.filter((material) => material.shareDoc)');
    // The polled set derived from the real registry must include the quiz.
    const polled = KID_GRADE_RESOURCES.flatMap((g) => g.materials)
      .filter((m) => m.shareDoc)
      .map((m) => m.shareDoc as string);
    expect(polled).toContain('hw-kid11-u12-13-quiz');
    expect(new Set(polled).size).toBe(19); // 18 homeworks + the secure quiz
  });

  it('the toggle writes the exact field the quiz page reads', () => {
    expect(hub).toContain('shared: { booleanValue: nextOpen }');
    expect(hub).toContain('method: \'PATCH\'');
    expect(hub).toContain('biweekly_tests/${docId}');
    expect(quiz).toContain('v.booleanValue===true');
    expect(quiz).toContain('hw-kid11-u12-13-quiz');
  });

  it('the teacher bypass that masked the bug is still intact', () => {
    // Teachers open the quiz even while it is unshared; students never see
    // the row until it is shared. Both behaviours must survive the fix.
    expect(hub).toContain('sOpen || isTeacher');
    expect(hub).toContain('material.hideUntilShared && !isTeacher && !sOpen');
  });
});
