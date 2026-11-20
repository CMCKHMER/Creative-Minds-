/*
 * Interactive reader workbooks for Kid 1–11 (Young Learners Classic Readers).
 *
 * Each entry mirrors the PDF workbook in public/library/books/ across
 * seven tabs: Story Focus, Vocabulary Preview, Comprehension (Beginning,
 * Middle, End), Think & Write + Vocabulary Review, and Summary + Book Report.
 *
 * Objective items are auto-graded client-side by src/lib/readerWorkbook.ts and
 * submitted to Firestore `drill_attempts` (drillSource 'rfc3') so teachers see
 * class score sheets and students can check their own score. Open reflections
 * and the Book Report are saved locally on the student's device and printable.
 */

import { GRADED_READER_WORKBOOKS } from './readerWorkbooksGraded';
import { GUIDE_READER_WORKBOOKS } from './readerWorkbooksGuides';
import { PHONICS_READER_WORKBOOKS } from './readerWorkbooksPhonics';
import { UPPER_READER_WORKBOOKS } from './readerWorkbooksUpper';

export interface BankFillItem {
  id: string;
  label?: string;
  prefix: string;
  suffix?: string;
  answer: string;
  hint?: string;
}

export interface MultiBlankSlot {
  id: string;
  answer: string;
}

export interface MultiBlankSentence {
  id: string;
  scene: string;
  parts: Array<string | MultiBlankSlot>;
}

export interface CauseEffectRow {
  id: string;
  cause: Array<string | MultiBlankSlot>;
  effect: Array<string | MultiBlankSlot>;
}

export interface BinaryChoiceItem {
  id: string;
  prefix: string;
  options: readonly [string, string];
  answer: string;
  suffix: string;
  hint: string;
}

export interface TrueFalseItem {
  id: string;
  statement: string;
  answer: 'T' | 'F';
}

export interface MatchOption {
  key: string;
  text: string;
}

export interface MatchQaItem {
  id: string;
  question: string;
  answer: string;
}

export interface McqOption {
  key: 'a' | 'b' | 'c' | 'd';
  text: string;
}

export interface McqItem {
  id: string;
  prompt: string;
  options: readonly McqOption[];
  answer: 'a' | 'b' | 'c' | 'd';
}

export interface UnscrambleItem {
  id: string;
  chunks: readonly string[];
  answer: string;
  /** Optional sentence frame around a scrambled phrase or word-part group (Level 4–5). */
  prefix?: string;
  suffix?: string;
  /** True when `chunks` are syllables/word-parts rather than whole words. */
  syllables?: boolean;
}

export interface CategoryBucket {
  key: string;
  label: string;
  hint?: string;
}

export interface CategorySortItem {
  id: string;
  text: string;
  answer: string;
}

export interface ErrorFixItem {
  id: string;
  wrong: string;
  answer: string;
  accepts?: readonly string[];
  hint?: string;
}

export interface WordSearchWord {
  id: string;
  number: number;
  clue: string;
  answer: string;
  start: readonly [number, number];
  end: readonly [number, number];
}

export interface CrosswordClue {
  id: string;
  number: number;
  direction: 'across' | 'down';
  row: number;
  col: number;
  clue: string;
  answer: string;
}

export interface SequenceItem {
  id: string;
  badge: string;
  text: string;
  /** 1-based position in the story order. */
  answer: number;
}

export interface OpenPromptItem {
  id: string;
  label: string;
  placeholder: string;
}

export type WorkbookActivity =
  | {
      kind: 'bank-fill';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      wordBank: readonly string[];
      items: readonly BankFillItem[];
    }
  | {
      kind: 'multi-blank';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      wordBank: readonly string[];
      sentences: readonly MultiBlankSentence[];
    }
  | {
      kind: 'cause-effect';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      leftLabel?: string;
      rightLabel?: string;
      wordBank: readonly string[];
      rows: readonly CauseEffectRow[];
    }
  | {
      kind: 'binary-choice';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      items: readonly BinaryChoiceItem[];
    }
  | {
      kind: 'true-false';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      items: readonly TrueFalseItem[];
    }
  | {
      kind: 'match-qa';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      scene: string;
      options: readonly MatchOption[];
      items: readonly MatchQaItem[];
    }
  | {
      kind: 'mcq';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      items: readonly McqItem[];
    }
  | {
      kind: 'unscramble';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      items: readonly UnscrambleItem[];
    }
  | {
      kind: 'word-search';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      grid: readonly string[];
      words: readonly WordSearchWord[];
    }
  | {
      kind: 'crossword';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      rows: number;
      cols: number;
      clues: readonly CrosswordClue[];
    }
  | {
      kind: 'sequence';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      count: number;
      leadSentence?: string;
      trailSentence?: string;
      items: readonly SequenceItem[];
    }
  | {
      kind: 'category-sort';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      categories: readonly CategoryBucket[];
      items: readonly CategorySortItem[];
    }
  | {
      kind: 'error-fix';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      items: readonly ErrorFixItem[];
    }
  | {
      kind: 'open-prompts';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      prompts: readonly OpenPromptItem[];
    }
  | {
      kind: 'book-report';
      id: string;
      badge: string;
      title: string;
      instruction: string;
      defaultTitle: string;
      defaultAuthor: string;
      characterChoices: readonly string[];
    };

export interface WorkbookSection {
  id: string;
  shortTitle: string;
  title: string;
  subtitle: string;
  /** 1-based page number inside public/library/books/<id>.pdf. */
  pdfPage: number;
  activities: readonly WorkbookActivity[];
}

export interface ReaderWorkbookMeta {
  /** Matches `id` and `workbook` in public/library/catalog.json. */
  id: string;
  gradeNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  gradeLabel:
    | 'Kid 1'
    | 'Kid 2'
    | 'Kid 3'
    | 'Kid 4'
    | 'Kid 5'
    | 'Kid 6'
    | 'Kid 7'
    | 'Kid 8'
    | 'Kid 9'
    | 'Kid 10'
    | 'Kid 11'
    | 'Level 1'
    | 'Grades K–2'
    | 'Parents & Teachers';
  seriesLabel: string;
  title: string;
  author: string;
  cover: string;
  bookHref: string;
  workbookHref: string;
  /** Firestore `drillSlug` under `drill_attempts` (with `drillSource: 'rfc3'`). */
  drillSlug: string;
  drillTitle: string;
  tagline: string;
  skills: readonly string[];
  accent: 'amber' | 'rose' | 'emerald';
  sections: readonly WorkbookSection[];
}

// ── Kid 1: The Brave Tin Soldier ────────────────────────────────────────────

const KID_1_TIN_SOLDIER: ReaderWorkbookMeta = {
  id: 'kid-1-the-brave-tin-soldier',
  gradeNumber: 1,
  gradeLabel: 'Kid 1',
  seriesLabel: 'Young Learners Classic Readers 1-3',
  title: 'The Brave Tin Soldier',
  author: 'Hans Christian Andersen',
  cover: './library/covers/kid-1-the-brave-tin-soldier.jpg',
  bookHref: '#library/kid-1-the-brave-tin-soldier',
  workbookHref: '#library/kid-1-the-brave-tin-soldier/workbook',
  drillSlug: 'reader-kid1-tin-soldier',
  drillTitle: 'Kid 1 · The Brave Tin Soldier — Workbook',
  tagline: 'Story focus, vocabulary, three-part comprehension, cause & effect, sentence unscramble, and book report.',
  skills: ['Vocabulary', 'Comprehension', 'Did …? Questions', 'Sentence Unscramble'],
  accent: 'amber',
  sections: [
    {
      id: 'story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Before You Read, Reading Check-Up, Pattern Practice & Challenge',
      pdfPage: 4,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k1-chars',
          badge: 'Before You Read',
          title: 'Meet the Characters',
          instruction: 'Choose the words from the box that describe each character in the story.',
          wordBank: ['in love', 'tin box', 'melts', 'brave', 'one leg'],
          items: [
            { id: 'k1-ch-1', label: 'Tin Soldier', prefix: 'Feels', suffix: 'when he sees the paper dancer.', answer: 'in love' },
            { id: 'k1-ch-2', label: 'Tin Soldier', prefix: 'Is never afraid — he is very', suffix: '.', answer: 'brave' },
            { id: 'k1-ch-3', label: 'Dancer', prefix: 'Stands gracefully in front of the castle on', suffix: '.', answer: 'one leg' },
            { id: 'k1-ch-4', label: 'Dancer', prefix: 'Falls into the fireplace and', suffix: 'away.', answer: 'melts' },
            { id: 'k1-ch-5', label: 'Black Goblin', prefix: 'Jumps out of a dark', suffix: 'at night.', answer: 'tin box' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k1-proverb',
          badge: 'Mini Quiz',
          title: 'While You Read · Proverb Check-Up',
          instruction: 'Choose the proverb that goes best with the story.',
          items: [
            {
              id: 'k1-prov-1',
              prompt: 'Which proverb matches The Brave Tin Soldier best?',
              options: [
                { key: 'a', text: 'A scared heart never won a girl.' },
                { key: 'b', text: "Don't count your chickens before they hatch." },
                { key: 'c', text: 'Better safe than sorry.' },
              ],
              answer: 'a',
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k1-pattern',
          badge: 'Pattern Practice',
          title: 'Asking Past Questions · "Did …?"',
          instruction: 'Complete each question with the right action word from the box. (Answer: Yes, he/she/they did. / No, he/she/they didn’t.)',
          wordBank: ['wash', 'make', 'eat', 'cook', 'chase', 'do', 'play', 'push'],
          items: [
            { id: 'k1-pat-1', prefix: 'Did the goblin', suffix: 'the soldier out of the window?', answer: 'push' },
            { id: 'k1-pat-2', prefix: 'Did the rat', suffix: 'the soldier in the drain?', answer: 'chase' },
            { id: 'k1-pat-3', prefix: 'Did a big fish', suffix: 'the soldier underwater?', answer: 'eat' },
            { id: 'k1-pat-4', prefix: 'Did the boy', suffix: 'a paper boat?', answer: 'make' },
            { id: 'k1-pat-5', prefix: 'Did you', suffix: 'your homework?', answer: 'do' },
            { id: 'k1-pat-6', prefix: 'Did she', suffix: 'breakfast in the kitchen?', answer: 'cook' },
            { id: 'k1-pat-7', prefix: 'Did they', suffix: 'the dishes in the sink?', answer: 'wash' },
            { id: 'k1-pat-8', prefix: 'Did he', suffix: 'outside?', answer: 'play' },
          ],
        },
        {
          kind: 'multi-blank',
          id: 'k1-challenge',
          badge: 'Challenge',
          title: 'Complete the Story Sentences',
          instruction: 'Look at each story scene clue and fill in the missing words from the box.',
          wordBank: ['boys', 'castle', 'cook', 'dancer', 'front', 'heart', 'melt', 'on', 'paper', 'soldier', 'table', 'tin'],
          sentences: [
            {
              id: 'k1-chal-1',
              scene: 'Scene 1 · A toy ballerina stands outside a tall paper castle.',
              parts: [
                'There is a ',
                { id: 'k1-chal-1a', answer: 'dancer' },
                ' in ',
                { id: 'k1-chal-1b', answer: 'front' },
                ' of the ',
                { id: 'k1-chal-1c', answer: 'castle' },
                '.',
              ],
            },
            {
              id: 'k1-chal-2',
              scene: 'Scene 2 · Two children sail the toy soldier in a folded newspaper boat.',
              parts: [
                'Two ',
                { id: 'k1-chal-2a', answer: 'boys' },
                ' make a ',
                { id: 'k1-chal-2b', answer: 'paper' },
                ' boat and put the ',
                { id: 'k1-chal-2c', answer: 'soldier' },
                ' in it.',
              ],
            },
            {
              id: 'k1-chal-3',
              scene: 'Scene 3 · In the kitchen, the big fish is laid down to be cut open.',
              parts: [
                'The ',
                { id: 'k1-chal-3a', answer: 'cook' },
                ' puts the fish ',
                { id: 'k1-chal-3b', answer: 'on' },
                ' the ',
                { id: 'k1-chal-3c', answer: 'table' },
                '.',
              ],
            },
            {
              id: 'k1-chal-4',
              scene: 'Scene 4 · Inside the bright fire, the metal soldier softens into a tiny ♥.',
              parts: [
                'The ',
                { id: 'k1-chal-4a', answer: 'tin' },
                ' soldier starts to ',
                { id: 'k1-chal-4b', answer: 'melt' },
                ' into the shape of a ',
                { id: 'k1-chal-4c', answer: 'heart' },
                '.',
              ],
            },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k1-reflections',
          badge: 'Think & Share',
          title: 'My Story Notes (Saved on Your Device)',
          instruction: 'Write your own ideas from Before You Read and While You Read. These open notes are for class discussion and are not counted in the auto-score.',
          prompts: [
            { id: 'k1-open-1', label: 'Prediction · Why do you think the tin soldier is in the street?', placeholder: 'I think he falls into the street because…' },
            { id: 'k1-open-2', label: 'Beginning (pp. 6–13) · What toy do you like to play with?', placeholder: 'My favorite toy is…' },
            { id: 'k1-open-3', label: 'Middle (pp. 14–19) · Did you ever make a paper boat? What happened?', placeholder: 'One time I made a paper boat and…' },
            { id: 'k1-open-4', label: 'End (pp. 20–24) · Do you think this story has a happy or sad ending? Why?', placeholder: 'I think the ending is… because…' },
          ],
        },
      ],
    },
    {
      id: 'vocabulary',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Story words and picture-clue sentences (Workbook pp. 10–11)',
      pdfPage: 9,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k1-vocab-a',
          badge: 'Part A',
          title: 'Match Each Clue with a Story Word',
          instruction: 'Pick the word from the box that matches each picture clue.',
          wordBank: ['stand', 'table', 'underwater', 'soldier', 'stream', 'rat', 'heart', 'market', 'start', 'listen'],
          items: [
            { id: 'k1-va-1', prefix: 'A small gray animal with sharp teeth and a long tail:', answer: 'rat' },
            { id: 'k1-va-2', prefix: 'To stay upright on your feet, not sitting down:', answer: 'stand' },
            { id: 'k1-va-3', prefix: 'A toy fighter wearing a uniform and holding a gun:', answer: 'soldier' },
            { id: 'k1-va-4', prefix: 'The beginning line of a race; to begin:', answer: 'start' },
            { id: 'k1-va-5', prefix: 'To pay attention and hear carefully with your ears:', answer: 'listen' },
            { id: 'k1-va-6', prefix: 'A flat piece of furniture with four legs in a kitchen or room:', answer: 'table' },
            { id: 'k1-va-7', prefix: 'The love shape (♥) left after the fire:', answer: 'heart' },
            { id: 'k1-va-8', prefix: 'Swimming beneath the top of the sea or river:', answer: 'underwater' },
            { id: 'k1-va-9', prefix: 'A busy place with stalls where people buy food and fish:', answer: 'market' },
            { id: 'k1-va-10', prefix: 'Flowing water that looks like a small, narrow river:', answer: 'stream' },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k1-vocab-b',
          badge: 'Part B',
          title: 'Circle the Correct Words',
          instruction: 'Tap the word that completes each sentence.',
          items: [
            { id: 'k1-vb-1', prefix: 'The boat', options: ['sinks', 'chases'], answer: 'sinks', suffix: '.', hint: 'The boat is going down into the water.' },
            { id: 'k1-vb-2', prefix: 'The', options: ['little', 'brave'], answer: 'little', suffix: 'yellow box is by a big box.', hint: 'It is much smaller than the big box.' },
            { id: 'k1-vb-3', prefix: 'The animals are', options: ['inside', 'underwater'], answer: 'inside', suffix: 'the house.', hint: 'You can see them through the open barn door.' },
            { id: 'k1-vb-4', prefix: 'The', options: ['window', 'paper'], answer: 'window', suffix: 'is open.', hint: 'Fresh air blows in through the wall frame.' },
            { id: 'k1-vb-5', prefix: 'The snowman', options: ['melts', 'falls'], answer: 'melts', suffix: 'in the sun.', hint: 'The warm sun turns the snow into a puddle.' },
            { id: 'k1-vb-6', prefix: 'There are three', options: ['tables', 'shapes'], answer: 'shapes', suffix: '.', hint: 'A triangle, a circle, and a square.' },
            { id: 'k1-vb-7', prefix: 'He is', options: ['brave', 'tin'], answer: 'brave', suffix: '.', hint: 'A hero standing tall with a cape, not scared.' },
            { id: 'k1-vb-8', prefix: 'There is nothing in the', options: ['market', 'street'], answer: 'street', suffix: '.', hint: 'An empty road running between buildings.' },
            { id: 'k1-vb-9', prefix: 'The', options: ['goblin', 'dancer'], answer: 'goblin', suffix: 'is scary.', hint: 'A small creepy creature with pointy ears.' },
            { id: 'k1-vb-10', prefix: 'The', options: ['drain', 'dancer'], answer: 'drain', suffix: 'is at the bottom of the sink.', hint: 'The round hole where water flows down.' },
          ],
        },
      ],
    },
    {
      id: 'beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pages 6–13 (Workbook pp. 12–13)',
      pdfPage: 11,
      activities: [
        {
          kind: 'true-false',
          id: 'k1-beg-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k1-ba-1', statement: 'The toy soldiers are made of wood.', answer: 'F' },
            { id: 'k1-ba-2', statement: 'All of the soldiers look different.', answer: 'F' },
            { id: 'k1-ba-3', statement: 'The soldiers live in a castle.', answer: 'F' },
            { id: 'k1-ba-4', statement: 'The black goblin opens the tin box.', answer: 'T' },
            { id: 'k1-ba-5', statement: 'The soldier falls out of the window.', answer: 'T' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k1-beg-b',
          badge: 'Part B',
          title: "Who's Who? Choose the Names",
          instruction: 'Match each clue to the right character.',
          wordBank: ['Little Boy', 'Tin Soldier', 'Dancer', 'Black Goblin'],
          items: [
            { id: 'k1-bb-1', prefix: 'Tells the soldier not to look at the dancer:', answer: 'Black Goblin' },
            { id: 'k1-bb-2', prefix: 'Stands on one leg in front of the castle:', answer: 'Dancer' },
            { id: 'k1-bb-3', prefix: 'Keeps the soldiers in a tin box:', answer: 'Little Boy' },
            { id: 'k1-bb-4', prefix: 'Falls into the street:', answer: 'Tin Soldier' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k1-beg-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k1-bc-1',
              prompt: '1. The dancer and the soldier are different because only the soldier is made of ___.',
              options: [
                { key: 'a', text: 'paper' },
                { key: 'b', text: 'tin' },
                { key: 'c', text: 'wood' },
                { key: 'd', text: 'gold' },
              ],
              answer: 'b',
            },
            {
              id: 'k1-bc-2',
              prompt: '2. Where does the dancer live?',
              options: [
                { key: 'a', text: 'by a window' },
                { key: 'b', text: 'by a bed' },
                { key: 'c', text: 'by a castle' },
                { key: 'd', text: 'in a tin box' },
              ],
              answer: 'c',
            },
            {
              id: 'k1-bc-3',
              prompt: '3. When do the toys play?',
              options: [
                { key: 'a', text: 'at night' },
                { key: 'b', text: 'in the morning' },
                { key: 'c', text: 'after school' },
                { key: 'd', text: 'in the afternoon' },
              ],
              answer: 'a',
            },
            {
              id: 'k1-bc-4',
              prompt: '4. The tin soldier always looks at the dancer because ___.',
              options: [
                { key: 'a', text: 'he likes her castle' },
                { key: 'b', text: 'he wants her leg' },
                { key: 'c', text: 'the little boy loves the dancer' },
                { key: 'd', text: 'he loves the dancer' },
              ],
              answer: 'd',
            },
            {
              id: 'k1-bc-5',
              prompt: '5. The goblin pushes the soldier because ___.',
              options: [
                { key: 'a', text: 'he is next to the window' },
                { key: 'b', text: 'he dances with the dancer' },
                { key: 'c', text: 'he likes the little boy' },
                { key: 'd', text: 'he does not listen to the goblin' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pages 14–19 (Workbook pp. 14–15)',
      pdfPage: 13,
      activities: [
        {
          kind: 'true-false',
          id: 'k1-mid-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k1-ma-1', statement: 'The little boy looks for the soldier on a sunny day.', answer: 'F' },
            { id: 'k1-ma-2', statement: 'Two boys find the soldier.', answer: 'T' },
            { id: 'k1-ma-3', statement: 'The tin soldier makes a boat.', answer: 'F' },
            { id: 'k1-ma-4', statement: 'The soldier goes into a drain.', answer: 'T' },
            { id: 'k1-ma-5', statement: 'A big rat eats the soldier.', answer: 'F' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k1-mid-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · In the pouring rain, two boys kneel by a stream in the street and float the tin soldier in a paper boat.',
          options: [
            { key: 'a', text: 'It is raining.' },
            { key: 'b', text: 'He is in a boat.' },
            { key: 'c', text: 'It is made of paper.' },
            { key: 'd', text: 'They are in the street.' },
          ],
          items: [
            { id: 'k1-mb-1', question: '1. Where are the two boys?', answer: 'd' },
            { id: 'k1-mb-2', question: '2. Where is the soldier?', answer: 'b' },
            { id: 'k1-mb-3', question: '3. What is the boat made of?', answer: 'c' },
            { id: 'k1-mb-4', question: '4. What is the weather like?', answer: 'a' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k1-mid-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k1-mc-1',
              prompt: '1. What happens when the little boy looks for the soldier?',
              options: [
                { key: 'a', text: 'The little boy steps on the soldier.' },
                { key: 'b', text: 'The little boy takes the soldier inside.' },
                { key: 'c', text: 'The little boy cannot find the soldier.' },
                { key: 'd', text: 'The little boy leaves the soldier in the rain.' },
              ],
              answer: 'c',
            },
            {
              id: 'k1-mc-2',
              prompt: '2. The rain ___.',
              options: [
                { key: 'a', text: 'hurts the soldier' },
                { key: 'b', text: 'makes a small stream' },
                { key: 'c', text: 'makes a big river' },
                { key: 'd', text: 'washes the boat' },
              ],
              answer: 'b',
            },
            {
              id: 'k1-mc-3',
              prompt: '3. What chases the soldier?',
              options: [
                { key: 'a', text: 'the little boy' },
                { key: 'b', text: 'a goblin' },
                { key: 'c', text: 'a dog' },
                { key: 'd', text: 'a rat' },
              ],
              answer: 'd',
            },
            {
              id: 'k1-mc-4',
              prompt: '4. What happens to the paper boat?',
              options: [
                { key: 'a', text: 'It melts.' },
                { key: 'b', text: 'A rat eats it.' },
                { key: 'c', text: 'It sinks.' },
                { key: 'd', text: 'It falls.' },
              ],
              answer: 'c',
            },
            {
              id: 'k1-mc-5',
              prompt: '5. A big fish ___.',
              options: [
                { key: 'a', text: 'eats the boat' },
                { key: 'b', text: 'helps the soldier' },
                { key: 'c', text: 'lives in the drain' },
                { key: 'd', text: 'eats the soldier' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pages 20–24 (Workbook pp. 16–17)',
      pdfPage: 15,
      activities: [
        {
          kind: 'true-false',
          id: 'k1-end-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k1-ea-1', statement: 'The soldier is afraid of the fish.', answer: 'F' },
            { id: 'k1-ea-2', statement: 'Someone brings the fish to a store.', answer: 'F' },
            { id: 'k1-ea-3', statement: 'The cook opens the fish and finds the dancer.', answer: 'F' },
            { id: 'k1-ea-4', statement: 'The soldier throws the little boy into the fire.', answer: 'F' },
            { id: 'k1-ea-5', statement: 'The dancer and the soldier melt together.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k1-end-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · In the kitchen, the cook has cut open the big fish on a table, and the one-legged tin soldier stands right beside it!',
          options: [
            { key: 'a', text: 'It is the tin soldier.' },
            { key: 'b', text: 'He was inside the fish.' },
            { key: 'c', text: 'He is on a table.' },
            { key: 'd', text: "The little boy's mother bought it." },
          ],
          items: [
            { id: 'k1-eb-1', question: '1. Who is next to the fish?', answer: 'a' },
            { id: 'k1-eb-2', question: '2. Where is he?', answer: 'c' },
            { id: 'k1-eb-3', question: '3. Where was he before?', answer: 'b' },
            { id: 'k1-eb-4', question: '4. Who bought the fish?', answer: 'd' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k1-end-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k1-ec-1',
              prompt: '1. Inside the fish, it is ___.',
              options: [
                { key: 'a', text: 'bright' },
                { key: 'b', text: 'dark' },
                { key: 'c', text: 'big' },
                { key: 'd', text: 'hot' },
              ],
              answer: 'b',
            },
            {
              id: 'k1-ec-2',
              prompt: '2. Where does the little boy’s mother buy the fish?',
              options: [
                { key: 'a', text: 'at a store' },
                { key: 'b', text: 'by a stream' },
                { key: 'c', text: 'in the street' },
                { key: 'd', text: 'at a market' },
              ],
              answer: 'd',
            },
            {
              id: 'k1-ec-3',
              prompt: '3. Where does the cook take the soldier?',
              options: [
                { key: 'a', text: 'to the little boy’s school' },
                { key: 'b', text: 'to the market' },
                { key: 'c', text: 'to the little boy’s house' },
                { key: 'd', text: 'to the castle' },
              ],
              answer: 'c',
            },
            {
              id: 'k1-ec-4',
              prompt: '4. Where does the little boy throw the soldier?',
              options: [
                { key: 'a', text: 'in the tin box' },
                { key: 'b', text: 'out the window' },
                { key: 'c', text: 'into the fire' },
                { key: 'd', text: 'into the castle' },
              ],
              answer: 'c',
            },
            {
              id: 'k1-ec-5',
              prompt: '5. What falls into the fire after the soldier?',
              options: [
                { key: 'a', text: 'the dancer' },
                { key: 'b', text: 'the goblin' },
                { key: 'c', text: 'the castle' },
                { key: 'd', text: 'the fish' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },
    {
      id: 'think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Cause & effect chart and sentence unscramble (Workbook pp. 18–19)',
      pdfPage: 17,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k1-think',
          badge: 'Think & Write',
          title: 'Cause and Effect',
          instruction: 'Fill in the missing words from the box to connect each cause with its effect.',
          wordBank: ['shape', 'home', 'buys', 'street', 'window', 'fish', 'fire', 'boat', 'drain', 'sinks'],
          rows: [
            {
              id: 'k1-tw-1',
              cause: ['The soldier falls out of the ', { id: 'k1-tw-1a', answer: 'window' }, '.'],
              effect: ['He lands in the ', { id: 'k1-tw-1b', answer: 'street' }, '.'],
            },
            {
              id: 'k1-tw-2',
              cause: ['Two boys put the soldier in a paper ', { id: 'k1-tw-2a', answer: 'boat' }, '.'],
              effect: ['The boat carries the soldier into a ', { id: 'k1-tw-2b', answer: 'drain' }, '.'],
            },
            {
              id: 'k1-tw-3',
              cause: ['The boat ', { id: 'k1-tw-3a', answer: 'sinks' }, '.'],
              effect: ['A big ', { id: 'k1-tw-3b', answer: 'fish' }, ' eats the soldier.'],
            },
            {
              id: 'k1-tw-4',
              cause: ["The little boy's mother ", { id: 'k1-tw-4a', answer: 'buys' }, ' the fish.'],
              effect: ['The soldier goes back ', { id: 'k1-tw-4b', answer: 'home' }, '.'],
            },
            {
              id: 'k1-tw-5',
              cause: ['The soldier melts in the ', { id: 'k1-tw-5a', answer: 'fire' }, '.'],
              effect: ['The soldier becomes the ', { id: 'k1-tw-5b', answer: 'shape' }, ' of a heart.'],
            },
          ],
        },
        {
          kind: 'unscramble',
          id: 'k1-unscramble',
          badge: 'Vocabulary Review',
          title: 'Unscramble and Build the Sentences',
          instruction: 'Tap the word tiles in order (or type the sentence) to build each sentence correctly.',
          items: [
            { id: 'k1-un-1', chunks: ['Twenty-five', 'live', 'soldiers', 'in a box.'], answer: 'Twenty-five soldiers live in a box.' },
            { id: 'k1-un-2', chunks: ['soldier', 'A tin', 'one leg.', 'has'], answer: 'A tin soldier has one leg.' },
            { id: 'k1-un-3', chunks: ['soldier', 'loves', 'the dancer.', 'The tin'], answer: 'The tin soldier loves the dancer.' },
            { id: 'k1-un-4', chunks: ['tin box.', 'goblin', 'The black', 'opens the'], answer: 'The black goblin opens the tin box.' },
            { id: 'k1-un-5', chunks: ['listen to', 'does not', 'the goblin.', 'The soldier'], answer: 'The soldier does not listen to the goblin.' },
            { id: 'k1-un-6', chunks: ['falls', 'the window.', 'out of', 'The soldier'], answer: 'The soldier falls out of the window.' },
            { id: 'k1-un-7', chunks: ['The rain', 'a small', 'makes', 'stream.'], answer: 'The rain makes a small stream.' },
            { id: 'k1-un-8', chunks: ['boat', 'fast.', 'The paper', 'moves'], answer: 'The paper boat moves fast.' },
            { id: 'k1-un-9', chunks: ['takes', 'to the market.', 'the fish', 'Someone'], answer: 'Someone takes the fish to the market.' },
            { id: 'k1-un-10', chunks: ['by the fire.', 'The toys', 'melt'], answer: 'The toys melt by the fire.' },
          ],
        },
      ],
    },
    {
      id: 'summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary · Book Report',
      subtitle: 'Put the whole story in order and write your Book Report (Workbook pp. 20–21)',
      pdfPage: 19,
      activities: [
        {
          kind: 'sequence',
          id: 'k1-summary',
          badge: 'Summary',
          title: 'Number the Story Pictures (1–4)',
          instruction: 'Put the four scenes in story order from 1 (first) to 4 (last).',
          count: 4,
          items: [
            { id: 'k1-sum-1', badge: 'Picture A', text: 'Two boys sail the tin soldier in a paper boat along a rainy street.', answer: 2 },
            { id: 'k1-sum-2', badge: 'Picture B', text: 'The tin soldier and the paper dancer fall together into the fireplace flames.', answer: 4 },
            { id: 'k1-sum-3', badge: 'Picture C', text: 'A big fish opens its mouth to swallow the sinking tin soldier underwater.', answer: 3 },
            { id: 'k1-sum-4', badge: 'Picture D', text: 'The one-legged tin soldier stands beside the paper dancer in front of the toy castle.', answer: 1 },
          ],
        },
        {
          kind: 'sequence',
          id: 'k1-plot',
          badge: 'Book Report · Plot',
          title: 'Put the Sentences in Story Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange the five plot sentences from beginning to end.',
          count: 5,
          items: [
            { id: 'k1-pl-a', badge: 'a', text: "Someone catches the fish and sells it to the little boy's mother.", answer: 4 },
            { id: 'k1-pl-b', badge: 'b', text: 'The soldier and the dancer melt in the fire.', answer: 5 },
            { id: 'k1-pl-c', badge: 'c', text: 'The one-legged tin soldier loves the dancer.', answer: 1 },
            { id: 'k1-pl-d', badge: 'd', text: 'Two boys put him in a boat. The boat sinks and a fish eats him.', answer: 3 },
            { id: 'k1-pl-e', badge: 'e', text: 'The black goblin pushes the soldier out of the window.', answer: 2 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k1-report',
          badge: 'My Book Report',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'The Brave Tin Soldier',
          defaultAuthor: 'Hans Christian Andersen',
          characterChoices: ['The Tin Soldier', 'The Dancer', 'The Black Goblin', 'The Little Boy'],
        },
      ],
    },
  ],
};

// ── Kid 2: Hansel and Gretel ────────────────────────────────────────────────

const KID_2_HANSEL_GRETEL: ReaderWorkbookMeta = {
  id: 'kid-2-hansel-and-gretel',
  gradeNumber: 2,
  gradeLabel: 'Kid 2',
  seriesLabel: 'Young Learners Classic Readers 1-2',
  title: 'Hansel and Gretel',
  author: 'Brothers Grimm',
  cover: './library/covers/kid-2-hansel-and-gretel.jpg',
  bookHref: '#library/kid-2-hansel-and-gretel',
  workbookHref: '#library/kid-2-hansel-and-gretel/workbook',
  drillSlug: 'reader-kid2-hansel-gretel',
  drillTitle: 'Kid 2 · Hansel and Gretel — Workbook',
  tagline: 'Story focus, interactive 8×8 word search, three-part comprehension, cause & effect, vocabulary review, and book report.',
  skills: ['Word Search', 'Comprehension', 'Enough Questions', 'Cause & Effect'],
  accent: 'rose',
  sections: [
    {
      id: 'story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Before You Read, Reading Check-Up, Pattern Practice & Challenge',
      pdfPage: 4,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k2-chars',
          badge: 'Before You Read',
          title: 'Meet the Characters',
          instruction: 'Choose the words from the box that match each character in Hansel and Gretel.',
          wordBank: ['wood-cutter', 'rocks', 'mean', 'candy house', 'old', 'scared', 'pushed', 'clever', 'plan', 'happy'],
          items: [
            { id: 'k2-ch-1', label: 'Hansel', prefix: 'Is smart and quick-thinking — he is', suffix: '.', answer: 'clever' },
            { id: 'k2-ch-2', label: 'Hansel', prefix: 'Drops shiny white', suffix: 'to find the way home.', answer: 'rocks' },
            { id: 'k2-ch-3', label: 'Gretel', prefix: 'Feels', suffix: 'alone in the dark forest.', answer: 'scared' },
            { id: 'k2-ch-4', label: 'Gretel', prefix: 'Saved her brother when she', suffix: 'the witch into the oven.', answer: 'pushed' },
            { id: 'k2-ch-5', label: 'Father', prefix: 'Works in the forest as a', suffix: '.', answer: 'wood-cutter' },
            { id: 'k2-ch-6', label: 'Father', prefix: 'Is so', suffix: 'when his children come back home!', answer: 'happy' },
            { id: 'k2-ch-7', label: 'Stepmother', prefix: 'Is unkind and', suffix: 'to Hansel and Gretel.', answer: 'mean' },
            { id: 'k2-ch-8', label: 'Stepmother', prefix: 'Makes a bad', suffix: 'to leave the children in the woods.', answer: 'plan' },
            { id: 'k2-ch-9', label: 'Witch', prefix: 'Looks like a kind', suffix: 'woman at first.', answer: 'old' },
            { id: 'k2-ch-10', label: 'Witch', prefix: 'Lives deep in the forest inside a', suffix: '.', answer: 'candy house' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k2-proverb',
          badge: 'Mini Quiz',
          title: 'While You Read · Proverb Check-Up',
          instruction: 'Choose the proverb that goes best with the story.',
          items: [
            {
              id: 'k2-prov-1',
              prompt: 'Which proverb matches Hansel and Gretel best?',
              options: [
                { key: 'a', text: 'What goes around comes around.' },
                { key: 'b', text: 'Never say never.' },
                { key: 'c', text: "Money doesn't grow on trees." },
              ],
              answer: 'a',
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k2-pattern',
          badge: 'Pattern Practice',
          title: 'Using "Is … enough?"',
          instruction: 'Complete each question with the best describing word from the box. (Answer: Yes, it is. / No, it isn’t.)',
          wordBank: ['dark', 'hot', 'cold', 'new', 'warm', 'deep', 'big', 'good'],
          items: [
            { id: 'k2-pat-1', prefix: 'Is the oven', suffix: 'enough?', answer: 'hot' },
            { id: 'k2-pat-2', prefix: 'Is the water', suffix: 'enough?', answer: 'cold' },
            { id: 'k2-pat-3', prefix: 'Is the computer', suffix: 'enough?', answer: 'new' },
            { id: 'k2-pat-4', prefix: 'Is the room', suffix: 'enough?', answer: 'dark' },
            { id: 'k2-pat-5', prefix: 'Is the river', suffix: 'enough?', answer: 'deep' },
            { id: 'k2-pat-6', prefix: 'Is the coat', suffix: 'enough?', answer: 'warm' },
            { id: 'k2-pat-7', prefix: 'Is the food', suffix: 'enough?', answer: 'good' },
            { id: 'k2-pat-8', prefix: 'Is the chair', suffix: 'enough?', answer: 'big' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k2-challenge',
          badge: 'Challenge & Notes',
          title: 'Write Your Own "enough" Sentences & Story Notes',
          instruction: 'Make your own sentences using the word "enough" (e.g. "I have enough time." / "The cake is sweet enough."). Saved on your device; not counted in the auto-score.',
          prompts: [
            { id: 'k2-open-1', label: 'Challenge 1 · Write a sentence with "enough"', placeholder: 'I have enough…' },
            { id: 'k2-open-2', label: 'Challenge 2 · Write a sentence with "enough"', placeholder: 'The soup is warm enough…' },
            { id: 'k2-open-3', label: 'Challenge 3 · Write a sentence with "enough"', placeholder: 'Is this bag big enough…?' },
            { id: 'k2-open-4', label: 'Challenge 4 · If you saw a candy house, what part would you eat first?', placeholder: 'I would eat the chocolate roof first because…' },
          ],
        },
      ],
    },
    {
      id: 'vocabulary',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Word search puzzle and picture-clue sentences (Workbook pp. 10–11)',
      pdfPage: 9,
      activities: [
        {
          kind: 'word-search',
          id: 'k2-vocab-a',
          badge: 'Part A · Word Search',
          title: 'Find the Six Story Words',
          instruction: 'Tap the first letter and last letter of each hidden word in the grid (across, down, or diagonal) — or type the word next to its clue.',
          grid: [
            'followbn',
            'ksotnaeh',
            'amcjirsw',
            'vgkadlfi',
            'perlropt',
            'utiwdesc',
            'shmcktdh',
            'coforest',
          ],
          words: [
            { id: 'k2-ws-1', number: 1, clue: 'To walk right behind someone in a line', answer: 'follow', start: [0, 0], end: [0, 5] },
            { id: 'k2-ws-2', number: 2, clue: 'A deep place full of many tall trees', answer: 'forest', start: [7, 2], end: [7, 7] },
            { id: 'k2-ws-3', number: 3, clue: 'Young boys and girls', answer: 'children', start: [7, 0], end: [0, 7] },
            { id: 'k2-ws-4', number: 4, clue: 'Feeling frightened or afraid', answer: 'scared', start: [1, 1], end: [6, 6] },
            { id: 'k2-ws-5', number: 5, clue: 'To shut a door or cage with a key', answer: 'lock', start: [0, 2], end: [3, 2] },
            { id: 'k2-ws-6', number: 6, clue: 'A wicked woman in a pointed hat who wants to eat Hansel', answer: 'witch', start: [2, 7], end: [6, 7] },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k2-vocab-b',
          badge: 'Part B',
          title: 'Choose the Best Words',
          instruction: 'Tap the word that best completes each sentence.',
          items: [
            { id: 'k2-vb-1', prefix: 'She uses the towel to', options: ['sleep', 'clean'], answer: 'clean', suffix: '.', hint: 'She wipes the table neatly with a cloth.' },
            { id: 'k2-vb-2', prefix: 'The man and woman are', options: ['teachers', 'parents'], answer: 'parents', suffix: '.', hint: 'A mother and father holding their baby.' },
            { id: 'k2-vb-3', prefix: 'The house has a', options: ['roof', 'window'], answer: 'roof', suffix: '.', hint: 'The arrow points to the top cover of the house.' },
            { id: 'k2-vb-4', prefix: 'This gives the room', options: ['light', 'oven'], answer: 'light', suffix: '.', hint: 'A bright lamp shining in the room.' },
            { id: 'k2-vb-5', prefix: 'A', options: ['witch', 'stepmother'], answer: 'stepmother', suffix: "is a father's new wife.", hint: 'She married the children’s father.' },
            { id: 'k2-vb-6', prefix: 'He is a', options: ['wood-cutter', 'boy'], answer: 'wood-cutter', suffix: '.', hint: 'A man carrying an ax beside chopped logs.' },
            { id: 'k2-vb-7', prefix: 'Look out the', options: ['table', 'window'], answer: 'window', suffix: '.', hint: 'An open glass frame in the wall with curtains.' },
          ],
        },
      ],
    },
    {
      id: 'beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pages 6–11 (Workbook pp. 12–13)',
      pdfPage: 11,
      activities: [
        {
          kind: 'true-false',
          id: 'k2-beg-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k2-ba-1', statement: 'The children live with their real mother.', answer: 'F' },
            { id: 'k2-ba-2', statement: 'The family has a lot of food.', answer: 'F' },
            { id: 'k2-ba-3', statement: 'The stepmother does not want the children.', answer: 'T' },
            { id: 'k2-ba-4', statement: 'Gretel finds rocks outside.', answer: 'F' },
            { id: 'k2-ba-5', statement: 'The children cannot see the rocks at night.', answer: 'F' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k2-beg-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · Outside the house by the trees, Hansel smiles and puts shiny white pebbles into his pocket.',
          options: [
            { key: 'a', text: 'He is finding rocks.' },
            { key: 'b', text: 'They will help them find their way home.' },
            { key: 'c', text: 'He is Hansel.' },
            { key: 'd', text: 'He is going to drop them on the ground.' },
          ],
          items: [
            { id: 'k2-bb-1', question: '1. Who is he?', answer: 'c' },
            { id: 'k2-bb-2', question: '2. What is he doing?', answer: 'a' },
            { id: 'k2-bb-3', question: '3. What is he going to do with the rocks?', answer: 'd' },
            { id: 'k2-bb-4', question: '4. Why does he do that?', answer: 'b' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k2-beg-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k2-bc-1',
              prompt: '1. Who loves the children?',
              options: [
                { key: 'a', text: 'their stepmother' },
                { key: 'b', text: 'their father' },
                { key: 'c', text: 'an old woman' },
                { key: 'd', text: 'their friends' },
              ],
              answer: 'b',
            },
            {
              id: 'k2-bc-2',
              prompt: '2. Why does the stepmother want to leave the children in the forest?',
              options: [
                { key: 'a', text: 'The children are bad.' },
                { key: 'b', text: 'She loves the forest.' },
                { key: 'c', text: 'There is not enough food for everyone.' },
                { key: 'd', text: 'The father does not love them.' },
              ],
              answer: 'c',
            },
            {
              id: 'k2-bc-3',
              prompt: '3. Why do the parents tell the children to wait?',
              options: [
                { key: 'a', text: 'They are going to find food.' },
                { key: 'b', text: 'They are going to make a fire.' },
                { key: 'c', text: 'They are going to find some rocks.' },
                { key: 'd', text: 'They are going to cut some wood.' },
              ],
              answer: 'd',
            },
            {
              id: 'k2-bc-4',
              prompt: '4. The rocks are easy to see at night because ___.',
              options: [
                { key: 'a', text: 'the moon shines on them' },
                { key: 'b', text: 'the fire makes light' },
                { key: 'c', text: 'they are big' },
                { key: 'd', text: 'they are in a tree' },
              ],
              answer: 'a',
            },
            {
              id: 'k2-bc-5',
              prompt: '5. How does the stepmother feel when the children come home?',
              options: [
                { key: 'a', text: 'happy' },
                { key: 'b', text: 'scared' },
                { key: 'c', text: 'hungry' },
                { key: 'd', text: 'angry' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pages 12–17 (Workbook pp. 14–15)',
      pdfPage: 13,
      activities: [
        {
          kind: 'true-false',
          id: 'k2-mid-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k2-ma-1', statement: 'Hansel cannot get any rocks this time.', answer: 'T' },
            { id: 'k2-ma-2', statement: 'Gretel gives Hansel some bread.', answer: 'F' },
            { id: 'k2-ma-3', statement: 'Hansel and Gretel cannot find the bread.', answer: 'T' },
            { id: 'k2-ma-4', statement: 'The children eat the bird.', answer: 'F' },
            { id: 'k2-ma-5', statement: 'An old woman lives in the candy house.', answer: 'T' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k2-mid-b',
          badge: 'Part B',
          title: "Who's Who? Choose the Names",
          instruction: 'Match each clue to the right character.',
          wordBank: ['Hansel', 'Old woman', 'Stepmother', 'Gretel'],
          items: [
            { id: 'k2-mb-1', prefix: 'Gives the children food in the candy house:', answer: 'Old woman' },
            { id: 'k2-mb-2', prefix: 'Locks the children in their room:', answer: 'Stepmother' },
            { id: 'k2-mb-3', prefix: 'Eats a piece of the roof:', answer: 'Hansel' },
            { id: 'k2-mb-4', prefix: 'Eats a piece of the window:', answer: 'Gretel' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k2-mid-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k2-mc-1',
              prompt: '1. What does Hansel drop in the forest the second time?',
              options: [
                { key: 'a', text: 'rocks' },
                { key: 'b', text: 'candy' },
                { key: 'c', text: 'pieces of bread' },
                { key: 'd', text: 'wood' },
              ],
              answer: 'c',
            },
            {
              id: 'k2-mc-2',
              prompt: '2. Why can’t the children find the bread?',
              options: [
                { key: 'a', text: 'It is too dark.' },
                { key: 'b', text: 'Birds ate it.' },
                { key: 'c', text: 'The stepmother took it.' },
                { key: 'd', text: 'Gretel ate it.' },
              ],
              answer: 'b',
            },
            {
              id: 'k2-mc-3',
              prompt: '3. What do the children follow to the house?',
              options: [
                { key: 'a', text: 'rocks' },
                { key: 'b', text: 'their parents' },
                { key: 'c', text: 'a dog' },
                { key: 'd', text: 'a bird' },
              ],
              answer: 'd',
            },
            {
              id: 'k2-mc-4',
              prompt: '4. Why do the children eat the house?',
              options: [
                { key: 'a', text: 'The old woman tells them to eat it.' },
                { key: 'b', text: 'They do not like the old woman.' },
                { key: 'c', text: 'They want to go inside.' },
                { key: 'd', text: 'They are hungry, and it is made of food.' },
              ],
              answer: 'd',
            },
            {
              id: 'k2-mc-5',
              prompt: '5. The old woman tells the children to ___.',
              options: [
                { key: 'a', text: 'come inside' },
                { key: 'b', text: 'go home' },
                { key: 'c', text: 'eat the roof' },
                { key: 'd', text: 'clean her house' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },
    {
      id: 'end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pages 18–24 (Workbook pp. 16–17)',
      pdfPage: 15,
      activities: [
        {
          kind: 'true-false',
          id: 'k2-end-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k2-ea-1', statement: 'The old woman is nice.', answer: 'F' },
            { id: 'k2-ea-2', statement: 'Gretel cleans Hansel’s room.', answer: 'F' },
            { id: 'k2-ea-3', statement: 'The witch wants to cook Hansel in an oven.', answer: 'T' },
            { id: 'k2-ea-4', statement: 'Hansel pushes the witch into the oven.', answer: 'F' },
            { id: 'k2-ea-5', statement: 'Hansel and Gretel find their way home.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k2-end-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · In the witch’s kitchen, brave Gretel pushes the witch right into the hot stone oven and shuts the door!',
          options: [
            { key: 'a', text: 'They will run away.' },
            { key: 'b', text: 'They are Gretel and the witch.' },
            { key: 'c', text: 'She is pushing the witch.' },
            { key: 'd', text: 'The witch wants to eat Hansel.' },
          ],
          items: [
            { id: 'k2-eb-1', question: '1. Who are they?', answer: 'b' },
            { id: 'k2-eb-2', question: '2. What is Gretel doing?', answer: 'c' },
            { id: 'k2-eb-3', question: '3. Why is Gretel doing that?', answer: 'd' },
            { id: 'k2-eb-4', question: '4. What will Hansel and Gretel do next?', answer: 'a' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k2-end-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k2-ec-1',
              prompt: '1. Why does the witch feed Hansel a lot?',
              options: [
                { key: 'a', text: 'She likes Hansel.' },
                { key: 'b', text: 'She wants him to get fat so she can eat him.' },
                { key: 'c', text: 'Hansel cleans her house.' },
                { key: 'd', text: 'She has too much food.' },
              ],
              answer: 'b',
            },
            {
              id: 'k2-ec-2',
              prompt: '2. What does the witch make Gretel do?',
              options: [
                { key: 'a', text: 'eat a lot of food' },
                { key: 'b', text: 'cut wood outside' },
                { key: 'c', text: 'cook and clean' },
                { key: 'd', text: 'stay in a locked room' },
              ],
              answer: 'c',
            },
            {
              id: 'k2-ec-3',
              prompt: '3. The witch opens the oven to see if ___.',
              options: [
                { key: 'a', text: 'it is hot enough' },
                { key: 'b', text: 'Hansel is inside' },
                { key: 'c', text: 'the bread is ready' },
                { key: 'd', text: 'it is clean enough' },
              ],
              answer: 'a',
            },
            {
              id: 'k2-ec-4',
              prompt: '4. What do the children take from the witch’s house?',
              options: [
                { key: 'a', text: 'gold and food' },
                { key: 'b', text: 'rocks and wood' },
                { key: 'c', text: 'a bird and a cat' },
                { key: 'd', text: 'the oven' },
              ],
              answer: 'a',
            },
            {
              id: 'k2-ec-5',
              prompt: '5. When the children reach home, their stepmother ___.',
              options: [
                { key: 'a', text: 'is happy to see them' },
                { key: 'b', text: 'is angry again' },
                { key: 'c', text: 'locks the door' },
                { key: 'd', text: 'is gone' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Cause & effect chart and vocabulary gap-fill (Workbook pp. 18–19)',
      pdfPage: 17,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k2-think',
          badge: 'Think & Write',
          title: 'Cause and Effect',
          instruction: 'Fill in the missing words from the box to connect each cause with its effect.',
          wordBank: ['pushes', 'bird', 'stepmother', 'candy', 'forest', 'witch', 'hungry', 'follow'],
          rows: [
            {
              id: 'k2-tw-1',
              cause: ['The ', { id: 'k2-tw-1a', answer: 'stepmother' }, ' leaves the children in the woods.'],
              effect: ['They ', { id: 'k2-tw-1b', answer: 'follow' }, ' Hansel’s white rocks back home.'],
            },
            {
              id: 'k2-tw-2',
              cause: ['Birds eat Hansel’s bread in the ', { id: 'k2-tw-2a', answer: 'forest' }, '.'],
              effect: ['The lost children follow a ', { id: 'k2-tw-2b', answer: 'bird' }, ' to a strange house.'],
            },
            {
              id: 'k2-tw-3',
              cause: ['Hansel and Gretel are very ', { id: 'k2-tw-3a', answer: 'hungry' }, '.'],
              effect: ['They eat the ', { id: 'k2-tw-3b', answer: 'candy' }, ' house.'],
            },
            {
              id: 'k2-tw-4',
              cause: ['The ', { id: 'k2-tw-4a', answer: 'witch' }, ' wants to cook and eat Hansel.'],
              effect: ['Gretel ', { id: 'k2-tw-4b', answer: 'pushes' }, ' the witch into the hot oven.'],
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k2-review',
          badge: 'Vocabulary Review',
          title: 'Fill in the Blanks',
          instruction: 'Complete each sentence with the right word from the box.',
          wordBank: ['mean', 'angry', 'clean', 'oven', 'rocks', 'far', 'locks', 'house', 'wood-cutter', 'drops'],
          items: [
            { id: 'k2-vr-1', prefix: "Hansel and Gretel's father is a", suffix: '.', answer: 'wood-cutter' },
            { id: 'k2-vr-2', prefix: 'Hansel finds shiny white', suffix: 'outside the house.', answer: 'rocks' },
            { id: 'k2-vr-3', prefix: 'The witch makes Gretel cook and', suffix: 'every day.', answer: 'clean' },
            { id: 'k2-vr-4', prefix: 'The wicked witch', suffix: 'Hansel inside a room.', answer: 'locks' },
            { id: 'k2-vr-5', prefix: 'Gretel pushes the witch into the hot', suffix: '.', answer: 'oven' },
            { id: 'k2-vr-6', prefix: 'The witch’s', suffix: 'is made of bread, cake, and candy.', answer: 'house' },
            { id: 'k2-vr-7', prefix: 'The children’s stepmother is very', suffix: 'to them.', answer: 'mean' },
            { id: 'k2-vr-8', prefix: 'The stepmother is', suffix: 'when the children come back home.', answer: 'angry' },
            { id: 'k2-vr-9', prefix: 'The parents take the children', suffix: 'into the forest.', answer: 'far' },
            { id: 'k2-vr-10', prefix: 'Hansel', suffix: 'pieces of bread on the forest path.', answer: 'drops' },
          ],
        },
      ],
    },
    {
      id: 'summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary · Book Report',
      subtitle: 'Put the whole story in order and write your Book Report (Workbook pp. 20–21)',
      pdfPage: 19,
      activities: [
        {
          kind: 'sequence',
          id: 'k2-summary',
          badge: 'Summary',
          title: 'Number the Story Pictures (1–4)',
          instruction: 'Put the four scenes in story order from 1 (first) to 4 (last).',
          count: 4,
          items: [
            { id: 'k2-sum-1', badge: 'Picture A', text: 'Gretel pushes the wicked witch into the hot oven.', answer: 4 },
            { id: 'k2-sum-2', badge: 'Picture B', text: 'Hansel drops shiny white rocks behind him on the path.', answer: 1 },
            { id: 'k2-sum-3', badge: 'Picture C', text: 'Hungry birds eat the pieces of bread Hansel dropped.', answer: 2 },
            { id: 'k2-sum-4', badge: 'Picture D', text: 'Hansel and Gretel eat candy from the delicious house in the woods.', answer: 3 },
          ],
        },
        {
          kind: 'sequence',
          id: 'k2-plot',
          badge: 'Book Report · Plot',
          title: 'Put the Sentences in Story Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange the five plot sentences from beginning to end.',
          count: 5,
          items: [
            { id: 'k2-pl-a', badge: 'a', text: 'Hansel drops white rocks and leads Gretel safely back home.', answer: 1 },
            { id: 'k2-pl-b', badge: 'b', text: 'The lost children follow a bird and find a house made of candy.', answer: 3 },
            { id: 'k2-pl-c', badge: 'c', text: 'The next time, Hansel drops bread, and birds eat it all.', answer: 2 },
            { id: 'k2-pl-d', badge: 'd', text: 'Gretel pushes the witch into the oven, and the children go home to their father.', answer: 5 },
            { id: 'k2-pl-e', badge: 'e', text: 'A wicked witch locks Hansel up because she wants to eat him.', answer: 4 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k2-report',
          badge: 'My Book Report',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'Hansel and Gretel',
          defaultAuthor: 'Brothers Grimm',
          characterChoices: ['Hansel', 'Gretel', 'The Father', 'The Stepmother', 'The Witch'],
        },
      ],
    },
  ],
};

// ── Kid 3: Jack and the Magic Beans ─────────────────────────────────────────

const KID_3_MAGIC_BEANS: ReaderWorkbookMeta = {
  id: 'kid-3-jack-and-the-magic-beans',
  gradeNumber: 3,
  gradeLabel: 'Kid 3',
  seriesLabel: 'Young Learners Classic Readers 2-5',
  title: 'Jack and the Magic Beans',
  author: 'Joseph Jacobs',
  cover: './library/covers/kid-3-jack-and-the-magic-beans.jpg',
  bookHref: '#library/kid-3-jack-and-the-magic-beans',
  workbookHref: '#library/kid-3-jack-and-the-magic-beans/workbook',
  drillSlug: 'reader-kid3-magic-beans',
  drillTitle: 'Kid 3 · Jack and the Magic Beans — Workbook',
  tagline: 'Story focus, vocabulary & interactive crossword, three-part comprehension, cause & effect, sentence unscramble, and book report.',
  skills: ['Crossword', 'Comprehension', 'Going to …', 'Sentence Unscramble'],
  accent: 'emerald',
  sections: [
    {
      id: 'story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Before You Read, Reading Check-Up, Pattern Practice & Challenge',
      pdfPage: 4,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k3-chars',
          badge: 'Before You Read',
          title: 'Meet the Characters',
          instruction: 'Choose the words from the box that match each character in Jack and the Magic Beans.',
          wordBank: ['throws', 'climbs', 'steals', 'hide', 'eats', 'rich', 'marries', 'smells'],
          items: [
            { id: 'k3-ch-1', label: 'Jack', prefix: 'Bravely', suffix: 'up the tall magic plant into the clouds.', answer: 'climbs' },
            { id: 'k3-ch-2', label: 'Jack', prefix: 'Sneaks in and', suffix: 'gold, a goose, and a magic harp.', answer: 'steals' },
            { id: 'k3-ch-3', label: 'Jack', prefix: 'Grows up happily and', suffix: 'a princess.', answer: 'marries' },
            { id: 'k3-ch-4', label: "Jack's Mother", prefix: 'Gets angry and', suffix: 'the five beans out the window.', answer: 'throws' },
            { id: 'k3-ch-5', label: "Jack's Mother", prefix: 'Becomes', suffix: 'and happy at the end of the story.', answer: 'rich' },
            { id: 'k3-ch-6', label: 'Giant', prefix: 'Is scary because he', suffix: 'little boys!', answer: 'eats' },
            { id: 'k3-ch-7', label: 'Giant', prefix: 'Sniffs the air when he', suffix: 'a boy in his castle.', answer: 'smells' },
            { id: 'k3-ch-8', label: "Giant's Wife", prefix: 'Helps Jack', suffix: 'inside a big pot.', answer: 'hide' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k3-proverb',
          badge: 'Mini Quiz',
          title: 'While You Read · Proverb Check-Up',
          instruction: 'Choose the proverb that goes best with the story.',
          items: [
            {
              id: 'k3-prov-1',
              prompt: 'Which proverb matches Jack and the Magic Beans best?',
              options: [
                { key: 'a', text: 'No news is good news.' },
                { key: 'b', text: 'Every dog has his day.' },
                { key: 'c', text: 'The early bird catches the worm.' },
              ],
              answer: 'b',
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k3-pattern',
          badge: 'Pattern Practice',
          title: 'Answering "Where are you going?"',
          instruction: 'Use the words in the box to answer each "Where are you going?" clue.',
          wordBank: ['work', 'Korea', 'school', 'Canada', 'concert', 'town', 'dinner', 'swimming pool'],
          items: [
            { id: 'k3-pat-1', prefix: "I'm going to", suffix: '. (Clue: a trip to Seoul 🇰🇷)', answer: 'Korea' },
            { id: 'k3-pat-2', prefix: "I'm going to", suffix: '. (Clue: the maple-leaf country 🇨🇦)', answer: 'Canada' },
            { id: 'k3-pat-3', prefix: "I'm going to", suffix: 'to sell the cow.', answer: 'town' },
            { id: 'k3-pat-4', prefix: "I'm going to", suffix: 'with my backpack and books.', answer: 'school' },
            { id: 'k3-pat-5', prefix: "I'm going to", suffix: 'at the office.', answer: 'work' },
            { id: 'k3-pat-6', prefix: "I'm going to the", suffix: 'with my goggles and towel.', answer: 'swimming pool' },
            { id: 'k3-pat-7', prefix: "I'm going to", suffix: 'at a restaurant tonight.', answer: 'dinner' },
            { id: 'k3-pat-8', prefix: "I'm going to a", suffix: 'to listen to live music.', answer: 'concert' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k3-challenge',
          badge: 'Challenge & Notes',
          title: 'Write Your Own "going to" Sentences & Story Notes',
          instruction: 'Write where you are going and what you think about Jack’s adventure. Saved on your device; not counted in the auto-score.',
          prompts: [
            { id: 'k3-open-1', label: 'Challenge 1 · Where are you going after class?', placeholder: "I'm going to…" },
            { id: 'k3-open-2', label: 'Challenge 2 · Where are you going this weekend?', placeholder: "I'm going to…" },
            { id: 'k3-open-3', label: 'Challenge 3 · If you had five magic beans, where would you plant them?', placeholder: 'I would plant them…' },
            { id: 'k3-open-4', label: 'Challenge 4 · Which treasure would you pick: gold, the golden goose, or the magic harp?', placeholder: 'I would pick… because…' },
          ],
        },
      ],
    },
    {
      id: 'vocabulary',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Story words and interactive crossword puzzle (Workbook pp. 10–11)',
      pdfPage: 9,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k3-vocab-a',
          badge: 'Part A',
          title: 'Fill in the Story Words',
          instruction: 'Choose the right word from the box for each clue.',
          wordBank: ['knock', 'hide', 'worried', 'giant', 'cloud', 'lay', 'thief', 'breakfast', 'rich', 'princess'],
          items: [
            { id: 'k3-va-1', prefix: 'To stay behind a tree or inside a pot so nobody sees you:', answer: 'hide' },
            { id: 'k3-va-2', prefix: 'To tap on a closed door with your hand:', answer: 'knock' },
            { id: 'k3-va-3', prefix: 'A king’s daughter wearing a crown:', answer: 'princess' },
            { id: 'k3-va-4', prefix: 'A soft white shape floating high in the sky:', answer: 'cloud' },
            { id: 'k3-va-5', prefix: 'What a hen or goose does to make an egg:', answer: 'lay' },
            { id: 'k3-va-6', prefix: 'A huge, towering man who lives in a sky castle:', answer: 'giant' },
            { id: 'k3-va-7', prefix: 'A person who steals things that belong to someone else:', answer: 'thief' },
            { id: 'k3-va-8', prefix: 'Having lots and lots of gold and money:', answer: 'rich' },
            { id: 'k3-va-9', prefix: 'The first meal you eat in the morning:', answer: 'breakfast' },
            { id: 'k3-va-10', prefix: 'Feeling nervous that something bad might happen:', answer: 'worried' },
          ],
        },
        {
          kind: 'crossword',
          id: 'k3-vocab-b',
          badge: 'Part B · Crossword',
          title: 'Story Vocabulary Crossword',
          instruction: 'Type each Across and Down word from its clue — the letters fill the crossword grid automatically!',
          rows: 10,
          cols: 14,
          clues: [
            { id: 'k3-cw-2a', number: 2, direction: 'across', row: 1, col: 3, clue: 'To go up a tree, mountain, or magic beanstalk (5)', answer: 'climb' },
            { id: 'k3-cw-5a', number: 5, direction: 'across', row: 3, col: 6, clue: 'The meal you eat in the middle of the day (5)', answer: 'lunch' },
            { id: 'k3-cw-7a', number: 7, direction: 'across', row: 5, col: 0, clue: 'Coming at the very end of a line — not first (4)', answer: 'last' },
            { id: 'k3-cw-8a', number: 8, direction: 'across', row: 5, col: 10, clue: 'To give something away in exchange for money (4)', answer: 'sell' },
            { id: 'k3-cw-9a', number: 9, direction: 'across', row: 9, col: 6, clue: 'Sleepy and needing rest after hard work (5)', answer: 'tired' },
            { id: 'k3-cw-1d', number: 1, direction: 'down', row: 0, col: 6, clue: 'To sense a flower or food using your nose (5)', answer: 'smell' },
            { id: 'k3-cw-2d', number: 2, direction: 'down', row: 1, col: 3, clue: 'To say numbers in order — 1, 2, 3… — to see how many coins you have (5)', answer: 'count' },
            { id: 'k3-cw-3d', number: 3, direction: 'down', row: 2, col: 8, clue: 'Very mad or upset (5)', answer: 'angry' },
            { id: 'k3-cw-4d', number: 4, direction: 'down', row: 3, col: 1, clue: 'A long path or way leading into town (4)', answer: 'road' },
            { id: 'k3-cw-6d', number: 6, direction: 'down', row: 3, col: 10, clue: 'The man a woman is married to (7)', answer: 'husband' },
          ],
        },
      ],
    },
    {
      id: 'beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pages 6–11 (Workbook pp. 12–13)',
      pdfPage: 11,
      activities: [
        {
          kind: 'true-false',
          id: 'k3-beg-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k3-ba-1', statement: 'Jack and his mother have no money.', answer: 'T' },
            { id: 'k3-ba-2', statement: 'Jack sells the cow for gold coins.', answer: 'F' },
            { id: 'k3-ba-3', statement: "Jack's mother is happy about the five magic beans.", answer: 'F' },
            { id: 'k3-ba-4', statement: 'A giant plant grows up into the clouds overnight.', answer: 'T' },
            { id: 'k3-ba-5', statement: 'Jack climbs the plant and sees a big house in the sky.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k3-beg-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · On the road to town, Jack leads his cow and meets an old man holding out five magic beans.',
          options: [
            { key: 'a', text: 'He meets an old man.' },
            { key: 'b', text: 'He is going to town to sell his cow.' },
            { key: 'c', text: 'They are on the road.' },
            { key: 'd', text: 'He gives Jack five magic beans.' },
          ],
          items: [
            { id: 'k3-bb-1', question: '1. Who does Jack meet?', answer: 'a' },
            { id: 'k3-bb-2', question: '2. Where are they?', answer: 'c' },
            { id: 'k3-bb-3', question: '3. Where is Jack going?', answer: 'b' },
            { id: 'k3-bb-4', question: '4. What does the old man give Jack?', answer: 'd' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k3-beg-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k3-bc-1',
              prompt: '1. Why must Jack sell the cow?',
              options: [
                { key: 'a', text: 'The cow is sick.' },
                { key: 'b', text: 'He wants a magic harp.' },
                { key: 'c', text: 'The cow runs away.' },
                { key: 'd', text: 'He and his mother are poor and need money for food.' },
              ],
              answer: 'd',
            },
            {
              id: 'k3-bc-2',
              prompt: '2. What does Jack’s mother do with the magic beans?',
              options: [
                { key: 'a', text: 'She cooks them for dinner.' },
                { key: 'b', text: 'She sells them at the market.' },
                { key: 'c', text: 'She throws them out the window.' },
                { key: 'd', text: 'She keeps them in a pot.' },
              ],
              answer: 'c',
            },
            {
              id: 'k3-bc-3',
              prompt: '3. That night, Jack goes to bed without ___.',
              options: [
                { key: 'a', text: 'dinner' },
                { key: 'b', text: 'breakfast' },
                { key: 'c', text: 'a blanket' },
                { key: 'd', text: 'his shoes' },
              ],
              answer: 'a',
            },
            {
              id: 'k3-bc-4',
              prompt: '4. What does Jack see outside his window the next morning?',
              options: [
                { key: 'a', text: 'the old man and the cow' },
                { key: 'b', text: 'a very tall plant reaching the clouds' },
                { key: 'c', text: 'five gold eggs' },
                { key: 'd', text: 'a princess on the road' },
              ],
              answer: 'b',
            },
            {
              id: 'k3-bc-5',
              prompt: '5. Who opens the door when Jack knocks on the big house in the clouds?',
              options: [
                { key: 'a', text: 'the old man' },
                { key: 'b', text: 'a princess' },
                { key: 'c', text: "Jack's mother" },
                { key: 'd', text: 'a big woman (the giant’s wife)' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pages 12–17 (Workbook pp. 14–15)',
      pdfPage: 13,
      activities: [
        {
          kind: 'true-false',
          id: 'k3-mid-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k3-ma-1', statement: 'The giant likes playing with boys.', answer: 'F' },
            { id: 'k3-ma-2', statement: 'The giant’s wife feeds Jack and hides him.', answer: 'T' },
            { id: 'k3-ma-3', statement: 'Jack takes a bag of gold while the giant sleeps.', answer: 'T' },
            { id: 'k3-ma-4', statement: 'Jack never climbs the magic plant again.', answer: 'F' },
            { id: 'k3-ma-5', statement: 'On his second trip, Jack steals a goose that lays gold eggs.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k3-mid-b',
          badge: 'Part B',
          title: 'Match the Questions and Answers',
          instruction: 'Match each question to the right letter (a–d).',
          scene: 'Story picture · At the giant table, the huge giant has fallen asleep beside his bags of gold while little Jack tiptoes up to take them.',
          options: [
            { key: 'a', text: 'He is sleeping at the table.' },
            { key: 'b', text: 'He was counting his gold.' },
            { key: 'c', text: 'He steals the giant’s gold.' },
            { key: 'd', text: 'He climbs back down home to his mother.' },
          ],
          items: [
            { id: 'k3-mb-1', question: '1. What was the giant doing before?', answer: 'b' },
            { id: 'k3-mb-2', question: '2. What is the giant doing now?', answer: 'a' },
            { id: 'k3-mb-3', question: '3. What does Jack do?', answer: 'c' },
            { id: 'k3-mb-4', question: '4. Where does Jack go next?', answer: 'd' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k3-mid-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k3-mc-1',
              prompt: '1. Where does Jack hide when the giant comes home?',
              options: [
                { key: 'a', text: 'under the bed' },
                { key: 'b', text: 'behind a cloud' },
                { key: 'c', text: 'in a pot' },
                { key: 'd', text: 'in a box' },
              ],
              answer: 'c',
            },
            {
              id: 'k3-mc-2',
              prompt: '2. What does the giant say when he enters the house?',
              options: [
                { key: 'a', text: 'He sees Jack’s cow.' },
                { key: 'b', text: 'He hears a harp singing.' },
                { key: 'c', text: 'He wants five magic beans.' },
                { key: 'd', text: 'He smells a boy.' },
              ],
              answer: 'd',
            },
            {
              id: 'k3-mc-3',
              prompt: '3. After eating, the giant falls asleep because he is ___.',
              options: [
                { key: 'a', text: 'worried' },
                { key: 'b', text: 'tired' },
                { key: 'c', text: 'sad' },
                { key: 'd', text: 'sick' },
              ],
              answer: 'b',
            },
            {
              id: 'k3-mc-4',
              prompt: '4. Why does Jack climb the plant a second time?',
              options: [
                { key: 'a', text: 'He wants to say sorry to the giant.' },
                { key: 'b', text: 'He lost his ax in the clouds.' },
                { key: 'c', text: 'He and his mother use up the last of the gold.' },
                { key: 'd', text: 'His mother asks for a cow.' },
              ],
              answer: 'c',
            },
            {
              id: 'k3-mc-5',
              prompt: '5. What is special about the giant’s goose?',
              options: [
                { key: 'a', text: 'It lays gold eggs.' },
                { key: 'b', text: 'It sings magic songs.' },
                { key: 'c', text: 'It can talk to the giant.' },
                { key: 'd', text: 'It flies Jack home.' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },
    {
      id: 'end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pages 18–24 (Workbook pp. 16–17)',
      pdfPage: 15,
      activities: [
        {
          kind: 'true-false',
          id: 'k3-end-a',
          badge: 'Part A',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k3-ea-1', statement: 'Jack climbs the magic plant a third time.', answer: 'T' },
            { id: 'k3-ea-2', statement: 'The magic harp stays quiet when Jack takes it.', answer: 'F' },
            { id: 'k3-ea-3', statement: 'The giant catches Jack at the bottom of the plant.', answer: 'F' },
            { id: 'k3-ea-4', statement: 'Jack cuts down the plant with his ax.', answer: 'T' },
            { id: 'k3-ea-5', statement: 'Jack and his mother stay poor at the end.', answer: 'F' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k3-end-b',
          badge: 'Part B',
          title: "Who's Who? Choose the Names",
          instruction: 'Match each clue to the right character.',
          wordBank: ['Jack', "Jack's Mother", 'Giant', "Giant's Wife"],
          items: [
            { id: 'k3-eb-1', prefix: 'Chases Jack down the magic plant and falls to the ground:', answer: 'Giant' },
            { id: 'k3-eb-2', prefix: 'Steals the magic harp and chops down the plant with an ax:', answer: 'Jack' },
            { id: 'k3-eb-3', prefix: 'Lives happily ever after with Jack and their new riches:', answer: "Jack's Mother" },
            { id: 'k3-eb-4', prefix: 'Was worried a thief had stolen her husband’s things:', answer: "Giant's Wife" },
          ],
        },
        {
          kind: 'mcq',
          id: 'k3-end-c',
          badge: 'Part C',
          title: 'Choose the Best Answers',
          instruction: 'Pick the best choice (a, b, c, or d) for each question.',
          items: [
            {
              id: 'k3-ec-1',
              prompt: '1. What does the giant bring out on Jack’s third visit?',
              options: [
                { key: 'a', text: 'another goose' },
                { key: 'b', text: 'a magic gold harp' },
                { key: 'c', text: 'a sack of beans' },
                { key: 'd', text: 'a silver ax' },
              ],
              answer: 'b',
            },
            {
              id: 'k3-ec-2',
              prompt: '2. Why does the giant wake up when Jack grabs the harp?',
              options: [
                { key: 'a', text: 'Jack drops a pot.' },
                { key: 'b', text: "The giant's wife shouts." },
                { key: 'c', text: 'The harp yells for help.' },
                { key: 'd', text: 'The goose honks loudly.' },
              ],
              answer: 'c',
            },
            {
              id: 'k3-ec-3',
              prompt: '3. What does Jack use to cut down the magic plant?',
              options: [
                { key: 'a', text: 'his ax' },
                { key: 'b', text: 'a kitchen knife' },
                { key: 'c', text: 'a sword' },
                { key: 'd', text: 'a rock' },
              ],
              answer: 'a',
            },
            {
              id: 'k3-ec-4',
              prompt: '4. What happens to the giant when the plant falls?',
              options: [
                { key: 'a', text: 'He climbs back into the clouds.' },
                { key: 'b', text: 'He runs into the forest.' },
                { key: 'c', text: 'He falls down and dies.' },
                { key: 'd', text: 'He gives Jack his house.' },
              ],
              answer: 'c',
            },
            {
              id: 'k3-ec-5',
              prompt: '5. Whom does Jack marry at the end of the story?',
              options: [
                { key: 'a', text: 'a girl from the market' },
                { key: 'b', text: 'a princess' },
                { key: 'c', text: 'a dancer' },
                { key: 'd', text: "the wood-cutter's daughter" },
              ],
              answer: 'b',
            },
          ],
        },
      ],
    },
    {
      id: 'think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Cause & effect chart and sentence unscramble (Workbook pp. 18–19)',
      pdfPage: 17,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k3-think',
          badge: 'Think & Write',
          title: 'Cause and Effect',
          instruction: 'Fill in the missing words from the box to connect each cause with its effect.',
          wordBank: ['plant', 'throws', 'dies', 'climbs', 'cuts', 'happy', 'sell', 'giant', 'steal', 'beans'],
          rows: [
            {
              id: 'k3-tw-1',
              cause: ['Jack goes to town to ', { id: 'k3-tw-1a', answer: 'sell' }, ' the cow.'],
              effect: ['An old man gives him five magic ', { id: 'k3-tw-1b', answer: 'beans' }, '.'],
            },
            {
              id: 'k3-tw-2',
              cause: ["Jack's mother ", { id: 'k3-tw-2a', answer: 'throws' }, ' the beans out the window.'],
              effect: ['A huge magic ', { id: 'k3-tw-2b', answer: 'plant' }, ' grows up to the clouds.'],
            },
            {
              id: 'k3-tw-3',
              cause: ['Jack ', { id: 'k3-tw-3a', answer: 'climbs' }, ' the plant to the giant’s house.'],
              effect: ['He manages to ', { id: 'k3-tw-3b', answer: 'steal' }, ' gold, a goose, and a harp.'],
            },
            {
              id: 'k3-tw-4',
              cause: ['Jack brings treasures from the ', { id: 'k3-tw-4a', answer: 'giant' }, ' back home.'],
              effect: ['Jack and his mother become rich and ', { id: 'k3-tw-4b', answer: 'happy' }, '.'],
            },
            {
              id: 'k3-tw-5',
              cause: ['Jack ', { id: 'k3-tw-5a', answer: 'cuts' }, ' down the plant with his ax.'],
              effect: ['The chasing giant falls down and ', { id: 'k3-tw-5b', answer: 'dies' }, '.'],
            },
          ],
        },
        {
          kind: 'unscramble',
          id: 'k3-unscramble',
          badge: 'Vocabulary Review',
          title: 'Unscramble and Build the Sentences',
          instruction: 'Tap the word tiles in order (or type the sentence) to build each sentence correctly.',
          items: [
            { id: 'k3-un-1', chunks: ['the cow.', 'Jack', 'sells'], answer: 'Jack sells the cow.' },
            { id: 'k3-un-2', chunks: ['magic beans.', 'He gives', 'five', 'Jack'], answer: 'He gives Jack five magic beans.' },
            { id: 'k3-un-3', chunks: ['eat', 'does not', 'dinner.', 'Jack'], answer: 'Jack does not eat dinner.' },
            { id: 'k3-un-4', chunks: ['boys.', 'The giant', 'eats'], answer: 'The giant eats boys.' },
            { id: 'k3-un-5', chunks: ['on the table.', 'some gold', 'puts', 'The giant'], answer: 'The giant puts some gold on the table.' },
            { id: 'k3-un-6', chunks: ['gold eggs.', 'lays', 'The goose'], answer: 'The goose lays gold eggs.' },
            { id: 'k3-un-7', chunks: ['for help.', 'yells', 'The harp'], answer: 'The harp yells for help.' },
            { id: 'k3-un-8', chunks: ['his ax.', 'uses', 'Jack'], answer: 'Jack uses his ax.' },
            { id: 'k3-un-9', chunks: ['get rich.', 'his mother', 'Jack and'], answer: 'Jack and his mother get rich.' },
            { id: 'k3-un-10', chunks: ['are happy.', 'Jack and', 'his mother'], answer: 'Jack and his mother are happy.' },
          ],
        },
      ],
    },
    {
      id: 'summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary · Book Report',
      subtitle: 'Put the whole story in order and write your Book Report (Workbook pp. 20–21)',
      pdfPage: 19,
      activities: [
        {
          kind: 'sequence',
          id: 'k3-summary',
          badge: 'Summary',
          title: 'Number the Story Pictures (1–4)',
          instruction: 'Put the four scenes in story order from 1 (first) to 4 (last).',
          count: 4,
          items: [
            { id: 'k3-sum-1', badge: 'Picture A', text: 'Jack runs away carrying the goose that lays gold eggs.', answer: 3 },
            { id: 'k3-sum-2', badge: 'Picture B', text: 'Jack swings his ax to chop down the giant magic plant.', answer: 4 },
            { id: 'k3-sum-3', badge: 'Picture C', text: 'An old man trades five magic beans for Jack’s cow.', answer: 1 },
            { id: 'k3-sum-4', badge: 'Picture D', text: 'Jack climbs high up the magic plant into the clouds.', answer: 2 },
          ],
        },
        {
          kind: 'sequence',
          id: 'k3-plot',
          badge: 'Book Report · Plot',
          title: 'Put the Sentences in Story Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange the five plot sentences from beginning to end.',
          count: 5,
          items: [
            { id: 'k3-pl-a', badge: 'a', text: 'Jack climbs into the clouds and steals gold and a golden goose from a giant.', answer: 3 },
            { id: 'k3-pl-b', badge: 'b', text: "Jack's mother throws the beans out the window, and a huge plant grows to the sky.", answer: 2 },
            { id: 'k3-pl-c', badge: 'c', text: 'The magic harp yells for help, and the angry giant chases Jack down the plant.', answer: 4 },
            { id: 'k3-pl-d', badge: 'd', text: 'Jack trades his cow to an old man for five magic beans.', answer: 1 },
            { id: 'k3-pl-e', badge: 'e', text: 'Jack cuts down the plant with his ax, and he and his mother live rich and happy lives.', answer: 5 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k3-report',
          badge: 'My Book Report',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'Jack and the Magic Beans',
          defaultAuthor: 'Joseph Jacobs',
          characterChoices: ['Jack', "Jack's Mother", 'The Giant', "The Giant's Wife", 'The Old Man'],
        },
      ],
    },
  ],
};

// ── Kid 4: The Trojan Horse ──────────────────────────────────────────────────

const KID_4_TROJAN_HORSE: ReaderWorkbookMeta = {
  id: 'kid-4-the-trojan-horse',
  gradeNumber: 4,
  gradeLabel: 'Kid 4',
  seriesLabel: 'Young Learners Classic Readers 2-10',
  title: 'The Trojan Horse',
  author: 'Virgil',
  cover: './library/covers/kid-4-the-trojan-horse.jpg',
  bookHref: '#library/kid-4-the-trojan-horse',
  workbookHref: '#library/kid-4-the-trojan-horse/workbook',
  drillSlug: 'reader-kid4-trojan-horse',
  drillTitle: 'Kid 4 · The Trojan Horse — Workbook',
  tagline: 'Characters, "something for someone" pattern practice, crossword puzzle, comprehension, problem & solution, and book report.',
  skills: ['Crossword', 'Comprehension', 'Problem & Solution', 'Book Report'],
  accent: 'amber',
  sections: [
    {
      id: 'k4-story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Workbook pp. 4–8 · Introduction, Characters, Mini Quiz, Pattern Practice & Challenge',
      pdfPage: 4,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k4-characters',
          badge: 'Before You Read · p. 4',
          title: 'Characters — Who Is Each Character?',
          instruction: 'Choose the phrase from the box that describes each character in The Trojan Horse.',
          wordBank: [
            'lied to the Trojans',
            'married to a king',
            'a goddess',
            'hid inside a wooden horse',
            'wanted to marry Helen',
            'killed by the Greeks',
          ],
          items: [
            { id: 'k4-ch-1', label: 'Paris', prefix: 'Trojan prince —', answer: 'wanted to marry Helen' },
            { id: 'k4-ch-2', label: 'Helen', prefix: 'Beautiful queen —', answer: 'married to a king' },
            { id: 'k4-ch-3', label: 'Athena', prefix: 'Helped the Greeks —', answer: 'a goddess' },
            { id: 'k4-ch-4', label: 'Ulysses', prefix: 'Greek leader —', answer: 'hid inside a wooden horse' },
            { id: 'k4-ch-5', label: 'Sinon', prefix: 'Greek soldier left behind —', answer: 'lied to the Trojans' },
            { id: 'k4-ch-6', label: 'King Priam', prefix: 'Ruler of Troy —', answer: 'killed by the Greeks' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k4-intro-open',
          badge: 'Introduction · p. 4 (Optional)',
          title: 'About the Author & Poem',
          instruction: 'Answer in complete sentences (saved on your device for class discussion).',
          prompts: [
            { id: 'k4-in-1', label: '1. Who was Virgil?', placeholder: 'He was a…' },
            { id: 'k4-in-2', label: '2. What is the name of the poem this story is from?', placeholder: 'It is called…' },
            { id: 'k4-in-3', label: '3. Where did Aeneas go after the war?', placeholder: 'He went to…' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k4-mini-quiz',
          badge: 'While You Read · p. 6',
          title: 'Mini Quiz!',
          instruction: 'Choose the best lesson for the story.',
          items: [
            {
              id: 'k4-mq-1',
              prompt: 'What is the lesson of the story? Choose the best answer.',
              options: [
                { key: 'a', text: 'Beauty is only skin deep.' },
                { key: 'b', text: 'Children and fools tell the truth.' },
                { key: 'c', text: 'Beware of Greeks bearing gifts.' },
              ],
              answer: 'c',
            },
          ],
        },
        {
          kind: 'multi-blank',
          id: 'k4-pattern',
          badge: 'After You Read · p. 7',
          title: 'Pattern Practice: something for someone',
          instruction: 'Example — A: "What is this?" · B: "It was a gift for Athena." Complete each dialogue with the words from the box.',
          wordBank: [
            'shoes', 'grandma', 'surprise', 'friends', 'present',
            'father', 'flowers', 'teacher', 'snacks', 'you',
          ],
          sentences: [
            {
              id: 'k4-pat-s1',
              scene: 'Dialogue 1 — Giving a wrapped birthday box directly to someone',
              parts: ['A: What is this? — B: It is a ', { id: 'k4-pat-1a', answer: 'present' }, ' for ', { id: 'k4-pat-1b', answer: 'you' }, '.'],
            },
            {
              id: 'k4-pat-s2',
              scene: 'Dialogue 2 — Sharing treats with classmates',
              parts: ['A: What are these? — B: They are ', { id: 'k4-pat-2a', answer: 'snacks' }, ' for my ', { id: 'k4-pat-2b', answer: 'friends' }, '.'],
            },
            {
              id: 'k4-pat-s3',
              scene: 'Dialogue 3 — Planning something special at school',
              parts: ['A: What is this? — B: It is a ', { id: 'k4-pat-3a', answer: 'surprise' }, ' for our ', { id: 'k4-pat-3b', answer: 'teacher' }, '.'],
            },
            {
              id: 'k4-pat-s4',
              scene: 'Dialogue 4 — A new pair of footwear for Dad',
              parts: ['A: What are these? — B: They are ', { id: 'k4-pat-4a', answer: 'shoes' }, ' for my ', { id: 'k4-pat-4b', answer: 'father' }, '.'],
            },
            {
              id: 'k4-pat-s5',
              scene: 'Dialogue 5 — A fresh bouquet of roses for Grandmother',
              parts: ['A: What are these? — B: They are ', { id: 'k4-pat-5a', answer: 'flowers' }, ' for my ', { id: 'k4-pat-5b', answer: 'grandma' }, '.'],
            },
          ],
        },
        {
          kind: 'multi-blank',
          id: 'k4-challenge',
          badge: 'Challenge · p. 8',
          title: 'Tell the Story with the Words',
          instruction: 'Complete all four story sentences using the words in the box.',
          wordBank: [
            'Paris', 'marry', 'beautiful', 'Greeks', 'big', 'horse',
            'killed', 'burned', 'city', 'stood', 'hill', 'Troy',
          ],
          sentences: [
            {
              id: 'k4-cal-s1',
              scene: 'Scene 1 — Paris sits beside lovely Helen',
              parts: [{ id: 'k4-cal-1a', answer: 'Paris' }, ' wanted to ', { id: 'k4-cal-1b', answer: 'marry' }, ' a ', { id: 'k4-cal-1c', answer: 'beautiful' }, ' woman.'],
            },
            {
              id: 'k4-cal-s2',
              scene: 'Scene 2 — Soldiers look up at the towering wooden horse',
              parts: ['The ', { id: 'k4-cal-2a', answer: 'Greeks' }, ' built a ', { id: 'k4-cal-2b', answer: 'big' }, ' wooden ', { id: 'k4-cal-2c', answer: 'horse' }, '.'],
            },
            {
              id: 'k4-cal-s3',
              scene: 'Scene 3 — Greek soldiers attack inside Troy’s gates',
              parts: ['The Greeks ', { id: 'k4-cal-3a', answer: 'killed' }, ' many people and ', { id: 'k4-cal-3b', answer: 'burned' }, ' the ', { id: 'k4-cal-3c', answer: 'city' }, '.'],
            },
            {
              id: 'k4-cal-s4',
              scene: 'Scene 4 — Aeneas stands with his father and son looking back at the flames',
              parts: ['He ', { id: 'k4-cal-4a', answer: 'stood' }, ' on a ', { id: 'k4-cal-4b', answer: 'hill' }, ' and watched ', { id: 'k4-cal-4c', answer: 'Troy' }, ' burn.'],
            },
          ],
        },
      ],
    },
    {
      id: 'k4-vocab',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Workbook pp. 10–11 · Word matching & interactive crossword puzzle',
      pdfPage: 9,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k4-vocab-a',
          badge: 'Vocabulary A · p. 10',
          title: 'Match the Picture and the Word',
          instruction: 'Choose the matching vocabulary word from the box for each picture clue.',
          wordBank: ['inside', 'cheer', 'gate', 'hate', 'sail', 'war', 'pull', 'wine', 'army', 'tent'],
          items: [
            { id: 'k4-va-1', prefix: 'Making an angry face and giving two thumbs down — to dislike very much:', answer: 'hate' },
            { id: 'k4-va-2', prefix: 'A bear standing in a house, not outdoors:', answer: 'inside' },
            { id: 'k4-va-3', prefix: 'Tugging a heavy box toward you with a rope:', answer: 'pull' },
            { id: 'k4-va-4', prefix: 'People raising their arms and shouting happily:', answer: 'cheer' },
            { id: 'k4-va-5', prefix: 'A long fight between two countries and their soldiers:', answer: 'war' },
            { id: 'k4-va-6', prefix: 'The big door in a fence or city wall that opens and closes:', answer: 'gate' },
            { id: 'k4-va-7', prefix: 'A large group of soldiers standing together to fight:', answer: 'army' },
            { id: 'k4-va-8', prefix: 'A cloth shelter where soldiers sleep in a camp:', answer: 'tent' },
            { id: 'k4-va-9', prefix: 'To travel across the sea in a boat with the wind:', answer: 'sail' },
            { id: 'k4-va-10', prefix: 'A dark drink made from grapes, poured from a bottle into a glass:', answer: 'wine' },
          ],
        },
        {
          kind: 'crossword',
          id: 'k4-vocab-b',
          badge: 'Vocabulary B · p. 11',
          title: 'Vocabulary Crossword Puzzle',
          instruction: 'Type the answer for each Across and Down clue. Tap any square on the grid to jump to its clue.',
          rows: 14,
          cols: 10,
          clues: [
            { id: 'k4-cw-a1', number: 1, direction: 'across', row: 0, col: 2, clue: 'To get away safely through an open door (6)', answer: 'escape' },
            { id: 'k4-cw-a3', number: 3, direction: 'across', row: 2, col: 5, clue: 'A small wooden ship that floats on water (4)', answer: 'boat' },
            { id: 'k4-cw-a5', number: 5, direction: 'across', row: 5, col: 3, clue: 'A thick, strong cord used to pull heavy things (4)', answer: 'rope' },
            { id: 'k4-cw-a7', number: 7, direction: 'across', row: 7, col: 0, clue: 'A person who stands watch to protect a gate or palace (5)', answer: 'guard' },
            { id: 'k4-cw-a9', number: 9, direction: 'across', row: 10, col: 4, clue: 'To come back to a place you left (6)', answer: 'return' },
            { id: 'k4-cw-d1', number: 1, direction: 'down', row: 0, col: 2, clue: 'Having nothing inside, like an open box with nothing in it (5)', answer: 'empty' },
            { id: 'k4-cw-d2', number: 2, direction: 'down', row: 0, col: 6, clue: 'A hard question or trouble you need to solve (7)', answer: 'problem' },
            { id: 'k4-cw-d4', number: 4, direction: 'down', row: 4, col: 4, clue: 'A person in uniform who fights in an army (7)', answer: 'soldier' },
            { id: 'k4-cw-d6', number: 6, direction: 'down', row: 6, col: 1, clue: 'To catch fire and be destroyed by flames (4)', answer: 'burn' },
            { id: 'k4-cw-d8', number: 8, direction: 'down', row: 8, col: 6, clue: 'To rush forward and fight an enemy with weapons (6)', answer: 'attack' },
          ],
        },
      ],
    },
    {
      id: 'k4-beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pp. 6–11 · Workbook pp. 12–13',
      pdfPage: 11,
      activities: [
        {
          kind: 'true-false',
          id: 'k4-beg-a',
          badge: 'Beginning A · p. 12',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k4-ba-1', statement: '1. Paris wanted to marry another man’s wife.', answer: 'T' },
            { id: 'k4-ba-2', statement: '2. The Trojans attacked a Greek city.', answer: 'F' },
            { id: 'k4-ba-3', statement: '3. Paris died in the war.', answer: 'T' },
            { id: 'k4-ba-4', statement: '4. Athena helped the Trojans.', answer: 'F' },
            { id: 'k4-ba-5', statement: '5. The war lasted for two years.', answer: 'F' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k4-beg-b',
          badge: 'Beginning B · p. 12',
          title: 'Who’s Who? Write the Names',
          instruction: 'Choose the character who matches each sentence.',
          wordBank: ['Sinon', 'Aphrodite', 'Helen', 'King Menelaus'],
          items: [
            { id: 'k4-bb-1', prefix: 'This person helped Paris find a beautiful woman.', answer: 'Aphrodite' },
            { id: 'k4-bb-2', prefix: 'This person was married to Helen.', answer: 'King Menelaus' },
            { id: 'k4-bb-3', prefix: 'This person had an idea about how to get the wooden horse into Troy.', answer: 'Sinon' },
            { id: 'k4-bb-4', prefix: 'This person was taken to Troy.', answer: 'Helen' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k4-beg-c',
          badge: 'Beginning C · p. 13',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k4-bc-1',
              prompt: '1. The ____________ Aphrodite helped Paris.',
              options: [
                { key: 'a', text: 'queen' },
                { key: 'b', text: 'princess' },
                { key: 'c', text: 'goddess' },
                { key: 'd', text: 'fairy' },
              ],
              answer: 'c',
            },
            {
              id: 'k4-bc-2',
              prompt: '2. There was a ____________ wall around Troy.',
              options: [
                { key: 'a', text: 'strong' },
                { key: 'b', text: 'weak' },
                { key: 'c', text: 'short' },
                { key: 'd', text: 'thin' },
              ],
              answer: 'a',
            },
            {
              id: 'k4-bc-3',
              prompt: '3. The Greeks made a ____________ horse.',
              options: [
                { key: 'a', text: 'stone' },
                { key: 'b', text: 'brick' },
                { key: 'c', text: 'wooden' },
                { key: 'd', text: 'steel' },
              ],
              answer: 'c',
            },
            {
              id: 'k4-bc-4',
              prompt: '4. What problem did the Greeks have?',
              options: [
                { key: 'a', text: 'They did not have enough wood to build a horse.' },
                { key: 'b', text: 'They were not good builders.' },
                { key: 'c', text: 'They did not have enough soldiers.' },
                { key: 'd', text: 'They did not know how to get the horse into Troy.' },
              ],
              answer: 'd',
            },
            {
              id: 'k4-bc-5',
              prompt: '5. Who was going to tell the Trojans that the Greeks ran away?',
              options: [
                { key: 'a', text: 'Athena' },
                { key: 'b', text: 'Sinon' },
                { key: 'c', text: 'Paris' },
                { key: 'd', text: 'Ulysses' },
              ],
              answer: 'b',
            },
          ],
        },
      ],
    },
    {
      id: 'k4-middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pp. 12–17 · Workbook pp. 14–15',
      pdfPage: 13,
      activities: [
        {
          kind: 'true-false',
          id: 'k4-mid-a',
          badge: 'Middle A · p. 14',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k4-ma-1', statement: '1. The Trojans thought the Greeks left.', answer: 'T' },
            { id: 'k4-ma-2', statement: '2. The Trojans knew the Greeks’ plan.', answer: 'F' },
            { id: 'k4-ma-3', statement: '3. The Trojans believed Sinon.', answer: 'T' },
            { id: 'k4-ma-4', statement: '4. The Trojans helped the Greeks get into Troy.', answer: 'T' },
            { id: 'k4-ma-5', statement: '5. The Greeks celebrated the end of the war.', answer: 'F' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k4-mid-b',
          badge: 'Middle B · p. 14',
          title: 'Match the Two Parts of the Sentence',
          instruction: 'Match each sentence beginning (1–4) with the right ending (a–d).',
          scene: 'Sentence endings:',
          options: [
            { key: 'a', text: 'to pull the wooden horse into the city.' },
            { key: 'b', text: 'give the horse to Athena.' },
            { key: 'c', text: 'sailed away.' },
            { key: 'd', text: 'the Greeks’ empty tents.' },
          ],
          items: [
            { id: 'k4-mb-1', question: '1. The other Greek soldiers …', answer: 'c' },
            { id: 'k4-mb-2', question: '2. The Trojans saw …', answer: 'd' },
            { id: 'k4-mb-3', question: '3. The Trojans used ropes …', answer: 'a' },
            { id: 'k4-mb-4', question: '4. Sinon told the Trojans to …', answer: 'b' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k4-mid-c',
          badge: 'Middle C · p. 15',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k4-mc-1',
              prompt: '1. The ____________ hid inside the wooden horse.',
              options: [
                { key: 'a', text: 'kings' },
                { key: 'b', text: 'Trojans' },
                { key: 'c', text: 'gods' },
                { key: 'd', text: 'soldiers' },
              ],
              answer: 'd',
            },
            {
              id: 'k4-mc-2',
              prompt: '2. King Priam ____________ at the wooden horse.',
              options: [
                { key: 'a', text: 'laughed' },
                { key: 'b', text: 'pointed' },
                { key: 'c', text: 'yelled' },
                { key: 'd', text: 'shot' },
              ],
              answer: 'b',
            },
            {
              id: 'k4-mc-3',
              prompt: '3. The Trojans drank ____________.',
              options: [
                { key: 'a', text: 'water' },
                { key: 'b', text: 'milk' },
                { key: 'c', text: 'soda' },
                { key: 'd', text: 'wine' },
              ],
              answer: 'd',
            },
            {
              id: 'k4-mc-4',
              prompt: '4. Why did the Trojans celebrate?',
              options: [
                { key: 'a', text: 'It was the king’s birthday.' },
                { key: 'b', text: 'They got into the Greek city.' },
                { key: 'c', text: 'They thought the war was over.' },
                { key: 'd', text: 'They wanted to make Athena happy.' },
              ],
              answer: 'c',
            },
            {
              id: 'k4-mc-5',
              prompt: '5. What did the Trojans do after they celebrated?',
              options: [
                { key: 'a', text: 'They opened the city gates.' },
                { key: 'b', text: 'They went to sleep.' },
                { key: 'c', text: 'They kept watch for the Greeks.' },
                { key: 'd', text: 'They burned the wooden horse.' },
              ],
              answer: 'b',
            },
          ],
        },
      ],
    },
    {
      id: 'k4-end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pp. 18–22 · Workbook pp. 16–17',
      pdfPage: 15,
      activities: [
        {
          kind: 'true-false',
          id: 'k4-end-a',
          badge: 'End A · p. 16',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k4-ea-1', statement: '1. The Greek boats did not return.', answer: 'F' },
            { id: 'k4-ea-2', statement: '2. Sinon did not help the Greeks.', answer: 'F' },
            { id: 'k4-ea-3', statement: '3. Many people died.', answer: 'T' },
            { id: 'k4-ea-4', statement: '4. The Greeks killed Helen.', answer: 'F' },
            { id: 'k4-ea-5', statement: '5. No Trojans escaped from Troy.', answer: 'F' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k4-end-b',
          badge: 'End B · p. 16',
          title: 'Match the Questions and Answers',
          instruction: 'Scene: A Trojan warrior stands on a hill with an old man and a young boy, looking back at smoke rising from Troy.',
          scene: 'Answer choices:',
          options: [
            { key: 'a', text: 'They are watching Troy burn.' },
            { key: 'b', text: 'They are on a hill outside of Troy.' },
            { key: 'c', text: 'His son and father are with him.' },
            { key: 'd', text: 'He is a Trojan named Aeneas.' },
          ],
          items: [
            { id: 'k4-eb-1', question: '1. Who is he?', answer: 'd' },
            { id: 'k4-eb-2', question: '2. Who is with him?', answer: 'c' },
            { id: 'k4-eb-3', question: '3. Where are they?', answer: 'b' },
            { id: 'k4-eb-4', question: '4. What are they doing?', answer: 'a' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k4-end-c',
          badge: 'End C · p. 17',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k4-ec-1',
              prompt: '1. The Greek soldiers opened the city ____________.',
              options: [
                { key: 'a', text: 'walls' },
                { key: 'b', text: 'streets' },
                { key: 'c', text: 'gates' },
                { key: 'd', text: 'boats' },
              ],
              answer: 'c',
            },
            {
              id: 'k4-ec-2',
              prompt: '2. Aeneas’s ____________ died in Troy.',
              options: [
                { key: 'a', text: 'mother' },
                { key: 'b', text: 'sister' },
                { key: 'c', text: 'wife' },
                { key: 'd', text: 'brother' },
              ],
              answer: 'c',
            },
            {
              id: 'k4-ec-3',
              prompt: '3. A wooden horse ended the ____________.',
              options: [
                { key: 'a', text: 'fire' },
                { key: 'b', text: 'war' },
                { key: 'c', text: 'king' },
                { key: 'd', text: 'soldier' },
              ],
              answer: 'b',
            },
            {
              id: 'k4-ec-4',
              prompt: '4. Who let the Greek soldiers out of the horse?',
              options: [
                { key: 'a', text: 'Sinon' },
                { key: 'b', text: 'King Menelaus' },
                { key: 'c', text: 'Ulysses' },
                { key: 'd', text: 'Helen' },
              ],
              answer: 'a',
            },
            {
              id: 'k4-ec-5',
              prompt: '5. What did the Greeks do to Troy?',
              options: [
                { key: 'a', text: 'They rebuilt it.' },
                { key: 'b', text: 'They made it the home of their king.' },
                { key: 'c', text: 'They tore it down.' },
                { key: 'd', text: 'They burned it.' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'k4-think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Workbook pp. 18–19 · Problem & Solution chart + vocabulary fill-in',
      pdfPage: 17,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k4-think',
          badge: 'Think and Write · p. 18',
          title: 'Problem & Solution Chart',
          instruction: 'Fill in every blank in the Problem → Solution chart using the words from the box.',
          leftLabel: 'Problem',
          rightLabel: 'Solution',
          wordBank: ['attacked', 'horse', 'gift', 'marry', 'burned', 'wife', 'Greeks', 'wooden', 'escaped', 'helped'],
          rows: [
            {
              id: 'k4-tw-r1',
              cause: ['Paris wanted to ', { id: 'k4-tw-1', answer: 'marry' }, ' the most beautiful woman.'],
              effect: ['Aphrodite ', { id: 'k4-tw-2', answer: 'helped' }, ' him get Helen.'],
            },
            {
              id: 'k4-tw-r2',
              cause: ['King Menelaus wanted his ', { id: 'k4-tw-3', answer: 'wife' }, ' back.'],
              effect: ['The Greeks ', { id: 'k4-tw-4', answer: 'attacked' }, ' Troy and fought the Trojans for many years.'],
            },
            {
              id: 'k4-tw-r3',
              cause: ['The ', { id: 'k4-tw-5', answer: 'Greeks' }, ' could not get into Troy.'],
              effect: ['They built a ', { id: 'k4-tw-6', answer: 'wooden' }, ' horse to hide inside.'],
            },
            {
              id: 'k4-tw-r4',
              cause: ['The Greeks needed to get the ', { id: 'k4-tw-7', answer: 'horse' }, ' into Troy.'],
              effect: ['They pretended to leave, and Sinon said the horse was a ', { id: 'k4-tw-8', answer: 'gift' }, ' for Athena.'],
            },
            {
              id: 'k4-tw-r5',
              cause: ['The Greeks ', { id: 'k4-tw-9', answer: 'burned' }, ' Troy.'],
              effect: ['Aeneas ', { id: 'k4-tw-10', answer: 'escaped' }, ' with his father and son.'],
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k4-vocab-review',
          badge: 'Vocabulary Review · p. 19',
          title: 'Fill in the Blanks (2 Extra Words)',
          instruction: 'Complete each sentence with the right word from the box. Two words in the box are not used.',
          wordBank: [
            'war', 'cheered', 'wall', 'empty', 'guards', 'boats',
            'pointed', 'wooden', 'wife', 'returned', 'pulled', 'prince',
          ],
          items: [
            { id: 'k4-vr-1', prefix: 'Paris was a', suffix: '.', answer: 'prince' },
            { id: 'k4-vr-2', prefix: 'There was a strong', suffix: 'around Troy.', answer: 'wall' },
            { id: 'k4-vr-3', prefix: 'The', suffix: 'lasted for ten years.', answer: 'war' },
            { id: 'k4-vr-4', prefix: 'The Greeks built a', suffix: 'horse.', answer: 'wooden' },
            { id: 'k4-vr-5', prefix: 'The Greeks sailed away in their', suffix: '.', answer: 'boats' },
            { id: 'k4-vr-6', prefix: 'The tents were', suffix: '.', answer: 'empty' },
            { id: 'k4-vr-7', prefix: 'The Trojans', suffix: 'the horse into the city.', answer: 'pulled' },
            { id: 'k4-vr-8', prefix: 'The Trojans', suffix: 'and danced.', answer: 'cheered' },
            { id: 'k4-vr-9', prefix: 'The', suffix: 'went to sleep.', answer: 'guards' },
            { id: 'k4-vr-10', prefix: 'The Greeks', suffix: 'and entered the city.', answer: 'returned' },
          ],
        },
      ],
    },
    {
      id: 'k4-summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary & Book Report',
      subtitle: 'Workbook pp. 20–21 · Story order + printable Book Report',
      pdfPage: 19,
      activities: [
        {
          kind: 'sequence',
          id: 'k4-summary',
          badge: 'Summary A · p. 20',
          title: 'What Is First? What Is Last? (1–4)',
          instruction: 'Number the four scenes from 1 (first) to 4 (last).',
          count: 4,
          items: [
            { id: 'k4-sum-1', badge: 'Scene A', text: 'The Trojans pulled the wooden horse into Troy.', answer: 3 },
            { id: 'k4-sum-2', badge: 'Scene B', text: 'The strong wall kept the Greeks out of Troy.', answer: 1 },
            { id: 'k4-sum-3', badge: 'Scene C', text: 'The Greeks built a wooden horse.', answer: 2 },
            { id: 'k4-sum-4', badge: 'Scene D', text: 'Aeneas escaped Troy with his father and son.', answer: 4 },
          ],
        },
        {
          kind: 'sequence',
          id: 'k4-plot',
          badge: 'Book Report · p. 21',
          title: 'Story — Put the Sentences in the Correct Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange sentences a–e from beginning to end.',
          count: 5,
          items: [
            { id: 'k4-pl-a', badge: 'a', text: 'The Greeks tricked the Trojans.', answer: 3 },
            { id: 'k4-pl-b', badge: 'b', text: 'King Menelaus wanted his wife back.', answer: 2 },
            { id: 'k4-pl-c', badge: 'c', text: 'The Greeks burned Troy and took Helen.', answer: 4 },
            { id: 'k4-pl-d', badge: 'd', text: 'Aeneas escaped from Troy.', answer: 5 },
            { id: 'k4-pl-e', badge: 'e', text: 'Paris wanted to marry King Menelaus’s wife.', answer: 1 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k4-report',
          badge: 'My Book Report · p. 21',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character, lesson learned, and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'The Trojan Horse',
          defaultAuthor: 'Virgil',
          characterChoices: ['Aeneas', 'Ulysses', 'Athena', 'Helen', 'Paris', 'King Priam', 'Sinon'],
        },
      ],
    },
  ],
};

// ── Kid 5: Daedalus and Icarus ───────────────────────────────────────────────

const KID_5_DAEDALUS_AND_ICARUS: ReaderWorkbookMeta = {
  id: 'kid-5-daedalus-and-icarus',
  gradeNumber: 5,
  gradeLabel: 'Kid 5',
  seriesLabel: 'Young Learners Classic Readers 3-4',
  title: 'Daedalus and Icarus',
  author: 'Ovid',
  cover: './library/covers/kid-5-daedalus-and-icarus.jpg',
  bookHref: '#library/kid-5-daedalus-and-icarus',
  workbookHref: '#library/kid-5-daedalus-and-icarus/workbook',
  drillSlug: 'reader-kid5-daedalus-and-icarus',
  drillTitle: 'Kid 5 · Daedalus and Icarus — Workbook',
  tagline: 'Characters, "How will it help us…?" pattern practice, 10×10 word search, comprehension, cause & effect, and book report.',
  skills: ['Word Search', 'Comprehension', 'Cause & Effect', 'Book Report'],
  accent: 'rose',
  sections: [
    {
      id: 'k5-story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Workbook pp. 4–8 · Introduction, Characters, Mini Quiz, Pattern Practice & Challenge',
      pdfPage: 4,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k5-characters',
          badge: 'Before You Read · p. 4',
          title: 'Characters — Describe Each Character',
          instruction: 'Choose the best word from the box for each character clue.',
          wordBank: ['young', 'old', 'brave', 'mean', 'inventor', 'smart', 'evil', 'curious'],
          items: [
            { id: 'k5-ch-1', label: 'Daedalus', prefix: 'His job — he designed the labyrinth and made wings:', answer: 'inventor' },
            { id: 'k5-ch-2', label: 'Daedalus', prefix: 'His mind — he was clever and full of bright ideas:', answer: 'smart' },
            { id: 'k5-ch-3', label: 'Daedalus', prefix: 'His age compared to his son Icarus:', answer: 'old' },
            { id: 'k5-ch-4', label: 'Icarus', prefix: 'His age — Daedalus’s boy son:', answer: 'young' },
            { id: 'k5-ch-5', label: 'Icarus', prefix: 'Wanted to explore higher and see what was in the sky:', answer: 'curious' },
            { id: 'k5-ch-6', label: 'Icarus', prefix: 'Not afraid to leap off the island and fly:', answer: 'brave' },
            { id: 'k5-ch-7', label: 'King Minos', prefix: 'Unkind — refused to let Daedalus and Icarus go home:', answer: 'mean' },
            { id: 'k5-ch-8', label: 'King Minos', prefix: 'Cruel and wicked ruler of Crete:', answer: 'evil' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k5-intro-open',
          badge: 'Introduction · p. 4 (Optional)',
          title: 'About the Author & Greek Myths',
          instruction: 'Answer in complete sentences (saved on your device for class discussion).',
          prompts: [
            { id: 'k5-in-1', label: '1. Where was the writer from?', placeholder: 'He was from…' },
            { id: 'k5-in-2', label: '2. How long ago did the writer live?', placeholder: 'He lived…' },
            { id: 'k5-in-3', label: '3. What are Greek myths about?', placeholder: 'They are about…' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k5-mini-quiz',
          badge: 'While You Read · p. 6',
          title: 'Mini Quiz!',
          instruction: 'Choose the best lesson for the story.',
          items: [
            {
              id: 'k5-mq-1',
              prompt: 'What is the lesson of the story? Choose the best answer.',
              options: [
                { key: 'a', text: 'Hatred is as blind as love.' },
                { key: 'b', text: 'Listen to advice and accept instruction.' },
                { key: 'c', text: 'When the cat is away, the mice will play.' },
              ],
              answer: 'b',
            },
          ],
        },
        {
          kind: 'multi-blank',
          id: 'k5-pattern',
          badge: 'After You Read · p. 7',
          title: 'Pattern Practice: How will it help us … ?',
          instruction: 'Example — A: "How will it help us to escape?" · B: "We will fly like birds." Complete each dialogue using the words from the box.',
          wordBank: ['cross', 'go fast', 'rest', 'be free', 'cheetahs', 'fish', 'island', 'baby'],
          sentences: [
            {
              id: 'k5-pat-s1',
              scene: 'Dialogue 1 — Running quickly across the land',
              parts: ['A: How will it help us to ', { id: 'k5-pat-1a', answer: 'go fast' }, '? — B: We will run like ', { id: 'k5-pat-1b', answer: 'cheetahs' }, '.'],
            },
            {
              id: 'k5-pat-s2',
              scene: 'Dialogue 2 — Getting to the other side of the sea',
              parts: ['A: How will it help us to ', { id: 'k5-pat-2a', answer: 'cross' }, ' the ocean? — B: We will swim like ', { id: 'k5-pat-2b', answer: 'fish' }, '.'],
            },
            {
              id: 'k5-pat-s3',
              scene: 'Dialogue 3 — Escaping into the open sky',
              parts: ['A: How will it help us to ', { id: 'k5-pat-3', answer: 'be free' }, '? — B: We will fly away like birds.'],
            },
            {
              id: 'k5-pat-s4',
              scene: 'Dialogue 4 — Getting a peaceful night of sleep',
              parts: ['A: How will it help us to ', { id: 'k5-pat-4a', answer: 'rest' }, '? — B: We will sleep like a ', { id: 'k5-pat-4b', answer: 'baby' }, '.'],
            },
            {
              id: 'k5-pat-s5',
              scene: 'Dialogue 5 — Getting off land surrounded by water',
              parts: ['A: How will it help us to leave the ', { id: 'k5-pat-5', answer: 'island' }, '? — B: We will sail away in a boat.'],
            },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k5-challenge',
          badge: 'Challenge · p. 8 (Optional)',
          title: 'Imagine You Are Trapped on an Island',
          instruction: 'Imagine you are trapped on an island by a mean king, and you want to escape. Write your plan in complete sentences.',
          prompts: [
            { id: 'k5-cal-1', label: '1. How will you escape?', placeholder: 'I will…' },
            { id: 'k5-cal-2', label: '2. What will you use?', placeholder: 'I will use…' },
            { id: 'k5-cal-3', label: '3. How will you avoid getting caught?', placeholder: 'I will…' },
            { id: 'k5-cal-4', label: '4. What will you take with you?', placeholder: 'I will take…' },
          ],
        },
      ],
    },
    {
      id: 'k5-vocab',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Workbook pp. 10–11 · 10×10 Word Search & word choice',
      pdfPage: 9,
      activities: [
        {
          kind: 'word-search',
          id: 'k5-vocab-a',
          badge: 'Vocabulary A · p. 10',
          title: 'Find All 6 Story Words in the 10×10 Puzzle',
          instruction: 'Tap the first letter and last letter of each hidden word in the grid (across, down, or diagonal), or type the word beside its clue.',
          grid: [
            'elabrivsce',
            'fsehtribha',
            'atinventor',
            'crefaoniem',
            'wilreitosj',
            'cniarasscp',
            'rgcyhetyak',
            'gebgrwahpw',
            'warningoea',
            'labvspounr',
          ],
          words: [
            { id: 'k5-ws-1', number: 1, clue: 'Soft, light thing that covers a bird’s wing', answer: 'feather', start: [3, 3], end: [9, 9] },
            { id: 'k5-ws-2', number: 2, clue: 'A giant maze of walls and paths that is hard to leave', answer: 'labyrinth', start: [9, 0], end: [1, 8] },
            { id: 'k5-ws-3', number: 3, clue: 'A clever person who designs and makes new things', answer: 'inventor', start: [2, 2], end: [2, 9] },
            { id: 'k5-ws-4', number: 4, clue: 'Thin cord rolled into a ball, used for tying feathers', answer: 'string', start: [1, 1], end: [6, 1] },
            { id: 'k5-ws-5', number: 5, clue: 'Words or a sign that tell you about danger ahead', answer: 'warning', start: [8, 0], end: [8, 6] },
            { id: 'k5-ws-6', number: 6, clue: 'To get away safely from a prison or island', answer: 'escape', start: [3, 8], end: [8, 8] },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k5-vocab-b',
          badge: 'Vocabulary B · p. 11',
          title: 'Choose the Best Answer',
          instruction: 'Tap the word that completes each sentence.',
          items: [
            { id: 'k5-vb-1', prefix: 'They could not leave the', options: ['frame', 'island'], answer: 'island', suffix: '.', hint: 'Small piece of land with a palm tree surrounded by sea' },
            { id: 'k5-vb-2', prefix: 'The', options: ['wax', 'feather'], answer: 'wax', suffix: 'is melting.', hint: 'Lit candle dripping down the side' },
            { id: 'k5-vb-3', prefix: 'Follow the', options: ['path', 'labyrinth'], answer: 'path', suffix: 'to my house.', hint: 'Winding trail leading through the trees' },
            { id: 'k5-vb-4', prefix: 'He is in', options: ['prison', 'pot'], answer: 'prison', suffix: 'because he is bad.', hint: 'Man holding metal bars inside a locked cell' },
            { id: 'k5-vb-5', prefix: 'It will', options: ['remove', 'melt'], answer: 'melt', suffix: 'in the sun.', hint: 'Ice cream cone dripping on a hot day' },
            { id: 'k5-vb-6', prefix: 'The Minotaur was half', options: ['bull', 'inventor'], answer: 'bull', suffix: '.', hint: 'Strong farm animal with two horns' },
            { id: 'k5-vb-7', prefix: 'She wants the apples', options: ['suddenly', 'above'], answer: 'above', suffix: 'her head.', hint: 'Girl looking up at fruit high in a tree' },
          ],
        },
      ],
    },
    {
      id: 'k5-beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pp. 6–11 · Workbook pp. 12–13',
      pdfPage: 11,
      activities: [
        {
          kind: 'true-false',
          id: 'k5-beg-a',
          badge: 'Beginning A · p. 12',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k5-ba-1', statement: '1. King Minos told Daedalus he could leave Crete.', answer: 'F' },
            { id: 'k5-ba-2', statement: '2. Daedalus’s son was part bird.', answer: 'F' },
            { id: 'k5-ba-3', statement: '3. Daedalus was building a boat.', answer: 'F' },
            { id: 'k5-ba-4', statement: '4. Icarus put lots of feathers into a bag.', answer: 'T' },
            { id: 'k5-ba-5', statement: '5. Daedalus and Icarus wanted to leave the island forever.', answer: 'T' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k5-beg-b',
          badge: 'Beginning B · p. 12',
          title: 'Who’s Who? Write the Names',
          instruction: 'Choose the character who matches each sentence.',
          wordBank: ['King Minos', 'Minotaur', 'Daedalus', 'Icarus'],
          items: [
            { id: 'k5-bb-1', prefix: 'He was the son of an inventor.', answer: 'Icarus' },
            { id: 'k5-bb-2', prefix: 'He was part man and part animal.', answer: 'Minotaur' },
            { id: 'k5-bb-3', prefix: 'He made a labyrinth.', answer: 'Daedalus' },
            { id: 'k5-bb-4', prefix: 'He kept his son in a prison.', answer: 'King Minos' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k5-beg-c',
          badge: 'Beginning C · p. 13',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k5-bc-1',
              prompt: '1. What was strange about the king’s son?',
              options: [
                { key: 'a', text: 'He was half bird.' },
                { key: 'b', text: 'He was half lion.' },
                { key: 'c', text: 'He was half bull.' },
                { key: 'd', text: 'He was half fish.' },
              ],
              answer: 'c',
            },
            {
              id: 'k5-bc-2',
              prompt: '2. Why was it difficult for the Minotaur to escape from the prison?',
              options: [
                { key: 'a', text: 'It had many walls and doors.' },
                { key: 'b', text: 'It had many locks.' },
                { key: 'c', text: 'It was very dark.' },
                { key: 'd', text: 'There were many guards.' },
              ],
              answer: 'a',
            },
            {
              id: 'k5-bc-3',
              prompt: '3. What was Daedalus making?',
              options: [
                { key: 'a', text: 'He was making feathers.' },
                { key: 'b', text: 'He was making labyrinths.' },
                { key: 'c', text: 'He was making kites.' },
                { key: 'd', text: 'He was making wings.' },
              ],
              answer: 'd',
            },
            {
              id: 'k5-bc-4',
              prompt: '4. Why would King Minos NOT let Daedalus and Icarus leave Crete?',
              options: [
                { key: 'a', text: 'Daedalus would tell others about his son.' },
                { key: 'b', text: 'Daedalus knew the secret of the prison.' },
                { key: 'c', text: 'Daedalus would not come back.' },
                { key: 'd', text: 'Daedalus and Icarus were the only other men on the island.' },
              ],
              answer: 'b',
            },
            {
              id: 'k5-bc-5',
              prompt: '5. How did Daedalus plan to escape Crete?',
              options: [
                { key: 'a', text: 'He was going to kill the king.' },
                { key: 'b', text: 'He was going to fly.' },
                { key: 'c', text: 'He was going to act like he was dead.' },
                { key: 'd', text: 'He was going to use the Minotaur.' },
              ],
              answer: 'b',
            },
          ],
        },
      ],
    },
    {
      id: 'k5-middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pp. 12–17 · Workbook pp. 14–15',
      pdfPage: 13,
      activities: [
        {
          kind: 'true-false',
          id: 'k5-mid-a',
          badge: 'Middle A · p. 14',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k5-ma-1', statement: '1. They could fly as high or as low as they wanted.', answer: 'F' },
            { id: 'k5-ma-2', statement: '2. The middle path was the safest.', answer: 'T' },
            { id: 'k5-ma-3', statement: '3. Flying seemed like magic to Daedalus.', answer: 'F' },
            { id: 'k5-ma-4', statement: '4. Icarus said he would follow his father’s instructions.', answer: 'T' },
            { id: 'k5-ma-5', statement: '5. The feathers were held together with wax and string.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k5-mid-b',
          badge: 'Middle B · p. 14',
          title: 'Match the Two Parts of the Sentence',
          instruction: 'Match each sentence beginning (1–4) with the right ending (a–d).',
          scene: 'Sentence endings:',
          options: [
            { key: 'a', text: 'they would drown.' },
            { key: 'b', text: 'their arms like birds.' },
            { key: 'c', text: 'the wings to Icarus.' },
            { key: 'd', text: 'to the frames.' },
          ],
          items: [
            { id: 'k5-mb-1', question: '1. They moved …', answer: 'b' },
            { id: 'k5-mb-2', question: '2. If they flew too low, …', answer: 'a' },
            { id: 'k5-mb-3', question: '3. They tied feathers …', answer: 'd' },
            { id: 'k5-mb-4', question: '4. Daedalus showed …', answer: 'c' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k5-mid-c',
          badge: 'Middle C · p. 15',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k5-mc-1',
              prompt: '1. What was under the cover?',
              options: [
                { key: 'a', text: 'The Minotaur' },
                { key: 'b', text: 'Wings' },
                { key: 'c', text: 'Birds' },
                { key: 'd', text: 'Wax' },
              ],
              answer: 'b',
            },
            {
              id: 'k5-mc-2',
              prompt: '2. How did Daedalus attach the wings to his body?',
              options: [
                { key: 'a', text: 'He glued them to his arms.' },
                { key: 'b', text: 'He used wax to melt them to his arms.' },
                { key: 'c', text: 'He tied them to his arms.' },
                { key: 'd', text: 'He taped them to his arms.' },
              ],
              answer: 'c',
            },
            {
              id: 'k5-mc-3',
              prompt: '3. What path did Daedalus tell Icarus to take?',
              options: [
                { key: 'a', text: 'The high path' },
                { key: 'b', text: 'The middle path' },
                { key: 'c', text: 'The low path' },
                { key: 'd', text: 'The short path' },
              ],
              answer: 'b',
            },
            {
              id: 'k5-mc-4',
              prompt: '4. What would happen if they lost the big feathers?',
              options: [
                { key: 'a', text: 'They would fly higher.' },
                { key: 'b', text: 'The king would find them.' },
                { key: 'c', text: 'They would go faster.' },
                { key: 'd', text: 'They would die.' },
              ],
              answer: 'd',
            },
            {
              id: 'k5-mc-5',
              prompt: '5. What would happen if they flew too low?',
              options: [
                { key: 'a', text: 'The waves would knock them into the ocean.' },
                { key: 'b', text: 'The sharks would eat them.' },
                { key: 'c', text: 'The king would see them.' },
                { key: 'd', text: 'The water would make them very cold.' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },
    {
      id: 'k5-end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pp. 18–22 · Workbook pp. 16–17',
      pdfPage: 15,
      activities: [
        {
          kind: 'true-false',
          id: 'k5-end-a',
          badge: 'End A · p. 16',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k5-ea-1', statement: '1. Icarus was scared of flying.', answer: 'F' },
            { id: 'k5-ea-2', statement: '2. Icarus heard his father calling to him.', answer: 'F' },
            { id: 'k5-ea-3', statement: '3. Icarus tried to come down.', answer: 'F' },
            { id: 'k5-ea-4', statement: '4. The sun ruined Icarus’s wings.', answer: 'T' },
            { id: 'k5-ea-5', statement: '5. Daedalus could not help his son.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k5-end-b',
          badge: 'End B · p. 16',
          title: 'Match the Questions and Answers',
          instruction: 'Scene: Icarus spreads his feathered wings right beneath the hot, blazing sun high in the sky.',
          scene: 'Answer choices:',
          options: [
            { key: 'a', text: 'He is too high in the sky.' },
            { key: 'b', text: 'He is flying like a bird.' },
            { key: 'c', text: 'His wings are going to fall apart.' },
            { key: 'd', text: 'He is going away from the island.' },
          ],
          items: [
            { id: 'k5-eb-1', question: '1. What is Icarus doing?', answer: 'b' },
            { id: 'k5-eb-2', question: '2. Where is Icarus going?', answer: 'd' },
            { id: 'k5-eb-3', question: '3. What is wrong?', answer: 'a' },
            { id: 'k5-eb-4', question: '4. What is going to happen?', answer: 'c' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k5-end-c',
          badge: 'End C · p. 17',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k5-ec-1',
              prompt: '1. What did Icarus forget?',
              options: [
                { key: 'a', text: 'His shoes' },
                { key: 'b', text: 'His money' },
                { key: 'c', text: 'His father’s warning' },
                { key: 'd', text: 'His father’s string' },
              ],
              answer: 'c',
            },
            {
              id: 'k5-ec-2',
              prompt: '2. What did Icarus do wrong?',
              options: [
                { key: 'a', text: 'He flew too low.' },
                { key: 'b', text: 'He flew too high.' },
                { key: 'c', text: 'He flew over the labyrinth.' },
                { key: 'd', text: 'He tried to carry too much weight.' },
              ],
              answer: 'b',
            },
            {
              id: 'k5-ec-3',
              prompt: '3. Why could Icarus NOT fly any longer?',
              options: [
                { key: 'a', text: 'The wings could not support him.' },
                { key: 'b', text: 'He was too tired.' },
                { key: 'c', text: 'He was too hot.' },
                { key: 'd', text: 'The frames of his wings broke.' },
              ],
              answer: 'a',
            },
            {
              id: 'k5-ec-4',
              prompt: '4. What did Icarus do as he fell?',
              options: [
                { key: 'a', text: 'He untied the frames.' },
                { key: 'b', text: 'He closed his eyes.' },
                { key: 'c', text: 'He asked his father for help.' },
                { key: 'd', text: 'He fainted.' },
              ],
              answer: 'c',
            },
            {
              id: 'k5-ec-5',
              prompt: '5. What is the name of the sea where Icarus died?',
              options: [
                { key: 'a', text: 'The Adriatic Sea' },
                { key: 'b', text: 'The Mediterranean Sea' },
                { key: 'c', text: 'The Black Sea' },
                { key: 'd', text: 'The Icarian Sea' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'k5-think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Workbook pp. 18–19 · Cause & Effect chart + vocabulary choice',
      pdfPage: 17,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k5-think',
          badge: 'Think and Write · p. 18',
          title: 'Cause & Effect Chart',
          instruction: 'Fill in every blank in the Cause → Effect chart using the words from the box.',
          wordBank: ['sea', 'help', 'dangerous', 'support', 'wax', 'Crete', 'sun', 'heart', 'prison', 'labyrinth'],
          rows: [
            {
              id: 'k5-tw-r1',
              cause: ['The Minotaur was ', { id: 'k5-tw-1', answer: 'dangerous' }, '.'],
              effect: ['King Minos kept him in a ', { id: 'k5-tw-2', answer: 'prison' }, '.'],
            },
            {
              id: 'k5-tw-r2',
              cause: ['Daedalus made the ', { id: 'k5-tw-3', answer: 'labyrinth' }, '.'],
              effect: ['King Minos would not let him leave ', { id: 'k5-tw-4', answer: 'Crete' }, '.'],
            },
            {
              id: 'k5-tw-r3',
              cause: ['Icarus flew too close to the ', { id: 'k5-tw-5', answer: 'sun' }, '.'],
              effect: ['The sun melted the ', { id: 'k5-tw-6', answer: 'wax' }, ', and his wings fell apart.'],
            },
            {
              id: 'k5-tw-r4',
              cause: ['The wings could not ', { id: 'k5-tw-7', answer: 'support' }, ' Icarus.'],
              effect: ['He fell into the ', { id: 'k5-tw-8', answer: 'sea' }, ' and died.'],
            },
            {
              id: 'k5-tw-r5',
              cause: ['Daedalus could not ', { id: 'k5-tw-9', answer: 'help' }, ' his son.'],
              effect: ['He kept flying with a broken ', { id: 'k5-tw-10', answer: 'heart' }, '.'],
            },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k5-vocab-review',
          badge: 'Vocabulary Review · p. 19',
          title: 'Choose the Correct Word',
          instruction: 'Tap the right word to complete each story sentence.',
          items: [
            { id: 'k5-vr-1', prefix: 'The wings could not', options: ['support', 'catch'], answer: 'support', suffix: 'Icarus.', hint: 'Feathers falling as Icarus drops toward the sea' },
            { id: 'k5-vr-2', prefix: 'Daedalus pulled a', options: ['frame', 'feather'], answer: 'feather', suffix: 'out of the bag.', hint: 'Daedalus holding up a single bird feather to Icarus' },
            { id: 'k5-vr-3', prefix: 'Daedalus saw Icarus flying', options: ['forever', 'above'], answer: 'above', suffix: 'him.', hint: 'Icarus high up toward the sun' },
            { id: 'k5-vr-4', prefix: 'Daedalus was', options: ['an inventor', 'a labyrinth'], answer: 'an inventor', suffix: '.', hint: 'Daedalus showing plans at a workshop table' },
            { id: 'k5-vr-5', prefix: 'Daedalus flew on with a broken', options: ['arm', 'heart'], answer: 'heart', suffix: '.', hint: 'Daedalus flying on alone in sorrow' },
            { id: 'k5-vr-6', prefix: 'Daedalus had a', options: ['pot', 'path'], answer: 'pot', suffix: 'of hot wax.', hint: 'Stirring melted wax over a small fire' },
            { id: 'k5-vr-7', prefix: 'Icarus forgot his father’s', options: ['warning', 'control'], answer: 'warning', suffix: '.', hint: 'Flying right up under the hot sun' },
            { id: 'k5-vr-8', prefix: 'Daedalus showed Icarus the', options: ['prisons', 'frames'], answer: 'frames', suffix: 'covered in feathers.', hint: 'Uncovering the pair of finished wings' },
            { id: 'k5-vr-9', prefix: 'Daedalus moved the', options: ['bulls', 'wings'], answer: 'wings', suffix: 'like a bird.', hint: 'Practising flapping the feathered wings' },
            { id: 'k5-vr-10', prefix: 'They were going to leave the', options: ['island', 'string'], answer: 'island', suffix: '.', hint: 'Standing together on the edge of Crete ready to fly' },
          ],
        },
      ],
    },
    {
      id: 'k5-summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary & Book Report',
      subtitle: 'Workbook pp. 20–21 · Story order + printable Book Report',
      pdfPage: 19,
      activities: [
        {
          kind: 'sequence',
          id: 'k5-summary-a',
          badge: 'Summary A · p. 20',
          title: 'Put the Sentences in the Correct Order (1–6)',
          instruction: 'Arrange sentences a–f from 1 (first) to 6 (last) between the opening and closing lines.',
          count: 6,
          leadSentence: 'Daedalus made a special prison for the Minotaur.',
          trailSentence: 'Today, the sea where Icarus died is called the Icarian Sea.',
          items: [
            { id: 'k5-sum-a', badge: 'a', text: 'Daedalus warned Icarus about flying too high or too low.', answer: 3 },
            { id: 'k5-sum-b', badge: 'b', text: 'Daedalus told Icarus about his plan to escape the island.', answer: 2 },
            { id: 'k5-sum-c', badge: 'c', text: 'Icarus flew too close to the sun.', answer: 4 },
            { id: 'k5-sum-d', badge: 'd', text: 'Daedalus continued on with a broken heart.', answer: 6 },
            { id: 'k5-sum-e', badge: 'e', text: 'Icarus fell into the sea and drowned.', answer: 5 },
            { id: 'k5-sum-f', badge: 'f', text: 'King Minos would not let Daedalus and Icarus leave Crete.', answer: 1 },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k5-summary-b',
          badge: 'Summary B · p. 20',
          title: 'Match Each Picture to Its Summary Sentence',
          instruction: 'Choose the sentence that matches each of the three story pictures.',
          scene: 'Summary sentences:',
          options: [
            { key: 'a', text: 'Daedalus warned Icarus about flying too high or too low.' },
            { key: 'd', text: 'Daedalus continued on with a broken heart.' },
            { key: 'e', text: 'Icarus fell into the sea and drowned.' },
          ],
          items: [
            { id: 'k5-sumb-1', question: '1. Picture 1 — Daedalus and Icarus stand on the cliff wearing their wings before takeoff.', answer: 'a' },
            { id: 'k5-sumb-2', question: '2. Picture 2 — Icarus tumbles downward toward the sea as feathers fly off his wings.', answer: 'e' },
            { id: 'k5-sumb-3', question: '3. Picture 3 — Daedalus flies on alone across the sky in sorrow.', answer: 'd' },
          ],
        },
        {
          kind: 'sequence',
          id: 'k5-plot',
          badge: 'Book Report · p. 21',
          title: 'Story — Put the Sentences in the Correct Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange sentences a–e from beginning to end.',
          count: 5,
          items: [
            { id: 'k5-pl-a', badge: 'a', text: 'Icarus helped Daedalus make more wings.', answer: 3 },
            { id: 'k5-pl-b', badge: 'b', text: 'Icarus’s wings fell apart, and he fell into sea.', answer: 5 },
            { id: 'k5-pl-c', badge: 'c', text: 'Daedalus invented a labyrinth for the Minotaur.', answer: 1 },
            { id: 'k5-pl-d', badge: 'd', text: 'Daedalus told Icarus how they would escape the island.', answer: 2 },
            { id: 'k5-pl-e', badge: 'e', text: 'The sun melted the wax on Icarus’s wings.', answer: 4 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k5-report',
          badge: 'My Book Report · p. 21',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character, lesson learned, and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'Daedalus and Icarus',
          defaultAuthor: 'Ovid',
          characterChoices: ['Daedalus', 'Icarus', 'King Minos', 'The Minotaur'],
        },
      ],
    },
  ],
};

// ── Kid 6: Heidi ─────────────────────────────────────────────────────────────

const KID_6_HEIDI: ReaderWorkbookMeta = {
  id: 'kid-6-heidi',
  gradeNumber: 6,
  gradeLabel: 'Kid 6',
  seriesLabel: 'Young Learners Classic Readers 3-7',
  title: 'Heidi',
  author: 'Johanna Spyri',
  cover: './library/covers/kid-6-heidi.jpg',
  bookHref: '#library/kid-6-heidi',
  workbookHref: '#library/kid-6-heidi/workbook',
  drillSlug: 'reader-kid6-heidi',
  drillTitle: 'Kid 6 · Heidi — Workbook',
  tagline: 'Characters, "will have to" pattern practice, 10×10 word search, comprehension, problem & solution, and book report.',
  skills: ['Word Search', 'Comprehension', 'Problem & Solution', 'Book Report'],
  accent: 'emerald',
  sections: [
    {
      id: 'k6-story-focus',
      shortTitle: 'Story Focus',
      title: 'Part A · Story Focus',
      subtitle: 'Workbook pp. 4–8 · Introduction, Characters, Mini Quiz, Pattern Practice & Challenge',
      pdfPage: 3,
      activities: [
        {
          kind: 'bank-fill',
          id: 'k6-characters',
          badge: 'Before You Read · p. 4',
          title: 'Characters — Who Is Each Character?',
          instruction: 'Choose two matching phrases from the box for Heidi, Peter, Klara, and Miss Rottenmeier.',
          wordBank: [
            'sat in a wheelchair',
            'pink cheeks',
            'strict',
            'looked after goats',
            'orphan',
            'looked after Klara',
            "Heidi's friend",
            'lived in a city',
          ],
          items: [
            { id: 'k6-ch-1', label: 'Heidi', prefix: 'Her parents died when she was a baby — she was an:', answer: 'orphan' },
            { id: 'k6-ch-2', label: 'Heidi', prefix: 'What her healthy face looked like in the mountains:', answer: 'pink cheeks' },
            { id: 'k6-ch-3', label: 'Peter', prefix: 'His daily job up on the mountain:', answer: 'looked after goats' },
            { id: 'k6-ch-4', label: 'Peter', prefix: 'Who he was to Heidi in the mountains:', answer: "Heidi's friend" },
            { id: 'k6-ch-5', label: 'Klara', prefix: 'How she moved around because she could not walk:', answer: 'sat in a wheelchair' },
            { id: 'k6-ch-6', label: 'Klara', prefix: 'Where her big mansion home was:', answer: 'lived in a city' },
            { id: 'k6-ch-7', label: 'Miss Rottenmeier', prefix: 'Her stern personality and many rules:', answer: 'strict' },
            { id: 'k6-ch-8', label: 'Miss Rottenmeier', prefix: 'Her job in the big city mansion:', answer: 'looked after Klara' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k6-intro-open',
          badge: 'Introduction · p. 4 (Optional)',
          title: 'About the Story & Setting',
          instruction: 'Answer in complete sentences (saved on your device for class discussion).',
          prompts: [
            { id: 'k6-in-1', label: '1. How many years ago was this story written?', placeholder: 'It was written…' },
            { id: 'k6-in-2', label: '2. Who did the author write this story for?', placeholder: 'She wrote it for…' },
            { id: 'k6-in-3', label: '3. What are the mountains in Switzerland called?', placeholder: 'They are called…' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k6-mini-quiz',
          badge: 'While You Read · p. 6',
          title: 'Mini Quiz!',
          instruction: 'Choose the best lesson for the story.',
          items: [
            {
              id: 'k6-mq-1',
              prompt: 'What is the lesson of the story? Choose the best answer.',
              options: [
                { key: 'a', text: 'Too many cooks spoil the broth.' },
                { key: 'b', text: 'Health is better than wealth.' },
                { key: 'c', text: 'Beauty is only skin deep.' },
              ],
              answer: 'b',
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k6-pattern',
          badge: 'After You Read · p. 7',
          title: 'Pattern Practice: will have to',
          instruction: 'Example — "Now Klara will have to go home!" Complete each sentence with a verb from the box.',
          wordBank: ['go', 'meet', 'learn', 'help', 'come', 'do', 'study', 'use'],
          items: [
            { id: 'k6-pat-1', prefix: 'She will have to', suffix: 'next spring!', answer: 'come' },
            { id: 'k6-pat-2', prefix: 'He will have to', suffix: 'my friends!', answer: 'meet' },
            { id: 'k6-pat-3', prefix: 'You will have to', suffix: 'to read!', answer: 'learn' },
            { id: 'k6-pat-4', prefix: 'Now Klara will have to', suffix: 'home!', answer: 'go' },
            { id: 'k6-pat-5', prefix: 'They will have to', suffix: 'their homework!', answer: 'do' },
            { id: 'k6-pat-6', prefix: 'We will have to', suffix: 'hard for the test!', answer: 'study' },
            { id: 'k6-pat-7', prefix: 'He will have to', suffix: 'his blind grandmother!', answer: 'help' },
            { id: 'k6-pat-8', prefix: 'She will have to', suffix: 'a wheelchair in the house!', answer: 'use' },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'k6-challenge',
          badge: 'Challenge · p. 8 (Optional)',
          title: 'Helping a Friend in a Wheelchair',
          instruction: 'Imagine you have a friend in a wheelchair and you want to help your friend. Answer in complete sentences.',
          prompts: [
            { id: 'k6-cal-1', label: '1. What will you do for fun?', placeholder: 'I will…' },
            { id: 'k6-cal-2', label: '2. What will you do to make your friend stronger?', placeholder: 'I will…' },
            { id: 'k6-cal-3', label: '3. What will you do if another friend wants to play with you?', placeholder: 'I will…' },
            { id: 'k6-cal-4', label: '4. What could your friend teach you?', placeholder: 'My friend could teach me…' },
          ],
        },
      ],
    },
    {
      id: 'k6-vocab',
      shortTitle: 'Vocabulary',
      title: 'Part B · Vocabulary Preview',
      subtitle: 'Workbook pp. 10–11 · 10×10 Word Search & word choice',
      pdfPage: 8,
      activities: [
        {
          kind: 'word-search',
          id: 'k6-vocab-a',
          badge: 'Vocabulary A · p. 10',
          title: 'Find All 6 Story Words in the 10×10 Puzzle',
          instruction: 'Tap the first letter and last letter of each hidden word in the grid (across, down, or diagonal), or type the word beside its clue.',
          grid: [
            'blighypblo',
            'difficultc',
            'sanmrafidm',
            'atelfronga',
            'djrskprden',
            'wouileffrs',
            'cdmwcnptai',
            'naughtymso',
            'blingesbin',
            'apcdarcafg',
          ],
          words: [
            { id: 'k6-ws-1', number: 1, clue: 'Not able to see (walking with dark glasses and a white cane)', answer: 'blind', start: [0, 7], end: [4, 7] },
            { id: 'k6-ws-2', number: 2, clue: 'Behaving badly, like drawing on the wall and getting in trouble', answer: 'naughty', start: [7, 0], end: [7, 6] },
            { id: 'k6-ws-3', number: 3, clue: 'Hard to do or understand, like a long math problem', answer: 'difficult', start: [1, 0], end: [1, 8] },
            { id: 'k6-ws-4', number: 4, clue: 'A very large, rich house', answer: 'mansion', start: [2, 9], end: [8, 9] },
            { id: 'k6-ws-5', number: 5, clue: 'Stern and demanding that every rule be obeyed', answer: 'strict', start: [2, 0], end: [7, 5] },
            { id: 'k6-ws-6', number: 6, clue: 'A person whose job is building and fixing things made of wood', answer: 'carpenter', start: [1, 5], end: [9, 5] },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k6-vocab-b',
          badge: 'Vocabulary B · p. 11',
          title: 'Choose the Best Answer',
          instruction: 'Tap the word that completes each sentence.',
          items: [
            { id: 'k6-vb-1', prefix: 'She is wearing a', options: ['shirt', 'shawl'], answer: 'shawl', suffix: '.', hint: 'Warm cloth wrapped over a woman’s shoulders' },
            { id: 'k6-vb-2', prefix: 'His friends are busy, so he is', options: ['scared', 'lonely'], answer: 'lonely', suffix: '.', hint: 'Sad child sitting by himself with nobody to play with' },
            { id: 'k6-vb-3', prefix: 'My friend uses a', options: ['wheelchair', 'mansion'], answer: 'wheelchair', suffix: '.', hint: 'Chair with large wheels for someone who cannot walk' },
            { id: 'k6-vb-4', prefix: 'She has pink', options: ['cheeks', 'steps'], answer: 'cheeks', suffix: '.', hint: 'Smiling girl with rosy circles on her face' },
            { id: 'k6-vb-5', prefix: '', options: ['Pale', 'Spring'], answer: 'Spring', suffix: 'is my favorite season.', hint: 'Warm meadow full of blooming flowers and butterflies' },
            { id: 'k6-vb-6', prefix: 'You need to', options: ['push', 'hurry'], answer: 'hurry', suffix: '!', hint: 'Boy running quickly so he will not be late' },
            { id: 'k6-vb-7', prefix: 'My ring is', options: ['shiny', 'pink'], answer: 'shiny', suffix: '.', hint: 'Bright, polished band gleaming in the light' },
          ],
        },
      ],
    },
    {
      id: 'k6-beginning',
      shortTitle: 'Beginning',
      title: 'Reading Comprehension · Beginning',
      subtitle: 'Story pp. 6–11 · Workbook pp. 12–13',
      pdfPage: 10,
      activities: [
        {
          kind: 'true-false',
          id: 'k6-beg-a',
          badge: 'Beginning A · p. 12',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k6-ba-1', statement: '1. Heidi’s parents died when she was five.', answer: 'F' },
            { id: 'k6-ba-2', statement: '2. Heidi lived with her grandmother.', answer: 'F' },
            { id: 'k6-ba-3', statement: '3. Peter was Heidi’s brother.', answer: 'F' },
            { id: 'k6-ba-4', statement: '4. Heidi loved living in the mountains.', answer: 'T' },
            { id: 'k6-ba-5', statement: '5. Heidi had to move to the city.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k6-beg-b',
          badge: 'Beginning B · p. 12',
          title: 'Match the Questions and Answers',
          instruction: 'Scene: Heidi stands happily outside a wooden mountain cabin beside a bearded old man and two goats.',
          scene: 'Answer choices:',
          options: [
            { key: 'a', text: 'They live in the mountains.' },
            { key: 'b', text: 'He is Heidi’s grandfather.' },
            { key: 'c', text: 'They give them milk.' },
            { key: 'd', text: 'They have two goats.' },
          ],
          items: [
            { id: 'k6-eb0-1', question: '1. Who is the old man?', answer: 'b' },
            { id: 'k6-eb0-2', question: '2. What animals do they have?', answer: 'd' },
            { id: 'k6-eb0-3', question: '3. Where do they live?', answer: 'a' },
            { id: 'k6-eb0-4', question: '4. What do the goats give them?', answer: 'c' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k6-beg-c',
          badge: 'Beginning C · p. 13',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k6-bc-1',
              prompt: '1. Who looked after Heidi when she was a baby?',
              options: [
                { key: 'a', text: 'Her parents' },
                { key: 'b', text: 'Her aunt' },
                { key: 'c', text: 'Her grandfather' },
                { key: 'd', text: 'Peter’s grandmother' },
              ],
              answer: 'b',
            },
            {
              id: 'k6-bc-2',
              prompt: '2. Who built Heidi’s grandfather’s house?',
              options: [
                { key: 'a', text: 'Peter' },
                { key: 'b', text: 'Heidi’s parents' },
                { key: 'c', text: 'Heidi’s grandfather' },
                { key: 'd', text: 'Heidi’s uncle' },
              ],
              answer: 'c',
            },
            {
              id: 'k6-bc-3',
              prompt: '3. What was Heidi’s bed made of?',
              options: [
                { key: 'a', text: 'Grass' },
                { key: 'b', text: 'Blankets' },
                { key: 'c', text: 'Feathers' },
                { key: 'd', text: 'Hay' },
              ],
              answer: 'd',
            },
            {
              id: 'k6-bc-4',
              prompt: '4. What did Heidi like to eat?',
              options: [
                { key: 'a', text: 'Goat cheese with bread' },
                { key: 'b', text: 'Soup and bread' },
                { key: 'c', text: 'Salad' },
                { key: 'd', text: 'Meat and potatoes' },
              ],
              answer: 'a',
            },
            {
              id: 'k6-bc-5',
              prompt: '5. How long did Heidi live with her grandfather?',
              options: [
                { key: 'a', text: 'One year' },
                { key: 'b', text: 'Three years' },
                { key: 'c', text: 'Five years' },
                { key: 'd', text: 'Eight years' },
              ],
              answer: 'b',
            },
          ],
        },
      ],
    },
    {
      id: 'k6-middle',
      shortTitle: 'Middle',
      title: 'Reading Comprehension · Middle',
      subtitle: 'Story pp. 12–19 · Workbook pp. 14–15',
      pdfPage: 12,
      activities: [
        {
          kind: 'true-false',
          id: 'k6-mid-a',
          badge: 'Middle A · p. 14',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k6-ma-1', statement: '1. Klara’s parents were dead.', answer: 'F' },
            { id: 'k6-ma-2', statement: '2. Heidi was scared of Miss Rottenmeier.', answer: 'T' },
            { id: 'k6-ma-3', statement: '3. Heidi missed the mountains.', answer: 'T' },
            { id: 'k6-ma-4', statement: '4. Miss Rottenmeier taught Heidi to read.', answer: 'F' },
            { id: 'k6-ma-5', statement: '5. People thought Heidi was a ghost.', answer: 'T' },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k6-mid-b',
          badge: 'Middle B · p. 14',
          title: 'Match the Two Parts of the Sentence',
          instruction: 'Match each sentence beginning (1–4) with the right ending (a–d).',
          scene: 'Sentence endings:',
          options: [
            { key: 'a', text: 'many colorful pictures.' },
            { key: 'b', text: 'a new coat and hat.' },
            { key: 'c', text: 'because she could not walk.' },
            { key: 'd', text: 'the big house at night.' },
          ],
          items: [
            { id: 'k6-mb-1', question: '1. Heidi walked through …', answer: 'd' },
            { id: 'k6-mb-2', question: '2. Klara gave Heidi …', answer: 'b' },
            { id: 'k6-mb-3', question: '3. The storybook had …', answer: 'a' },
            { id: 'k6-mb-4', question: '4. Klara sat in a wheelchair …', answer: 'c' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k6-mid-c',
          badge: 'Middle C · p. 15',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k6-mc-1',
              prompt: '1. Why did Miss Rottenmeier take care of Klara?',
              options: [
                { key: 'a', text: 'Klara’s mother died, and her father was away at work.' },
                { key: 'b', text: 'Klara’s parents died when she was a baby.' },
                { key: 'c', text: 'She was Klara’s aunt.' },
                { key: 'd', text: 'Klara was her sister.' },
              ],
              answer: 'a',
            },
            {
              id: 'k6-mc-2',
              prompt: '2. What did Heidi and Klara do together?',
              options: [
                { key: 'a', text: 'They played outside.' },
                { key: 'b', text: 'They had reading and writing lessons.' },
                { key: 'c', text: 'They rode horses.' },
                { key: 'd', text: 'They told ghost stories.' },
              ],
              answer: 'b',
            },
            {
              id: 'k6-mc-3',
              prompt: '3. Why did Heidi get sick?',
              options: [
                { key: 'a', text: 'The big house was very cold.' },
                { key: 'b', text: 'She caught Klara’s sickness.' },
                { key: 'c', text: 'She missed her home in the mountains.' },
                { key: 'd', text: 'She did not want to leave the city.' },
              ],
              answer: 'c',
            },
            {
              id: 'k6-mc-4',
              prompt: '4. What were Klara’s gifts for Peter’s grandmother?',
              options: [
                { key: 'a', text: 'A coat and a hat' },
                { key: 'b', text: 'Bread and a shawl' },
                { key: 'c', text: 'A blanket and a hat' },
                { key: 'd', text: 'A book and a shawl' },
              ],
              answer: 'b',
            },
            {
              id: 'k6-mc-5',
              prompt: '5. What did Heidi look like when she was sick?',
              options: [
                { key: 'a', text: 'Her hair was straight, and her face was red.' },
                { key: 'b', text: 'Her hair and face were wet.' },
                { key: 'c', text: 'Her eyes were red, and her cheeks were pink.' },
                { key: 'd', text: 'Her cheeks were pale, and her hair was not shiny.' },
              ],
              answer: 'd',
            },
          ],
        },
      ],
    },
    {
      id: 'k6-end',
      shortTitle: 'End',
      title: 'Reading Comprehension · End',
      subtitle: 'Story pp. 20–26 · Workbook pp. 16–17',
      pdfPage: 14,
      activities: [
        {
          kind: 'true-false',
          id: 'k6-end-a',
          badge: 'End A · p. 16',
          title: 'True or False',
          instruction: 'Choose T for true or F for false.',
          items: [
            { id: 'k6-ea-1', statement: '1. Heidi taught Peter to read.', answer: 'T' },
            { id: 'k6-ea-2', statement: '2. Klara visited Heidi in winter.', answer: 'F' },
            { id: 'k6-ea-3', statement: '3. Klara’s doctor had no family.', answer: 'T' },
            { id: 'k6-ea-4', statement: '4. Heidi’s grandfather broke Klara’s wheelchair.', answer: 'F' },
            { id: 'k6-ea-5', statement: '5. Klara’s father bought her a new wheelchair.', answer: 'F' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'k6-end-b',
          badge: 'End B · p. 16',
          title: 'Who’s Who? Write the Names',
          instruction: 'Choose the character who matches each sentence.',
          wordBank: ['Heidi', 'Klara', 'Peter', "Heidi's Grandfather"],
          items: [
            { id: 'k6-eb-1', prefix: 'This person was like a daughter to the doctor.', answer: 'Heidi' },
            { id: 'k6-eb-2', prefix: 'This person gave Klara warm milk from the goats.', answer: "Heidi's Grandfather" },
            { id: 'k6-eb-3', prefix: 'This person pushed Klara’s wheelchair down the mountain.', answer: 'Peter' },
            { id: 'k6-eb-4', prefix: 'This person became healthy and strong.', answer: 'Klara' },
          ],
        },
        {
          kind: 'mcq',
          id: 'k6-end-c',
          badge: 'End C · p. 17',
          title: 'Choose the Best Answer',
          instruction: 'Pick a, b, c, or d for each question.',
          items: [
            {
              id: 'k6-ec-1',
              prompt: '1. What did Heidi do for Peter’s grandmother?',
              options: [
                { key: 'a', text: 'She cooked for her.' },
                { key: 'b', text: 'She cleaned her house.' },
                { key: 'c', text: 'She sang songs to her.' },
                { key: 'd', text: 'She read stories to her.' },
              ],
              answer: 'd',
            },
            {
              id: 'k6-ec-2',
              prompt: '2. What did the doctor want to do?',
              options: [
                { key: 'a', text: 'He wanted to take Heidi back to the city.' },
                { key: 'b', text: 'He wanted to build a house.' },
                { key: 'c', text: 'He wanted to live with Heidi and her grandfather.' },
                { key: 'd', text: 'He wanted to buy some goats.' },
              ],
              answer: 'c',
            },
            {
              id: 'k6-ec-3',
              prompt: '3. Where did Klara sleep?',
              options: [
                { key: 'a', text: 'She slept in the living room.' },
                { key: 'b', text: 'She slept in the guest bedroom.' },
                { key: 'c', text: 'She slept outside.' },
                { key: 'd', text: 'She slept in Heidi’s bedroom.' },
              ],
              answer: 'd',
            },
            {
              id: 'k6-ec-4',
              prompt: '4. Why did Heidi NOT play with Peter very much?',
              options: [
                { key: 'a', text: 'Klara would not let Heidi play with him.' },
                { key: 'b', text: 'Heidi played with Klara instead.' },
                { key: 'c', text: 'Peter was mean to her.' },
                { key: 'd', text: 'Peter was always working.' },
              ],
              answer: 'b',
            },
            {
              id: 'k6-ec-5',
              prompt: '5. What did Peter think would happen if Klara had no wheelchair?',
              options: [
                { key: 'a', text: 'He thought Klara would forgive him.' },
                { key: 'b', text: 'He thought Klara would cry.' },
                { key: 'c', text: 'He thought Klara would go back to the city.' },
                { key: 'd', text: 'He thought Heidi would thank him.' },
              ],
              answer: 'c',
            },
          ],
        },
      ],
    },
    {
      id: 'k6-think-review',
      shortTitle: 'Think & Review',
      title: 'Think and Write · Vocabulary Review',
      subtitle: 'Workbook pp. 18–19 · Problem & Solution chart + vocabulary choice',
      pdfPage: 16,
      activities: [
        {
          kind: 'cause-effect',
          id: 'k6-think',
          badge: 'Think and Write · p. 18',
          title: 'Problem & Solution Chart',
          instruction: 'Fill in every blank in the Problem → Solution chart using the words from the box.',
          leftLabel: 'Problem',
          rightLabel: 'Solution',
          wordBank: [
            'wheelchair', 'play', 'milk', 'parents', 'sick',
            'grandfather', 'mountains', 'walk', 'city', 'broke',
          ],
          rows: [
            {
              id: 'k6-tw-r1',
              cause: ['Heidi’s ', { id: 'k6-tw-1', answer: 'parents' }, ' died.'],
              effect: ['Heidi’s Aunt Deta and her ', { id: 'k6-tw-2', answer: 'grandfather' }, ' looked after her.'],
            },
            {
              id: 'k6-tw-r2',
              cause: ['Klara needed a friend to ', { id: 'k6-tw-3', answer: 'play' }, ' with.'],
              effect: ['Heidi went to live in the ', { id: 'k6-tw-4', answer: 'city' }, ' with Klara.'],
            },
            {
              id: 'k6-tw-r3',
              cause: ['Heidi started to get very ', { id: 'k6-tw-5', answer: 'sick' }, '.'],
              effect: ['Heidi went back to the ', { id: 'k6-tw-6', answer: 'mountains' }, ' to live with her grandfather.'],
            },
            {
              id: 'k6-tw-r4',
              cause: ['Klara was sick and weak.'],
              effect: ['Heidi’s grandfather gave her goat’s ', { id: 'k6-tw-7', answer: 'milk' }, '.'],
            },
            {
              id: 'k6-tw-r5',
              cause: ['Peter ', { id: 'k6-tw-8', answer: 'broke' }, ' Klara’s ', { id: 'k6-tw-9', answer: 'wheelchair' }, '.'],
              effect: ['Klara tried to ', { id: 'k6-tw-10', answer: 'walk' }, '.'],
            },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'k6-vocab-review',
          badge: 'Vocabulary Review · p. 19',
          title: 'Choose the Correct Word',
          instruction: 'Tap the right word to complete each story sentence.',
          items: [
            { id: 'k6-vr-1', prefix: 'Heidi was an', options: ['aunt', 'orphan'], answer: 'orphan', suffix: '.', hint: 'Young Heidi living with her grandfather and the goats' },
            { id: 'k6-vr-2', prefix: 'Peter took the', options: ['bears', 'goats'], answer: 'goats', suffix: 'to look for good grass.', hint: 'Peter walking up the grassy mountain slope' },
            { id: 'k6-vr-3', prefix: 'Heidi quickly', options: ['packed', 'hurried'], answer: 'packed', suffix: 'her bag.', hint: 'Getting her clothes ready to leave with Aunt Deta' },
            { id: 'k6-vr-4', prefix: 'Miss Rottenmeier was very', options: ['sorry', 'strict'], answer: 'strict', suffix: '.', hint: 'Stern housekeeper watching over Heidi and Klara' },
            { id: 'k6-vr-5', prefix: 'Heidi thought reading was too', options: ['difficult', 'shiny'], answer: 'difficult', suffix: '.', hint: 'Studying books at a big table in the library' },
            { id: 'k6-vr-6', prefix: 'Heidi’s', options: ['pale', 'curly'], answer: 'pale', suffix: 'skin made her look like a ghost.', hint: 'Sleepwalking down the dark mansion stairs at night' },
            { id: 'k6-vr-7', prefix: 'Klara gave Heidi a', options: ['shawl', 'book'], answer: 'shawl', suffix: 'for Peter’s grandmother.', hint: 'Packing warm gifts into Heidi’s trunk' },
            { id: 'k6-vr-8', prefix: 'Heidi quickly', options: ['packed', 'hurried'], answer: 'packed', suffix: 'her bag.', hint: 'Getting ready to travel home to the mountains' },
            { id: 'k6-vr-9', prefix: 'Peter did something', options: ['naughty', 'blind'], answer: 'naughty', suffix: '.', hint: 'Pushing Klara’s wheelchair down the mountain' },
            { id: 'k6-vr-10', prefix: 'Peter was', options: ['sorry', 'lonely'], answer: 'sorry', suffix: 'for breaking Klara’s wheelchair.', hint: 'Hanging his head in front of Klara, Heidi, and Grandfather' },
          ],
        },
      ],
    },
    {
      id: 'k6-summary-report',
      shortTitle: 'Summary & Report',
      title: 'Summary & Book Report',
      subtitle: 'Workbook pp. 20–21 · Story order + printable Book Report',
      pdfPage: 18,
      activities: [
        {
          kind: 'sequence',
          id: 'k6-summary-a',
          badge: 'Summary A · p. 20',
          title: 'Put the Sentences in the Correct Order (1–6)',
          instruction: 'Arrange sentences a–f from 1 (first) to 6 (last) between the opening and closing lines.',
          count: 6,
          leadSentence: 'Heidi’s parents died when she was a baby.',
          trailSentence: 'Klara tried to walk.',
          items: [
            { id: 'k6-sum-a', badge: 'a', text: 'Heidi moved to the city to live with Klara.', answer: 2 },
            { id: 'k6-sum-b', badge: 'b', text: 'Peter broke Klara’s wheelchair.', answer: 6 },
            { id: 'k6-sum-c', badge: 'c', text: 'Heidi learned to read.', answer: 3 },
            { id: 'k6-sum-d', badge: 'd', text: 'Klara visited Heidi.', answer: 5 },
            { id: 'k6-sum-e', badge: 'e', text: 'Heidi’s aunt left her with her grandfather.', answer: 1 },
            { id: 'k6-sum-f', badge: 'f', text: 'Heidi got sick and looked like a ghost.', answer: 4 },
          ],
        },
        {
          kind: 'match-qa',
          id: 'k6-summary-b',
          badge: 'Summary B · p. 20',
          title: 'Match Each Picture to Its Summary Sentence',
          instruction: 'Choose the sentence that matches each of the three story pictures.',
          scene: 'Summary sentences:',
          options: [
            { key: 'a', text: 'Heidi moved to the city to live with Klara.' },
            { key: 'b', text: 'Peter broke Klara’s wheelchair.' },
            { key: 'f', text: 'Heidi got sick and looked like a ghost.' },
          ],
          items: [
            { id: 'k6-sumb-1', question: '1. Picture 1 — Heidi arrives at the mansion with her bag to meet Klara and Miss Rottenmeier.', answer: 'a' },
            { id: 'k6-sumb-2', question: '2. Picture 2 — Heidi walks down the dark staircase at night in her white nightgown.', answer: 'f' },
            { id: 'k6-sumb-3', question: '3. Picture 3 — Peter pushes Klara’s empty wheelchair down the steep mountain past the goats.', answer: 'b' },
          ],
        },
        {
          kind: 'sequence',
          id: 'k6-plot',
          badge: 'Book Report · p. 21',
          title: 'Story — Put the Sentences in the Correct Order (1–5)',
          instruction: 'Choose 1 to 5 to arrange sentences a–e from beginning to end.',
          count: 5,
          items: [
            { id: 'k6-pl-a', badge: 'a', text: 'Klara went to the mountains to visit Heidi.', answer: 3 },
            { id: 'k6-pl-b', badge: 'b', text: 'Peter broke Klara’s wheelchair.', answer: 4 },
            { id: 'k6-pl-c', badge: 'c', text: 'Heidi went to live in the city.', answer: 1 },
            { id: 'k6-pl-d', badge: 'd', text: 'Klara showed her family that she could walk.', answer: 5 },
            { id: 'k6-pl-e', badge: 'e', text: 'Heidi was lonely and missed the mountains.', answer: 2 },
          ],
        },
        {
          kind: 'book-report',
          id: 'k6-report',
          badge: 'My Book Report · p. 21',
          title: 'Complete & Print Your Book Report',
          instruction: 'Fill in your favorite character, lesson learned, and review. Your report saves automatically and prints cleanly on one page.',
          defaultTitle: 'Heidi',
          defaultAuthor: 'Johanna Spyri',
          characterChoices: ['Heidi', "Heidi's Grandfather", 'Klara', 'Peter', "Peter's Grandmother", 'Miss Rottenmeier'],
        },
      ],
    },
  ],
};

export const READER_WORKBOOKS: readonly ReaderWorkbookMeta[] = [
  KID_1_TIN_SOLDIER,
  KID_2_HANSEL_GRETEL,
  KID_3_MAGIC_BEANS,
  KID_4_TROJAN_HORSE,
  KID_5_DAEDALUS_AND_ICARUS,
  KID_6_HEIDI,
  ...UPPER_READER_WORKBOOKS,
];

export { GRADED_READER_WORKBOOKS, GUIDE_READER_WORKBOOKS, PHONICS_READER_WORKBOOKS };

export const ALL_READER_WORKBOOKS: readonly ReaderWorkbookMeta[] = [
  ...READER_WORKBOOKS,
  ...GRADED_READER_WORKBOOKS,
  ...PHONICS_READER_WORKBOOKS,
  ...GUIDE_READER_WORKBOOKS,
];

export function getReaderWorkbook(id: string | null | undefined): ReaderWorkbookMeta | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  return ALL_READER_WORKBOOKS.find((wb) => wb.id === key || wb.drillSlug === key) ?? null;
}
