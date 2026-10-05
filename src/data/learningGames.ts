export type LearningGameSkill = 'Vocabulary' | 'Reading' | 'Grammar' | 'Early literacy' | 'Listening';

export interface LearningGameQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  feedback: string;
  passage?: string[];
  audioScript?: string;
}

export interface LearningGame {
  id: string;
  title: string;
  skill: LearningGameSkill;
  level: string;
  duration: string;
  description: string;
  instructions: string;
  passage?: string[];
  audioScript?: string;
  questions: LearningGameQuestion[];
  /**
   * Optional link to a standalone HTML game (e.g. ./writequest.html).
   * When present, the card renders as an anchor that opens the URL in a new tab
   * instead of launching the in-page React question player.
   */
  externalUrl?: string;
  /** Optional badge label for external/featured cards (e.g. "Live", "Featured"). */
  badge?: string;
}

const courtyardPassage = [
  'When the school courtyard was covered with dark paving, rainwater often collected near the steps. The student ecology team suggested adding two narrow planting beds along the sunny wall. They measured the amount of water left in a marked bucket after storms and took photos of the courtyard before and after each change.',
  'After three rainy weeks, the team saw less standing water beside the steps. The photos also showed that one bed dried quickly in the afternoon sun. The students moved a shade cloth over that bed, but they did not claim the new gardens had fixed every drainage problem. They plan to keep measuring through the next season.'
];

const listeningGameScript = 'Teacher: The model wind turbine will be ready for the open house next month, but first we need to test the blade shapes. Student: Do we test them outside on the windy day? Teacher: No. Use the classroom fan on the same setting for every trial. Then the wind speed stays more consistent. Student: And should we measure how fast each blade turns? Teacher: Yes. Count the turns for thirty seconds, repeat three times, and write down the average. Student: We have four blade shapes and one afternoon. Teacher: Test two shapes today and two tomorrow, but keep the fan at the same distance. Our goal is to compare the designs fairly, not to finish in a single afternoon.';

export const LEARNING_GAMES: LearningGame[] = [
  {
    id: 'writequest',
    title: 'WriteQuest · Guided Writing Studio',
    skill: 'Vocabulary',
    level: 'Grades 5–9',
    duration: 'Self-paced · about 8 min',
    description: 'A standalone writing studio: draft a short response, get rubric-style feedback on sentence variety and word count, then revise. Opens in a new tab — no login, no student data.',
    instructions: 'Open WriteQuest in a new tab and follow the prompts inside the studio.',
    externalUrl: './writequest.html',
    badge: 'Live',
    questions: [],
  },
  {
    id: 'affix-architect',
    ... (rest of your existing affix-architect entry continues here unchanged)
    id: 'affix-architect',
    id: 'affix-architect',
    title: 'Affix Architect',
    skill: 'Vocabulary',
    level: 'Grades 4-7',
    duration: '4 questions · about 3 min',
    description: 'Build precise academic words from roots, prefixes, and suffixes. A wrong turn? Get the clue, then try again.',
    instructions: 'Choose the word part or completed word that fits the meaning and sentence.',
    questions: [
      { prompt: 'Which prefix makes “possible” mean “not possible”?', choices: ['re-', 'im-', 'pre-', 'inter-'], correctIndex: 1, feedback: 'The prefix im- can mean “not.” Impossible means not possible.' },
      { prompt: 'A thing that can be washed is ______.', choices: ['washment', 'washable', 'miswash', 'washist'], correctIndex: 1, feedback: 'The suffix -able means “capable of being.” Washable means capable of being washed.' },
      { prompt: 'In “The directions were unclear,” what does un- mean?', choices: ['again', 'before', 'not', 'between'], correctIndex: 2, feedback: 'Un- means “not” in unclear: the directions were not clear.' },
      { prompt: 'Which word means “the act or process of deciding”?', choices: ['decision', 'deciderable', 'predecide', 'misdecisioning'], correctIndex: 0, feedback: 'Decision names the act or result of deciding. The suffix -ion often forms a noun.' },
    ],
  },
  {
    id: 'context-clue-sleuth',
    title: 'Context Clue Sleuth',
    skill: 'Vocabulary',
    level: 'Grades 5-8',
    duration: '4 questions · about 4 min',
    description: 'Read like a detective: use nearby details to solve a word, then show which clue supports your answer.',
    instructions: 'Use the sentence context, not a guess about what the word might mean.',
    questions: [
      { prompt: '“The trail was slippery after the rain, so we proceeded cautiously, testing each stone before stepping.” What does cautiously mean?', choices: ['In a hurried way', 'With care to avoid danger', 'Without looking', 'With excitement'], correctIndex: 1, feedback: 'Testing each stone shows the hikers are acting carefully to avoid danger.' },
      { prompt: '“Unlike the crowded main hall, the annex was almost empty; only two students studied there.” What does annex most likely describe?', choices: ['An additional building or section', 'A crowded hallway', 'A kind of exam', 'A person studying'], correctIndex: 0, feedback: 'The sentence compares two school spaces, so an annex is another section or building.' },
      { prompt: '“The first plan was impractical: it required more supplies than the team could carry.” What does impractical mean here?', choices: ['Not useful or workable', 'Very inexpensive', 'Easy to remember', 'Recently completed'], correctIndex: 0, feedback: 'The explanation says the team cannot carry the required supplies, so the plan is not workable.' },
      { prompt: '“Mina checked the calculation twice; nevertheless, her answer did not match the group’s result.” What does nevertheless signal?', choices: ['A cause', 'A contrast', 'A sequence', 'A definition'], correctIndex: 1, feedback: 'Nevertheless introduces a contrast: Mina checked twice, but the result still differed.' },
    ],
  },
  {
    id: 'main-idea-mission',
    title: 'Main Idea Mission',
    skill: 'Reading',
    level: 'Grades 6-9',
    duration: '4 questions · about 5 min',
    description: 'Follow the evidence through a short science story. Find the main idea without falling for overconfident claims.',
    instructions: 'Read the passage once for its topic. Re-read details before choosing an answer.',
    passage: courtyardPassage,
    questions: [
      { prompt: 'What is the best main idea?', choices: ['The ecology team found an early improvement and a remaining issue, so it plans to continue measuring.', 'The gardens permanently solved every drainage problem at the school.', 'The shade cloth made the sunny wall darker.', 'The team stopped taking photos after the first storm.'], correctIndex: 0, feedback: 'The passage includes less standing water, a bed that dries quickly, and a plan to keep measuring. It does not claim a complete fix.' },
      { prompt: 'Why did students take photos before and after each change?', choices: ['To compare visible changes over time', 'To replace the water measurements', 'To choose a new school mascot', 'To make the rain stop'], correctIndex: 0, feedback: 'The photos let the team observe and compare the courtyard as the project changed.' },
      { prompt: 'What problem did the shade cloth address?', choices: ['One planting bed dried quickly in afternoon sun.', 'The bucket was too large to carry.', 'The courtyard had no steps.', 'Students could not find the ecology team.'], correctIndex: 0, feedback: 'The passage says one bed dried quickly in the afternoon sun, so students moved a shade cloth over it.' },
      { prompt: 'Which statement is supported by the passage?', choices: ['The team recorded observations after storms.', 'The team proved the gardens work in every season.', 'The shade cloth stopped all rainwater.', 'The students removed both planting beds.'], correctIndex: 0, feedback: 'The students measured water after storms and documented the project. They planned to continue studying it.' },
    ],
  },
  {
    id: 'verb-relay',
    title: 'Verb Relay',
    skill: 'Grammar',
    level: 'Grades 4-8',
    duration: '5 questions · about 4 min',
    description: 'Practice irregular forms. Pick a verb that fits the time clue and sentence helper.',
    instructions: 'Check both the time expression and any helping verb before you choose.',
    questions: [
      { prompt: 'Yesterday our class ______ a model bridge.', choices: ['build', 'built', 'has built', 'building'], correctIndex: 1, feedback: 'Yesterday marks a completed past action, so built is the simple past.' },
      { prompt: 'We have ______ three design changes so far.', choices: ['made', 'make', 'making', 'makes'], correctIndex: 0, feedback: 'Have is followed by the past participle made.' },
      { prompt: 'Before the bell rang, the team had ______ its materials away.', choices: ['put', 'puts', 'putting', 'putted'], correctIndex: 0, feedback: 'Had takes a past participle. Put has the same base, past, and participle form.' },
      { prompt: 'Maya ______ the instructions to her partner last period.', choices: ['give', 'given', 'gave', 'gives'], correctIndex: 2, feedback: 'Last period marks the simple past: gave.' },
      { prompt: 'The students have ______ the safety rules carefully.', choices: ['wrote', 'written', 'write', 'writes'], correctIndex: 1, feedback: 'Have is followed by the past participle written.' },
    ],
  },
  {
    id: 'sound-match',
    title: 'Sound Match Studio',
    skill: 'Early literacy',
    level: 'Pre-K to Grade 2',
    duration: '5 questions · about 3 min',
    description: 'Listen for a sound, find the matching letters, and build early reading confidence one sound at a time.',
    instructions: 'Say each word aloud if you can. The letter pair sh or ch makes one sound in these words.',
    questions: [
      { prompt: 'Which word begins with /sh/?', choices: ['ship', 'chip', 'thin', 'this'], correctIndex: 0, feedback: 'Ship begins with /sh/. Chip begins with /ch/, while thin and this begin with /th/.' },
      { prompt: 'Which word begins with /ch/?', choices: ['shell', 'chin', 'ship', 'shop'], correctIndex: 1, feedback: 'Chin begins with the /ch/ sound.' },
      { prompt: 'In “dish,” which two letters spell the last sound?', choices: ['di', 'is', 'sh', 'hi'], correctIndex: 2, feedback: 'The letters sh work together to spell the last sound in dish.' },
      { prompt: 'Change the first sound in “ship” from /sh/ to /ch/. Which new word do you make?', choices: ['chip', 'shop', 'chin', 'chop'], correctIndex: 0, feedback: 'Replace just /sh/ with /ch/: ship becomes chip.' },
      { prompt: 'Which word has a short /a/ vowel sound?', choices: ['cake', 'map', 'team', 'ride'], correctIndex: 1, feedback: 'Map has the short /a/ sound. The other choices include long vowel sounds.' },
    ],
  },
  {
    id: 'listening-scout',
    title: 'Listening Scout',
    skill: 'Listening',
    level: 'Grades 5-9',
    duration: '4 questions · about 4 min',
    description: 'Hear a classroom planning discussion, collect key details, and infer the speaker’s next step.',
    instructions: 'Play the synthesized prompt up to two times, or open the transcript. Then answer from the details you heard.',
    audioScript: listeningGameScript,
    questions: [
      { prompt: 'What will the students compare?', choices: ['The turning speed of four wind-turbine blade shapes', 'The color of two classroom fans', 'The temperature inside two books', 'The number of students attending an open house'], correctIndex: 0, feedback: 'The teacher says the group will test four blade shapes and count how many turns each makes.' },
      { prompt: 'Why will students keep the fan on the same setting?', choices: ['To keep the wind speed more consistent', 'To finish the project earlier', 'To make every blade the same shape', 'To avoid recording the results'], correctIndex: 0, feedback: 'Using the same setting helps keep wind speed consistent across the trials.' },
      { prompt: 'How long will students count the blade turns?', choices: ['Ten seconds', 'Twenty seconds', 'Thirty seconds', 'One minute'], correctIndex: 2, feedback: 'The teacher says to count turns for thirty seconds, repeat three times, and calculate an average.' },
      { prompt: 'What is the teacher\'s main reason for splitting the blade tests over two days?', choices: ['To keep the test fair instead of rushing every design into one afternoon', 'To change the fan setting each day', 'To avoid testing more than one blade shape', 'To cancel the open house'], correctIndex: 0, feedback: 'The teacher emphasizes a fair comparison and consistent fan distance, not finishing in one afternoon.' },
    ],
  },
];
