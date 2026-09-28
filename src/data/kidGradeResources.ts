export type KidMaterialKind = 'Vocabulary list' | 'Dictation worksheet';

export interface KidGradeMaterial {
  id: string;
  title: string;
  kind: KidMaterialKind;
  description: string;
  href: string;
  units?: number;
}

export interface KidGradeResource {
  grade: number;
  status: 'available' | 'planned';
  materials: KidGradeMaterial[];
}

function plannedGrade(grade: number): KidGradeResource {
  return { grade, status: 'planned', materials: [] };
}

const kid6Resources: KidGradeMaterial[] = [
  {
    id: 'kid-6-rfc2-word-review',
    title: 'Reading Future Connect 2 · Word Review',
    kind: 'Vocabulary list',
    description: 'Vocabulary study list with 16 learning units.',
    href: 'https://cmckhmer.github.io/Word-Review-RFConnect-2/',
    units: 16,
  },
  {
    id: 'kid-6-reading-future-connect-2-dictation',
    title: 'Reading Future Connect 2 · Dictation Worksheet',
    kind: 'Dictation worksheet',
    description: 'Interactive word-bank dictation worksheet, organized into 16 units.',
    href: 'https://cmckhmer.github.io/Reading-Future-Connect-2/',
    units: 16,
  },
];

const kid11Resources: KidGradeMaterial[] = [
  {
    id: 'kid-11-reading-future-create-3-dictation',
    title: 'Reading Future Create 3 · Dictation Worksheet',
    kind: 'Dictation worksheet',
    description: 'Interactive 16-unit dictation worksheet from the Reading Future Create 3 page.',
    href: 'https://cmckhmer.github.io/RFC3/',
    units: 16,
  },
];

const kidGradeResources = ([
  plannedGrade(5),
  { grade: 6, status: 'available', materials: kid6Resources },
  plannedGrade(7),
  plannedGrade(8),
  plannedGrade(9),
  plannedGrade(10),
  { grade: 11, status: 'available', materials: kid11Resources },
  plannedGrade(12),
].sort((a, b) => a.grade - b.grade)) as KidGradeResource[];

export const KID_GRADE_RESOURCES: KidGradeResource[] = kidGradeResources;