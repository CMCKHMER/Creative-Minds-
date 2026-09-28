import type { AssignmentSection, ClassroomAssignment } from '../types/assignment';

export type AssignmentAudioKind = 'listening' | 'speaking';

export interface AssignmentAudioPrompt {
  kind: AssignmentAudioKind;
  text: string;
}

export function assignmentAudioPrompt(
  assignment: ClassroomAssignment,
  section: AssignmentSection,
): AssignmentAudioPrompt | null {
  const listeningScripts = section.audioScript?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (/listening/i.test(assignment.subject) && listeningScripts.length > 0) {
    return { kind: 'listening', text: listeningScripts.join(' ') };
  }

  if (!/speaking/i.test(assignment.subject)) return null;

  const studentText = [
    section.title,
    section.directions,
    ...(section.audioScript ?? []),
    ...(section.passage ?? []),
    ...section.questions.map((question) => question.prompt),
  ].map((part) => part.trim()).filter(Boolean);

  return studentText.length > 0 ? { kind: 'speaking', text: studentText.join('. ') } : null;
}