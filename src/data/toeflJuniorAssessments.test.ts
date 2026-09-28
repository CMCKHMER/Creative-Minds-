import { describe, expect, it } from 'vitest';
import { TOEFL_JUNIOR_ASSESSMENTS } from './toeflJuniorAssessments';
import { createAssignmentDocument } from '../utils/assignmentDocument';
import { assignmentAudioPrompt } from '../utils/assignmentAudio';

describe('TOEFL Junior-style assessment packs', () => {
  it.each(['Speaking', 'Listening', 'Writing'] as const)('provides five complete %s assessments', (skill) => {
    const assessments = TOEFL_JUNIOR_ASSESSMENTS.filter((item) => item.skill === skill);
    expect(assessments).toHaveLength(5);

    for (const assessment of assessments) {
      expect(assessment.assignment.sections.length).toBeGreaterThan(0);
      expect(assessment.assignment.sections.reduce((sum, section) => sum + section.questions.length, 0)).toBeGreaterThanOrEqual(3);
      expect(assessment.assignment.rubric).toBeDefined();
      expect(assessment.assignment.teacherNotes.length).toBeGreaterThan(0);
      for (const section of assessment.assignment.sections) {
        for (const question of section.questions) {
          expect(question.prompt.trim()).not.toBe('');
          expect(question.answer.trim()).not.toBe('');
        }
      }
    }
  });

  it.each(['Speaking', 'Listening'] as const)('provides playable device-voice prompt text for all %s packs', (skill) => {
    const assessments = TOEFL_JUNIOR_ASSESSMENTS.filter((item) => item.skill === skill);
    expect(assessments).toHaveLength(5);

    for (const assessment of assessments) {
      const prompts = assessment.assignment.sections.map((section) => assignmentAudioPrompt(assessment.assignment, section)).filter((prompt) => prompt !== null);
      expect(prompts.length).toBe(assessment.assignment.sections.length);
      expect(prompts.every((prompt) => prompt && prompt.text.trim().length > 30 && prompt.kind.toLowerCase() === skill.toLowerCase())).toBe(true);

      const studentCopy = createAssignmentDocument(assessment.assignment, 'student');
      const teacherKey = createAssignmentDocument(assessment.assignment, 'teacher');
      const playerCount = studentCopy.match(/class="audio-play"/g) ?? [];
      expect(playerCount).toHaveLength(assessment.assignment.sections.length);
      expect(studentCopy).toContain('speechSynthesis');
      expect(studentCopy).toContain('data-audio-prompt=');
      expect(teacherKey).not.toContain('class="audio-play"');
    }
  });

  it('keeps full listening transcripts visible only in the teacher key', () => {
    const listeningAssessments = TOEFL_JUNIOR_ASSESSMENTS.filter((item) => item.skill === 'Listening');
    for (const assessment of listeningAssessments) {
      const scripts = assessment.assignment.sections.flatMap((section) => section.audioScript ?? []);
      expect(scripts.length).toBeGreaterThan(0);
      const studentCopy = createAssignmentDocument(assessment.assignment, 'student');
      const teacherKey = createAssignmentDocument(assessment.assignment, 'teacher');
      const decodeHtml = (value: string) => value
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      for (const script of scripts) {
        expect(studentCopy).not.toContain(script);
        expect(decodeHtml(teacherKey)).toContain(script);
      }
    }
  });

  it('uses unique ids and titles across all assessment sets', () => {
    expect(new Set(TOEFL_JUNIOR_ASSESSMENTS.map((item) => item.id)).size).toBe(15);
    expect(new Set(TOEFL_JUNIOR_ASSESSMENTS.map((item) => item.title)).size).toBe(15);
  });
});