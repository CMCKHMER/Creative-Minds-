export interface AssignmentQuestion {
  prompt: string;
  choices?: string[];
  responseLines?: number;
  answer: string;
  rationale?: string;
}

export interface AssignmentSection {
  title: string;
  directions: string;
  passage?: string[];
  audioScript?: string[];
  wordBank?: string;
  questions: AssignmentQuestion[];
}

export interface AssignmentRubricRow {
  criterion: string;
  points: number;
  description: string;
}

export interface ClassroomAssignment {
  resourceId: string;
  title: string;
  subtitle: string;
  subject: string;
  gradeBand: string;
  duration: string;
  skillFocus: string[];
  objectives: string[];
  materials: string[];
  teacherNotes: string[];
  sections: AssignmentSection[];
  rubric?: AssignmentRubricRow[];
}