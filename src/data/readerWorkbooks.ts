/*
 * Interactive reader workbooks for Kid 1–3 (Young Learners Classic Readers).
 *
 * Each entry mirrors the 20-page PDF workbook in public/library/books/ across
 * seven tabs: Story Focus, Vocabulary Preview, Comprehension (Beginning,
 * Middle, End), Think & Write + Vocabulary Review, and Summary + Book Report.
 *
 * Objective items are auto-graded client-side by src/lib/readerWorkbook.ts and
 * submitted to Firestore `drill_attempts` (drillSource 'rfc3') so teachers see
 * class score sheets and students can check their own score. Open reflections
 * and the Book Report are saved locally on the student's device and printable.
 */

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
      items: readonly SequenceItem[];
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
  gradeNumber: 1 | 2 | 3;
  gradeLabel: 'Kid 1' | 'Kid 2' | 'Kid 3';
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

export const READER_WORKBOOKS: readonly ReaderWorkbookMeta[] = [
  KID_1_TIN_SOLDIER,
  KID_2_HANSEL_GRETEL,
  KID_3_MAGIC_BEANS,
];

export function getReaderWorkbook(id: string | null | undefined): ReaderWorkbookMeta | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  return READER_WORKBOOKS.find((wb) => wb.id === key || wb.drillSlug === key) ?? null;
}
