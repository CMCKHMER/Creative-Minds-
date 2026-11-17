export type LearningGameSkill = 'Vocabulary' | 'Reading' | 'Grammar' | 'Early literacy' | 'Listening' | 'Speaking';

/** Difficulty tier of a single round. Every in-page game now runs
 *  Warm-up → Build → Mastery and finishes on a Boss round worth double. */
export type GameTier = 'warmup' | 'build' | 'mastery' | 'boss';

export interface LearningGameQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  feedback: string;
  passage?: string[];
  audioScript?: string;
  /** Which third of the run this round belongs to. */
  tier: GameTier;
  /** XP value of the round (10 / 15 / 20 / 30 for boss). */
  points: number;
  /** One-line hint the player can spend a hint token on. */
  hint: string;
  /** Short label for the extra challenge baked into the round. */
  challengeTag: string;
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
  externalUrl?: string;
  badge?: string;
  leaderboardLink?: boolean;
  /** AI-generated card / briefing artwork in public/images/games/. */
  coverImage?: string;
  /** Short hook shown on the card under the title. */
  tagline?: string;
  /** Human difficulty label, e.g. "Advanced · Boss round". */
  difficultyLabel?: string;
  /** XP for a perfect run before streak / mode bonuses. */
  xpReward?: number;
  /** Lives in Survival mode. */
  lives?: number;
  /** Countdown per round in Time Trial / Survival. */
  secondsPerQuestion?: number;
  /** Extra challenge mechanics advertised on the card + briefing. */
  challengeModes?: string[];
}

const TIER_POINTS: Record<GameTier, number> = { warmup: 10, build: 15, mastery: 20, boss: 30 };

function q(
  prompt: string,
  choices: string[],
  correctIndex: number,
  feedback: string,
  tier: GameTier,
  hint: string,
  challengeTag: string,
  extra?: { passage?: string[]; audioScript?: string },
): LearningGameQuestion {
  return { prompt, choices, correctIndex, feedback, tier, points: TIER_POINTS[tier], hint, challengeTag, ...extra };
}

const courtyardPassage = [
  'When the school courtyard was covered with dark paving, rainwater often collected near the steps. The student ecology team suggested adding two narrow planting beds along the sunny wall. They measured the amount of water left in a marked bucket after storms and took photos of the courtyard before and after each change.',
  'After three rainy weeks, the team saw less standing water beside the steps. The photos also showed that one bed dried quickly in the afternoon sun. The students moved a shade cloth over that bed, but they did not claim the new gardens had fixed every drainage problem. They plan to keep measuring through the next season.',
];

const libraryPassage = [
  'The school library team wanted to know whether window herbs could survive the long holiday. They planted basil in four identical pots with the same soil and placed all four on the same sunny shelf. Two pots were watered by a slow-drip bottle; the other two were watered by hand every Monday and Thursday.',
  'After four weeks, the drip-watered basil was taller, but the team noticed the drip bottles had also kept the soil wetter after weekends. They wrote that drip watering helped in this test, but they did not claim it would work for every plant or every window. They plan to repeat the test with mint and to record soil wetness, not just height.',
];

const listeningGameScript = 'Teacher: The model wind turbine will be ready for the open house next month, but first we need to test the blade shapes. Student: Do we test them outside on the windy day? Teacher: No. Use the classroom fan on the same setting for every trial. Then the wind speed stays more consistent. Student: And should we measure how fast each blade turns? Teacher: Yes. Count the turns for thirty seconds, repeat three times, and write down the average. Student: We have four blade shapes and one afternoon. Teacher: Test two shapes today and two tomorrow, but keep the fan at the same distance. Our goal is to compare the designs fairly, not to finish in a single afternoon.';

const listeningGameScript2 = 'Teacher: For the seedling project, our question is whether watering little and often beats watering a lot twice a week. Student: So we give every plant the same amount of water in total? Teacher: Exactly. Both groups get the same total water, the same soil and the same sunny shelf — only the schedule changes. Student: What do we measure? Teacher: Measure the height every three days, and also note the colour of the leaves. A tall plant with pale leaves is not necessarily healthy. Student: When do we decide? Teacher: After four weeks we compare the averages. If the difference is tiny, we say the schedule probably does not matter much, and we repeat the test before we recommend anything to the garden club.';

export const LEARNING_GAMES: LearningGame[] = [
  {
    id: 'reason-lab',
    title: 'Reason Lab · Critical Thinking Trainer',
    skill: 'Reading',
    level: 'Grades 5–12',
    duration: '4 modes · 2–6 min per session',
    description: 'An advanced critical-thinking trainer that separates reasoning into eight trainable skills — Evidence & Sources, Fallacy Detection, Bias & Perspective, Causal Reasoning, Assumptions, Data Literacy, Argument & Steelman and Decision Under Risk — each reported independently with a mastery bar. Four modes: Campaign (a mixed diagnostic across all eight skills), Gauntlet (a 90-second sprint where correct answers add time, errors cost time and streaks multiply points), Drill (one skill on repeat until it is automatic) and Case File (a dossier of conflicting documents followed by five linked decisions about the same evidence). Three item types are graded exactly — single choice, select-all-that-apply and rank-in-order — across three tiers worth 10/15/20 points, and the full review screen explains every item you missed. XP feeds six ranks from Novice to Architect, 13 badges, per-skill mastery tracking, difficulty/session-length controls, pressure timers, sound cues, export and print report, keyboard play (1–4, Enter, Esc). Finished sessions post to the class leaderboard with name + ID, and the Share-with-class kit lets the teacher run it as a competitive class challenge.',
    instructions: 'Open Reason Lab, key in your name and ID on the briefing, pick a mode (start with Campaign), set difficulty and session length on the right rail, then answer with keys 1–4 and Enter. Send each session report to the class leaderboard with 📡 SEND SCORE.',
    externalUrl: './reason-lab.html',
    badge: 'New',
    leaderboardLink: true,
    coverImage: './images/games/reason-lab.jpg',
    tagline: 'Eight reasoning skills. One boss-level dossier.',
    difficultyLabel: 'Advanced · Gauntlet + Case File boss',
    xpReward: 300, lives: 3, secondsPerQuestion: 45,
    challengeModes: ['Campaign', '90-sec Gauntlet', 'Skill Drill', 'Case File boss'],
    questions: [],
  },
  {
    id: 'cryo-lockdown',
    title: 'Cryo-Vault Lockdown · DNA Bank Escape',
    skill: 'Reading',
    level: 'Grades 5–10',
    duration: '1 run · 6–12 min',
    description: 'An escape-room reading challenge built on the Unit 15 DNA Bank lesson: a power surge has sealed the cryo-vault of the global DNA bank and the coolant is failing. Crack the six security terminals — word-meaning matching, cause-and-effect ordering, cause/effect sorting, a word-bank gap fill, true/false verification and reading comprehension — every terminal you authenticate releases one digit of the vault code, then you enter all six digits in slot order on the keypad before the timer dies. Three protocols: Trainee (12:00 coolant, 4 hints, no penalty), Technician (09:00, 3 hints, −10 s per error) and Specialist (06:30, 2 hints, −20 s per error); hint tokens burn coolant seconds too, and the code, terminal layout and puzzle order change every run. A finished run scores 1000 + 2 × seconds left + 100 × hints kept − 25 × errors for an S/A/B/C rank (failed runs post how far you got). Students key in their name and ID, the run is sent to the class leaderboard, and the Share-with-class kit (Copy Link / WhatsApp / Telegram / Email) lets the teacher run it as a competitive class assignment.',
    instructions: 'Open the game, read the emergency briefing, key in your name and ID, choose a difficulty protocol and press INITIATE LOCKDOWN. Solve the terminals in any order — each releases one code digit — then enter the release code T1→T6 on the keypad. Send the run to the class leaderboard from the mission report.',
    externalUrl: './cryo-lockdown.html',
    badge: 'New',
    leaderboardLink: true,
    coverImage: './images/games/cryo-lockdown.jpg',
    tagline: 'Six terminals. One vault code. Coolant is falling.',
    difficultyLabel: 'Hard · Specialist protocol is the boss mode',
    xpReward: 500, lives: 3, secondsPerQuestion: 60,
    challengeModes: ['Trainee 12:00', 'Technician 09:00 · −10s errors', 'Specialist 06:30 · −20s errors'],
    questions: [],
  },
  {
    id: 'voice-quest',
    title: 'Talk to me · Speak to Play',
    skill: 'Speaking',
    level: 'Grades 1–9',
    duration: '15 levels · about 20 min',
    description: 'The new Voice Quest: speak English commands to guide your buddy through 15 levels across five units — directions, numbers, colors, animals, prepositions, daily routines and full sentences, plus a Master Class unit (sizes, between-placement, four-animal care and an expert key-and-door gauntlet) for advanced students — with instant feedback and a "listen" button on every phrase. Finished levels earn points on the CMC live ticker and leaderboard. Includes a Word Book of every phrase the game understands and a Game Designer where students and teachers build and share their own levels. Voice works best in Chrome or Edge; typed commands and tap controls included as fallback.',
    instructions: 'Open the game in a new tab, choose a buddy, then tap the microphone, allow mic access, and say the mission phrases out loud. Say "help" anytime for a hint. Add your name once and every finished level shows up on the homepage ticker.',
    externalUrl: './voice-quest.html',
    badge: 'New',
    coverImage: './images/games/voice-quest.jpg',
    tagline: 'Speak the command. Your buddy moves.',
    difficultyLabel: 'Progressive · Master Class gauntlet at the end',
    xpReward: 450, lives: 3, secondsPerQuestion: 30,
    challengeModes: ['15 levels', 'Master Class', 'Build-your-own level'],
    questions: [],
  },
  {
    id: 'word-forge',
    title: 'Word Forge · Prefix & Suffix Workshop',
    skill: 'Vocabulary',
    level: 'Grades 4–9',
    duration: '4 activities · about 10 min',
    description: 'A standalone morphology workshop: study 22 prefixes and 24 suffixes with examples and spelling tips, forge real words in the word-building machine, pair affixes with meanings in Match, then finish with the 20-question quiz. Signed-in students send quiz and match scores to the CMC leaderboard.',
    instructions: 'Open Word Forge. Study the cards first, forge a few words, clear a Match round, then take the Quiz — your score goes to the leaderboard when you are signed in.',
    externalUrl: './word-forge.html',
    badge: 'New',
    coverImage: './images/games/word-forge.jpg',
    tagline: 'Forge real words from red-hot word parts.',
    difficultyLabel: 'Intermediate · 20-question forge quiz',
    xpReward: 250, lives: 3, secondsPerQuestion: 35,
    challengeModes: ['Study cards', 'Forge machine', 'Match', '20Q Quiz'],
    questions: [],
  },
  {
    id: 'writequest',
    title: 'WriteQuest · Guided Writing Studio',
    skill: 'Vocabulary',
    level: 'Grades 5–9',
    duration: 'Self-paced · about 8 min',
    description: 'A standalone writing studio: draft a short response, get rubric-style feedback on sentence variety and word count, then revise. No login, no student data.',
    instructions: 'Open WriteQuest and follow the prompts inside the studio.',
    externalUrl: './writequest.html',
    badge: 'Live',
    coverImage: './images/games/writequest-bg.jpg',
    tagline: 'Draft, get rubric feedback, revise stronger.',
    difficultyLabel: 'Self-paced · Revision challenge',
    xpReward: 200, lives: 3, secondsPerQuestion: 90,
    challengeModes: ['Draft', 'Rubric feedback', 'Revise & resubmit'],
    questions: [],
  },
  {
    id: 'syntax-clash-pro',
    title: 'Syntax Clash Pro · Grammar Hacker',
    skill: 'Grammar',
    level: 'Grades 5–12',
    duration: 'Endless · about 5 min/run',
    description: 'A self-contained grammar arcade: judge sentences, fix errors, spot the wrong word, and breach security layers in the Terminal Heist. Nine modes, five heist targets, daily challenge, 25 achievements, four themes. No login, no student data.',
    instructions: 'Open Syntax Clash Pro and pick a mode from the menu. Try Daily Challenge for a shared seed, or Terminal Heist to earn money and emblems.',
    externalUrl: './syntax-clash-pro.html',
    badge: 'New',
    coverImage: './images/games/syntax-clash-bg.jpg',
    tagline: 'Hack the grammar terminal before it hacks you.',
    difficultyLabel: 'Expert · Terminal Heist boss layers',
    xpReward: 400, lives: 3, secondsPerQuestion: 25,
    challengeModes: ['9 modes', 'Daily Challenge', 'Terminal Heist boss'],
    questions: [],
  },
  {
    id: 'tense-master',
    title: 'Tense Master · 12 English Tenses',
    skill: 'Grammar',
    level: 'Grades 5–12',
    duration: '12 tenses · about 4 min per tense',
    description: 'Learn all 12 English verb tenses with explanations, examples, signal words, and quizzes. Progressive unlock from Basic to Expert. Best-streak tracking, mistake review, keyboard shortcuts. Same CMC visual family — no login, no student data.',
    instructions: 'Open Tense Master. Read the lesson, take the 6-question quiz, then move on. Keys 1-4 or A-D answer, Enter advances, Esc goes back.',
    externalUrl: 'https://cmckhmer.github.io/TenseMaster/',
    badge: 'New',
    tagline: 'Twelve tenses. One timeline to master.',
    difficultyLabel: 'Progressive · Expert unlock',
    xpReward: 360, lives: 3, secondsPerQuestion: 30,
    challengeModes: ['Basic → Expert unlock', 'Best-streak', 'Mistake review'],
    questions: [],
  },
  {
    id: 'affix-architect',
    title: 'Affix Architect',
    skill: 'Vocabulary',
    level: 'Grades 4-7',
    duration: '15 questions · about 8 min',
    description: 'Build precise academic words from roots, prefixes and suffixes — now with spelling-change traps, three-part boss words and near-miss distractors. A wrong turn? Spend a hint token, then try again.',
    instructions: 'Choose the word part or completed word that fits the meaning and sentence. Watch for spelling changes when suffixes join, and save a hint for the Boss round.',
    coverImage: './images/games/affix-architect.jpg',
    tagline: 'Stack prefixes, roots and suffixes like an architect.',
    difficultyLabel: 'Hard · Three-part Boss word',
    xpReward: 240, lives: 3, secondsPerQuestion: 35,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Boss round ×2 XP'],
    questions: [
      q('Which prefix makes “possible” mean “not possible”?', ['re-', 'im-', 'pre-', 'inter-'], 1, 'The prefix im- can mean “not.” Impossible means not possible.', 'warmup', 'Think of impatient and imperfect — which prefix repeats?', 'Prefix hunt'),
      q('A thing that can be washed is ______.', ['washment', 'washable', 'miswash', 'washist'], 1, 'The suffix -able means “capable of being.” Washable means capable of being washed.', 'warmup', 'You need a suffix meaning “can be done”.', 'Suffix fit'),
      q('In “The directions were unclear,” what does un- mean?', ['again', 'before', 'not', 'between'], 2, 'Un- means “not” in unclear: the directions were not clear.', 'warmup', 'Unclear is the opposite of clear.', 'Meaning match'),
      q('Which word means “the act or process of deciding”?', ['decision', 'deciderable', 'predecide', 'misdecisioning'], 0, 'Decision names the act or result of deciding. The suffix -ion often forms a noun, and decide changes its spelling.', 'warmup', 'Look for a noun, not a verb.', 'Word class'),
      q('Which prefix means “again” in “rebuild the model”?', ['re-', 'un-', 'inter-', 'mis-'], 0, 'Re- means again, so rebuild means build again.', 'warmup', 'Replay, rewrite, rebuild — what repeats?', 'Prefix hunt'),
      q('A person who teaches is a ______. A person who acts is an ______.', ['teacher · actor', 'teachful · actful', 'unteach · unact', 'teachness · actness'], 0, 'The suffixes -er and -or can name a person who does an action: teacher, actor.', 'build', 'Both blanks name people who do a job.', 'Double blank'),
      q('Which pair are OPPOSITES made only by swapping the suffix?', ['hopeful · hopeless', 'rebuild · undo', 'teacher · actor', 'preview · review'], 0, 'Hopeful means full of hope; hopeless means without hope. Only the suffix changes.', 'build', 'One suffix means “full of”, the other “without”.', 'Opposite trap'),
      q('In “The two schools held an inter-school quiz,” inter- means ______.', ['not', 'again', 'between / among', 'wrongly'], 2, 'Inter- means between or among: the quiz was between two schools.', 'build', 'International games are played between nations.', 'Context prefix'),
      q('“The instructions were misread, so the team built the wrong model.” Mis- tells you the instructions were read ______.', ['again carefully', 'wrongly / badly', 'before class', 'between partners'], 1, 'Mis- means wrongly or badly. They did not just re-read — they understood incorrectly.', 'build', 'Misunderstand, misplace, mistake all share this problem.', 'Near-miss trap'),
      q('Which is the correctly built word for “not honest”?', ['unhonest', 'dishonest', 'imhonest', 'dishonestful'], 1, 'Honest takes dis-: dishonest. Unhonest and imhonest are not standard English words.', 'build', 'English chooses dis- before honest, im- before possible.', 'Real-word check'),
      q('Decide → decision. Act → action. Which rule best explains both?', ['Add -sion / -tion with a spelling change to make a noun', 'Add -able to make an adjective', 'Add re- to repeat the action', 'Double the last letter every time'], 0, 'Both become nouns with -ion, and the base word changes spelling: decide→decision, act→action.', 'mastery', 'What word class do decision and action belong to?', 'Spelling change'),
      q('“The result was unpredictable.” Break the word into its three working parts.', ['un- + predict + -able', 'unpre- + dict + -ing', 'un- + pre + dictable', 'under- + predict + -less'], 0, 'Un- (not) + predict (say before) + -able (can be): not able to be predicted.', 'mastery', 'Remove the prefix first, then the suffix. What root is left?', 'Three-part build'),
      q('Which word means “to carry or move something across from one place to another”?', ['transport', 'importable', 'preport', 'misport'], 0, 'Trans- means across and port means carry: transport = carry across.', 'mastery', 'Trans- also appears in transfer and translate.', 'Root power'),
      q('A scientist who studies living things is a biologist. -ist here means ______.', ['without something', 'a person who studies / does something', 'able to be done', 'the act of doing'], 1, '-ist names a specialist: biologist, artist, scientist.', 'mastery', 'Artist and scientist name people, not actions.', 'Suffix family'),
      q('BOSS: Build one word meaning “able to be understood again by reading it a second time” — in practice, “clear enough to read”.', ['unreadless', 'rereadable', 'misreadful', 'prereader'], 1, 'Re- (again) + read + -able (can be): rereadable — can be read again. It is the only real three-part build.', 'boss', 'Stack them in order: again + read + can-be.', 'BOSS · Three-part build'),
    ],
  },
  {
    id: 'context-clue-sleuth',
    title: 'Context Clue Sleuth',
    skill: 'Vocabulary',
    level: 'Grades 5-8',
    duration: '15 questions · about 9 min',
    description: 'Read like a detective: use nearby details to solve a word, name the clue type, and reject answers the evidence cannot support — finishing with a two-step Boss case.',
    instructions: 'Use the sentence context, not a guess. First find the meaning, then check which nearby words actually prove it. Save a hint for the Boss case.',
    coverImage: './images/games/context-clue-sleuth.jpg',
    tagline: 'Every word leaves a clue. Find the one that proves it.',
    difficultyLabel: 'Hard · Two-step Boss case',
    xpReward: 240, lives: 3, secondsPerQuestion: 40,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Boss case ×2 XP'],
    questions: [
      q('“The trail was slippery after the rain, so we proceeded cautiously, testing each stone before stepping.” What does cautiously mean?', ['In a hurried way', 'With care to avoid danger', 'Without looking', 'With excitement'], 1, 'Testing each stone shows the hikers are acting carefully to avoid danger.', 'warmup', 'What are the hikers doing with each stone?', 'Action clue'),
      q('“Unlike the crowded main hall, the annex was almost empty; only two students studied there.” What does annex most likely describe?', ['An additional building or section', 'A crowded hallway', 'A kind of exam', 'A person studying'], 0, 'The sentence compares two school spaces, so an annex is another section or building.', 'warmup', 'Unlike sets up a comparison between two places.', 'Contrast clue'),
      q('“The first plan was impractical: it required more supplies than the team could carry.” What does impractical mean here?', ['Not useful or workable', 'Very inexpensive', 'Easy to remember', 'Recently completed'], 0, 'The explanation after the colon says the team cannot carry the required supplies, so the plan is not workable.', 'warmup', 'Read what follows the colon — it explains the word.', 'Definition clue'),
      q('“Mina checked the calculation twice; nevertheless, her answer did not match the group’s result.” What does nevertheless signal?', ['A cause', 'A contrast', 'A sequence', 'A definition'], 1, 'Nevertheless introduces a contrast: Mina checked twice, but the result still differed.', 'warmup', 'Replace it with “but” — does the sentence still work?', 'Signal word'),
      q('“The path was arduous; we climbed steep steps for an hour and needed two breaks.” What does arduous mean?', ['Difficult and tiring', 'Short and smooth', 'Easy to forget', 'Brightly colored'], 0, 'The steep climb and breaks show the path was difficult and tiring.', 'warmup', 'Steep steps + two breaks = what kind of walk?', 'Example clue'),
      q('“Lina was reluctant to speak first, but she volunteered after her partner smiled.” The best clue for reluctant is ______.', ['“but she volunteered after” — the contrast with finally acting', '“Lina” — her name', '“speak first” — the topic', '“smiled” — the last word'], 0, 'The contrast structure shows she hesitated before acting willingly.', 'build', 'Reluctant people do act — just not at first.', 'Clue spotting'),
      q('“The glass was opaque, so sunlight could not pass through it.” If a window is opaque, you ______ see through it.', ['can clearly', 'cannot', 'can only at night', 'must polish it to'], 1, 'Opaque means not transparent; the sentence gives the result: light cannot pass through.', 'build', '“So” introduces the result of being opaque.', 'Cause → result'),
      q('“The two accounts corroborate each other: both list the same time and location.” Which answer goes BEYOND what corroborate can mean here?', ['Support with matching evidence', 'Agree on key details', 'Prove the event was exciting', 'Match each other'], 2, 'Matching time and location supports the accounts, but says nothing about excitement. That claim goes beyond the evidence.', 'build', 'Three answers stay close to “match”. One adds something new.', 'Over-claim trap'),
      q('“After the drought, the reservoir had diminished to a shallow pool, far smaller than the wide lake in spring photos.” Diminished means ______.', ['become smaller / less', 'become cleaner', 'been photographed', 'been refilled'], 0, '“Far smaller” and the contrast with the wide lake show it became smaller.', 'build', 'Compare “shallow pool” with “wide lake”.', 'Restatement clue'),
      q('“Her answer was ambiguous — it could mean the test was easy, or that it was easy to fail — so the teacher asked her to clarify.” Ambiguous means ______.', ['clearly stated once', 'open to more than one meaning', 'completely silent', 'deliberately funny'], 1, 'The sentence gives two possible meanings, so ambiguous = more than one meaning is possible.', 'build', 'Count the meanings offered after the dash.', 'Two-meaning clue'),
      q('Which clue TYPE is used here? “Meticulous — never missing a comma, a date or a spelling — Dara checked the poster three times.”', ['Example / restatement after dashes', 'Contrast with an opposite', 'A cause introduced by “so”', 'A sequence signal'], 0, 'The words between the dashes restate meticulous with concrete examples of care.', 'mastery', 'Look at what the dashed phrase does, not what meticulous means.', 'Name the clue'),
      q('“Unlike his gregarious sister, who chatted to every stall-holder, Tomas bought his vegetables quickly and spoke to no one.” Gregarious most likely means ______.', ['sociable and fond of company', 'quick at shopping', 'fond of vegetables', 'quiet and shy'], 0, 'Unlike contrasts Tomas (spoke to no one) with his sister (chatted to everyone): she is sociable.', 'mastery', 'Unlike = do the opposite of Tomas.', 'Contrast + inference'),
      q('“The plan is feasible, provided the rain stops; we have the tools, the time and the permission we need.” Feasible means ______.', ['possible to do in practice', 'already finished', 'popular with everyone', 'expensive to attempt'], 0, 'Tools, time and permission are listed as the conditions that make it doable.', 'mastery', 'The list after the semicolon is the evidence.', 'Evidence list'),
      q('“He gave a candid answer, admitting he had not done the reading, even though a vaguer reply would have been safer.” Candid means ______.', ['honest and direct, even when uncomfortable', 'carefully rehearsed', 'deliberately vague', 'angry and loud'], 0, 'Admitting something uncomfortable, when vagueness was safer, shows honest directness.', 'mastery', 'Why would a “vaguer reply” have been safer?', 'Motive clue'),
      q('BOSS CASE: “The witness was adamant that the gate was locked, and no apology or new photo could persuade her to reconsider.” Step 1: adamant means ______. Step 2: the proving clue is ______.', ['firm and refusing to change her mind · “no apology or new photo could persuade her”', 'unsure and easily persuaded · “the gate was locked”', 'angry about the gate · “a new photo”', 'honest about apologising · “to reconsider”'], 0, 'Adamant = firm and unpersuadable, and the second half of the sentence proves it: nothing could persuade her.', 'boss', 'First solve the meaning, then find the phrase that would still prove it alone.', 'BOSS · Two-step case'),
    ],
  },
  {
    id: 'main-idea-mission',
    title: 'Main Idea Mission',
    skill: 'Reading',
    level: 'Grades 6-9',
    duration: '14 questions · about 10 min',
    description: 'Follow the evidence through two science stories. Find the main idea, weigh what the evidence can actually support, and reject over-confident claims — ending on an author’s-purpose Boss round.',
    instructions: 'Read the passage once for its topic, then re-read details before choosing. In Mastery rounds, cross out any answer stronger than the evidence. The Boss round uses a second passage.',
    passage: courtyardPassage,
    coverImage: './images/games/main-idea-mission.jpg',
    tagline: 'Two field studies. Zero over-confident claims allowed.',
    difficultyLabel: 'Hard · Evidence-weighing Boss',
    xpReward: 230, lives: 3, secondsPerQuestion: 45,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Second-passage Boss'],
    questions: [
      q('What is the best main idea of the courtyard passage?', ['The ecology team found an early improvement and a remaining issue, so it plans to continue measuring.', 'The gardens permanently solved every drainage problem at the school.', 'The shade cloth made the sunny wall darker.', 'The team stopped taking photos after the first storm.'], 0, 'The passage includes less standing water, a bed that dries quickly, and a plan to keep measuring. It does not claim a complete fix.', 'warmup', 'A main idea must cover BOTH paragraphs.', 'Whole-text'),
      q('Why did students take photos before and after each change?', ['To compare visible changes over time', 'To replace the water measurements', 'To choose a new school mascot', 'To make the rain stop'], 0, 'The photos let the team observe and compare the courtyard as the project changed.', 'warmup', 'Before-and-after only makes sense for comparison.', 'Purpose detail'),
      q('What problem did the shade cloth address?', ['One planting bed dried quickly in afternoon sun.', 'The bucket was too large to carry.', 'The courtyard had no steps.', 'Students could not find the ecology team.'], 0, 'The passage says one bed dried quickly in the afternoon sun, so students moved a shade cloth over it.', 'warmup', 'Find “shade cloth” and read its sentence.', 'Locate detail'),
      q('Which statement is supported by the passage?', ['The team recorded observations after storms.', 'The team proved the gardens work in every season.', 'The shade cloth stopped all rainwater.', 'The students removed both planting beds.'], 0, 'The students measured water after storms and documented the project. They planned to continue studying it.', 'warmup', 'Three answers add “every / all” claims the text never makes.', 'Supported only'),
      q('Why is “the gardens solved every drainage problem” too strong?', ['The team planned to keep measuring and did not claim a complete fix.', 'The passage says it never rained.', 'The students did not take any measurements.', 'The courtyard had no planting beds.'], 0, 'The passage carefully limits its conclusion: less standing water was observed, but the team planned more study.', 'build', 'Look for the sentence beginning “but they did not claim…”.', 'Over-claim trap'),
      q('Which detail best supports the idea that the team used more than one kind of evidence?', ['It measured water after storms and took before-and-after photos.', 'It chose a new team name.', 'It planted flowers in every classroom.', 'It stopped observing after one day.'], 0, 'The passage names both measurements and photographs as evidence.', 'build', 'You need TWO different kinds named in one answer.', 'Evidence pair'),
      q('What is the most reasonable next step for the ecology team?', ['Continue collecting observations through another season.', 'Declare the drainage problem solved forever.', 'Remove the shade cloth immediately.', 'Stop recording any results.'], 0, 'The team explicitly plans to keep measuring through the next season.', 'build', 'The last sentence is a plan, not a conclusion.', 'Next step'),
      q('In “less standing water beside the steps,” standing water is best understood as ______.', ['water that remains lying on the ground and does not drain away', 'water students stand in to measure depth', 'drinking water stored in the bucket', 'rainwater inside the planting soil only'], 0, 'Standing water is water sitting on a surface without draining — the problem the beds were meant to reduce.', 'build', 'It collects “near the steps” on paving, not in a container.', 'Vocab in context'),
      q('A classmate concludes: “Planting beds always stop flooding.” What is the fairest evaluation?', ['Too general — this was one courtyard, three rainy weeks, and the team is still measuring.', 'Correct — one successful test proves it everywhere.', 'Wrong — the passage says the beds made flooding worse.', 'Impossible to judge — the passage gives no evidence at all.'], 0, 'One site and three weeks cannot support “always”, and the team itself refuses to claim a complete fix.', 'mastery', 'Check the sample size and the time span.', 'Evaluate a claim'),
      q('Which sentence from the passage does the MOST work in limiting the conclusion?', ['“but they did not claim the new gardens had fixed every drainage problem.”', '“rainwater often collected near the steps.”', '“They measured the amount of water left in a marked bucket after storms”', '“one bed dried quickly in the afternoon sun.”'], 0, 'That sentence explicitly refuses the over-confident claim — it is the author limiting the conclusion.', 'mastery', 'Which sentence is about what the team will NOT say?', 'Author’s craft'),
      q('If the team wanted stronger evidence next season, the best addition would be ______.', ['measure a similar paved area without planting beds, for comparison', 'take photos only on sunny days', 'ask students whether they like the gardens', 'stop using the marked bucket'], 0, 'A comparison area without beds would show whether the beds, rather than the weather, made the difference.', 'mastery', 'Fair tests change one thing and compare against a control.', 'Fair-test design'),
      q('What is the main idea of the library passage?', ['In one four-week test, drip-watered basil grew taller, but the team limits its claim and plans a repeat test.', 'Drip bottles are the best way to water every plant.', 'Hand watering harms basil and should be banned.', 'The library team proved window herbs never need holidays care.'], 0, 'Taller drip-watered basil + wetter soil noticed + a planned repeat with mint = a careful, limited conclusion.', 'mastery', 'Cover both paragraphs, including the planned repeat.', 'Whole-text · 2nd passage', { passage: libraryPassage }),
      q('Why does the library team record soil wetness next time, not just height?', ['Height alone could mislead — wetter soil, not the schedule itself, might explain the growth.', 'Wetness is easier to photograph than height.', 'Mint cannot be measured for height.', 'The basil had stopped growing completely.'], 0, 'They noticed the drip soil stayed wetter; measuring wetness helps separate schedule effects from simple water amount.', 'mastery', 'What difference did they notice besides height?', 'Variable check', { passage: libraryPassage }),
      q('BOSS: Which title best fits BOTH passages together?', ['“Careful Teams: Promising Results, Honest Limits”', '“Gardens and Basil Solve Every School Problem”', '“Why Measuring Is a Waste of Time”', '“Shade Cloths and Drip Bottles: A Shopping Guide”'], 0, 'Both teams report a promising result, refuse to over-claim, and plan to keep measuring. Only the first title captures both habits.', 'boss', 'Find the habit BOTH teams share, not a detail from one.', 'BOSS · Cross-passage', { passage: libraryPassage }),
    ],
  },
  {
    id: 'verb-relay',
    title: 'Verb Relay',
    skill: 'Grammar',
    level: 'Grades 4-8',
    duration: '15 questions · about 9 min',
    description: 'Race the relay through simple past, perfect tenses and the trickiest irregular verbs — with have/has/had traps, future-perfect builds and a three-form Boss leg.',
    instructions: 'Check both the time expression and any helping verb before you choose. In Mastery rounds, name the tense first, then pick the form it demands.',
    coverImage: './images/games/verb-relay.jpg',
    tagline: 'Pass the baton: past, perfect, future perfect, Boss leg.',
    difficultyLabel: 'Hard · Three-form Boss leg',
    xpReward: 240, lives: 3, secondsPerQuestion: 30,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Boss leg ×2 XP'],
    questions: [
      q('Yesterday our class ______ a model bridge.', ['build', 'built', 'has built', 'building'], 1, 'Yesterday marks a completed past action, so built is the simple past.', 'warmup', 'Yesterday = finished past, no helper needed.', 'Time clue'),
      q('We have ______ three design changes so far.', ['made', 'make', 'making', 'makes'], 0, 'Have is followed by the past participle made.', 'warmup', 'Have + which form?', 'Helper check'),
      q('Before the bell rang, the team had ______ its materials away.', ['put', 'puts', 'putting', 'putted'], 0, 'Had takes a past participle. Put has the same base, past, and participle form.', 'warmup', 'Putted is not a real word.', 'Irregular form'),
      q('Maya ______ the instructions to her partner last period.', ['give', 'given', 'gave', 'gives'], 2, 'Last period marks the simple past: gave.', 'warmup', 'No have/had in the sentence — so no participle.', 'Time clue'),
      q('The students have ______ the safety rules carefully.', ['wrote', 'written', 'write', 'writes'], 1, 'Have is followed by the past participle written (write–wrote–written).', 'warmup', 'Wrote is past; have needs the third form.', 'Three forms'),
      q('By Friday, our group will have ______ the new bridge design.', ['choose', 'chose', 'chosen', 'choosing'], 2, 'Will have is followed by the past participle chosen.', 'build', 'Will have + past participle = future perfect.', 'Future perfect'),
      q('The coach has ______ the teams into pairs. (split)', ['splitted', 'split', 'splitting', 'splits'], 1, 'Split is irregular with one form for base, past and participle — like put and cut.', 'build', 'Put, cut, split, set — one-form verbs.', 'One-form verb'),
      q('Last week, Dara ______ a useful question during science.', ['asks', 'asked', 'asking', 'has ask'], 1, 'Last week signals the simple past: asked.', 'build', '“Has ask” mixes a helper with the base form — always wrong.', 'Trap check'),
      q('She has ______ her ankle, so she cannot run the relay today. (break)', ['broke', 'broken', 'break', 'breaking'], 1, 'Has + past participle: break–broke–broken.', 'build', 'You need the third form of break.', 'Three forms'),
      q('By the time we arrived, the film ______ already ______. (begin)', ['has · began', 'had · begun', 'will · begins', 'is · begin'], 1, 'One past action finished before another past moment: had begun (begin–began–begun).', 'mastery', 'Arrived is past. The film started BEFORE that.', 'Past perfect'),
      q('Which sentence is correct?', ['He has ate lunch already.', 'He has eaten lunch already.', 'He has eat lunch already.', 'He has eating lunch already.'], 1, 'Has + past participle: eat–ate–eaten. “Has ate” is the classic relay fumble.', 'mastery', 'Ate is the past, never the participle.', 'Error hunt'),
      q('By 2030, engineers ______ a bridge across the bay. (complete — future perfect)', ['will have completed', 'have complete', 'had completing', 'will has completed'], 0, 'By + future time + will have + participle = future perfect.', 'mastery', '“By 2030” points forward to a deadline.', 'Future perfect'),
      q('The window ______ by the ball during yesterday’s match. (break — passive past)', ['was broken', 'has break', 'broke itself', 'is breaked'], 0, 'Passive past: was + past participle (broken). The window did not break anything.', 'mastery', 'The window receives the action — passive voice.', 'Passive build'),
      q('Choose the pair that completes BOTH: “She ______ across the lake last summer. She has ______ across it twice since.” (swim)', ['swam · swum', 'swum · swam', 'swimmed · swimmed', 'swims · swam'], 0, 'Swim–swam–swum: simple past swam alone; has needs the participle swum.', 'mastery', 'First blank has no helper; second has “has”.', 'Pair build'),
      q('BOSS LEG: “Before the bell rang, he ______ the letter, ______ it in his bag and ______ to class.” (write · put · run)', ['had written · put · ran', 'has wrote · putted · runned', 'written · puts · running', 'wrote · put · run yesterday'], 0, 'Had written (past perfect, before the bell) + put (one-form) + ran (simple past of run). Every distractor breaks at least one leg.', 'boss', 'Check each verb separately — the Boss leg drops the baton three times.', 'BOSS · Three verbs'),
    ],
  },
  {
    id: 'sound-match',
    title: 'Sound Match Studio',
    skill: 'Early literacy',
    level: 'Pre-K to Grade 2',
    duration: '15 questions · about 8 min',
    description: 'Listen for sounds, hunt digraphs and vowel teams, and crack the silent-e Boss rounds — a harder studio for growing readers, with two-sound traps in every Mastery round.',
    instructions: 'Say each word aloud if you can. In Mastery rounds, listen for the SECOND sound too — one answer will match only half the word.',
    coverImage: './images/games/sound-match.jpg',
    tagline: 'Digraph detectives, vowel teams and a silent-e Boss.',
    difficultyLabel: 'Builder · Two-sound Boss traps',
    xpReward: 230, lives: 3, secondsPerQuestion: 30,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Boss traps ×2 XP'],
    questions: [
      q('Which word begins with /sh/?', ['ship', 'chip', 'thin', 'this'], 0, 'Ship begins with /sh/. Chip begins with /ch/, while thin and this begin with /th/.', 'warmup', 'Say them slowly: shhh-ip.', 'Beginning sound'),
      q('Which word begins with /ch/?', ['shell', 'chin', 'ship', 'shop'], 1, 'Chin begins with the /ch/ sound.', 'warmup', 'Chin starts like cheese and chair.', 'Beginning sound'),
      q('In “dish,” which two letters spell the last sound?', ['di', 'is', 'sh', 'hi'], 2, 'The letters sh work together to spell the last sound in dish.', 'warmup', 'The last sound is /sh/, even though it is two letters.', 'Digraph hunt'),
      q('Change the first sound in “ship” from /sh/ to /ch/. Which new word do you make?', ['chip', 'shop', 'chin', 'chop'], 0, 'Replace just /sh/ with /ch/: ship becomes chip.', 'warmup', 'Only the first sound changes. The -ip stays.', 'Sound swap'),
      q('Which word has a short /a/ vowel sound?', ['cake', 'map', 'team', 'ride'], 1, 'Map has the short /a/ sound. The other choices include long vowel sounds.', 'warmup', 'Map says /a/ like apple.', 'Short vowel'),
      q('Which word ends with the /ch/ sound?', ['much', 'mush', 'must', 'muse'], 0, 'Much ends with /ch/, spelled ch.', 'build', 'Listen to the LAST sound, not the first.', 'Ending sound'),
      q('Which word begins with /sh/ AND has the short /i/ vowel?', ['ship', 'chip', 'shop', 'chop'], 0, 'Ship begins with /sh/ and has the short /i/ sound. Chip begins with /ch/, while shop has short /o/.', 'build', 'You must match two checks: start AND middle.', 'Two-sound match'),
      q('Which pair has the same beginning sound?', ['thin · chin', 'ship · shell', 'chip · ship', 'this · dish'], 1, 'Ship and shell both begin with /sh/. The other pairs start with different sounds.', 'build', 'Say each pair out loud, slowly.', 'Pair match'),
      q('“Phone” begins with the /f/ sound. Which letters spell that sound?', ['ph', 'fo', 'on', 'ne'], 0, 'The digraph ph spells /f/ in phone, photo and elephant.', 'build', 'Ph is a team: two letters, one /f/ sound.', 'Ph digraph'),
      q('Which word rhymes with “cake” and uses the same silent-e pattern?', ['lake', 'lack', 'lick', 'clock'], 0, 'Lake rhymes with cake and the final e makes the a long. Lack and lick have short a and i.', 'build', 'Rhyming words end with the same sound: -ake.', 'Rhyme + silent e'),
      q('Which word has the long /e/ sound spelled with a vowel team?', ['team', 'ten', 'tap', 'tin'], 0, 'Ea in team works as a vowel team to spell long /e/.', 'mastery', 'Two vowels together can say the first vowel’s name.', 'Vowel team'),
      q('Listen carefully: which word begins with /th/ as in “this” (buzzing th), not /th/ as in “thin” (quiet th)?', ['this', 'thin', 'three', 'thumb'], 0, 'This begins with the voiced (buzzing) /th/. Thin, three and thumb begin with the quiet /th/.', 'mastery', 'Put fingers on your throat: buzzing = this.', 'Voiced th trap'),
      q('Which word ends with TWO sounds blended together: /s/ + /t/?', ['last', 'lash', 'late', 'lass'], 0, 'Last ends with the blend /st/. Lash ends /sh/, late ends /t/ alone, lass ends /s/ alone.', 'mastery', 'Sound out the ending letter by letter.', 'Ending blend'),
      q('Change ONLY the middle sound in “chop” from /o/ to /i/. Which word do you make?', ['chip', 'chap', 'shop', 'chin'], 0, 'Chop → chip: the beginning /ch/ and ending /p/ stay; only /o/ becomes /i/.', 'mastery', 'Keep ch- and -p exactly where they are.', 'Middle swap'),
      q('BOSS: Which word matches ALL three clues? ① begins with /sh/ ② has a long /a/ sound ③ ends with /d/', ['shade', 'ship', 'shed', 'shod'], 0, 'Shade: sh- + long a (silent e) + /d/. Ship fails clue ②, shed fails ②, shod fails ②.', 'boss', 'Check the three clues one at a time and cross words out.', 'BOSS · Three clues'),
    ],
  },
  {
    id: 'listening-scout',
    title: 'Listening Scout',
    skill: 'Listening',
    level: 'Grades 5-9',
    duration: '14 questions · about 10 min',
    description: 'Hear two classroom planning discussions, collect key details, spot fair-test reasoning and infer the next step — the second recording is the Boss investigation.',
    instructions: 'Play the recording up to two times, or open the transcript. Rounds 8–14 use a NEW recording — press play again. In Mastery rounds, listen for what the teacher refuses to claim.',
    audioScript: listeningGameScript,
    coverImage: './images/games/listening-scout.jpg',
    tagline: 'Two recordings. Fair tests, hidden traps, one Boss inquiry.',
    difficultyLabel: 'Hard · Second-recording Boss',
    xpReward: 230, lives: 3, secondsPerQuestion: 45,
    challengeModes: ['Classic', 'Time Trial', 'Survival · 3 lives', 'Boss recording ×2 XP'],
    questions: [
      q('What will the students compare?', ['The turning speed of four wind-turbine blade shapes', 'The color of two classroom fans', 'The temperature inside two books', 'The number of students attending an open house'], 0, 'The teacher says the group will test four blade shapes and count how many turns each makes.', 'warmup', 'Listen for the number of blade shapes.', 'Detail hunt', { audioScript: listeningGameScript }),
      q('Why will students keep the fan on the same setting?', ['To keep the wind speed more consistent', 'To finish the project earlier', 'To make every blade the same shape', 'To avoid recording the results'], 0, 'Using the same setting helps keep wind speed consistent across the trials.', 'warmup', 'The teacher says “stays more consistent”.', 'Reason clue', { audioScript: listeningGameScript }),
      q('How long will students count the blade turns?', ['Ten seconds', 'Twenty seconds', 'Thirty seconds', 'One minute'], 2, 'The teacher says to count turns for thirty seconds, repeat three times, and calculate an average.', 'warmup', 'A number is spoken — catch it.', 'Number detail', { audioScript: listeningGameScript }),
      q('What is the teacher’s main reason for splitting the blade tests over two days?', ['To keep the test fair instead of rushing every design into one afternoon', 'To change the fan setting each day', 'To avoid testing more than one blade shape', 'To cancel the open house'], 0, 'The teacher emphasizes a fair comparison and consistent fan distance, not finishing in one afternoon.', 'build', '“Our goal is to compare fairly, not to finish in one afternoon.”', 'Main reason', { audioScript: listeningGameScript }),
      q('What should students do after counting turns for each blade shape?', ['Repeat each trial three times and calculate an average', 'Change the fan setting for every trial', 'Record only the fastest result', 'Move the fan farther away each time'], 0, 'Repeating trials and averaging them makes the comparison more dependable.', 'build', 'Three repeats + one average.', 'Procedure', { audioScript: listeningGameScript }),
      q('Which detail is most important for a fair blade comparison?', ['Keep the fan setting and distance consistent.', 'Use a different fan for every shape.', 'Test each blade for a different length of time.', 'Choose the blade that looks nicest.'], 0, 'The teacher keeps conditions alike so blade shape is the main changing factor.', 'build', 'Fair = everything else stays the same.', 'Fair test', { audioScript: listeningGameScript }),
      q('What does the student need to record to compare the four designs?', ['The average number of turns each shape makes in thirty seconds', 'The color of the fan and the classroom door', 'How many people visit the open house', 'The blade shape that took the longest to draw'], 0, 'The task is to count turns for thirty seconds, repeat three times, and calculate an average.', 'build', 'Turns + time + average.', 'Record plan', { audioScript: listeningGameScript }),
      q('NEW RECORDING: What question is the seedling project trying to answer?', ['Whether watering little and often beats watering a lot twice a week', 'Whether tomatoes grow better than basil', 'Whether sunny shelves are warmer than shady ones', 'Whether the garden club likes watering plants'], 0, 'The teacher states it directly: little-and-often versus a lot twice a week.', 'mastery', 'The teacher opens with “our question is…”.', 'Boss recording · Question', { audioScript: listeningGameScript2 }),
      q('NEW RECORDING: Which three things stay the SAME for both groups?', ['Total water, soil and shelf light', 'Watering times, pot colour and plant height', 'Leaf colour, height and schedule', 'The students measuring them'], 0, 'Same total water, same soil, same sunny shelf — only the schedule changes.', 'mastery', 'Listen for the list after “both groups get…”.', 'Boss recording · Controls', { audioScript: listeningGameScript2 }),
      q('NEW RECORDING: Why does the teacher also record leaf colour, not just height?', ['A tall plant with pale leaves is not necessarily healthy', 'Leaf colour changes the watering schedule', 'The garden club asked for drawings', 'Height cannot be measured every three days'], 0, 'The teacher warns that height alone can mislead: pale leaves signal poor health.', 'mastery', '“Not necessarily healthy” is the key phrase.', 'Boss recording · Why', { audioScript: listeningGameScript2 }),
      q('NEW RECORDING: How often do they measure the seedlings?', ['Every three days', 'Every day', 'Once a week', 'Only at the end'], 0, '“Measure the height every three days.”', 'mastery', 'Catch the number phrase.', 'Boss recording · Detail', { audioScript: listeningGameScript2 }),
      q('NEW RECORDING: If after four weeks the difference is tiny, what does the teacher say it probably means?', ['The schedule probably does not matter much — and they should repeat before recommending anything', 'Little-and-often has definitely won', 'Twice-a-week watering should be banned', 'The measurements must be wrong'], 0, 'A tiny difference = probably no real effect, and no recommendation until a repeat test.', 'mastery', 'Listen for “probably” — a careful, limited claim.', 'Boss recording · Inference', { audioScript: listeningGameScript2 }),
      q('NEW RECORDING: Which next step does the teacher insist on before telling the garden club anything?', ['Repeat the test', 'Water the plants more', 'Move the shelf', 'Measure only the tallest plant'], 0, '“We repeat the test before we recommend anything to the garden club.”', 'mastery', 'The last sentence holds the next step.', 'Boss recording · Next step', { audioScript: listeningGameScript2 }),
      q('BOSS: Both teachers refuse to do the same thing. What is it?', ['Claim more than one fair test can support — both insist on consistent conditions and repeat evidence first', 'Let students choose their own fan settings', 'Record results in a notebook', 'Finish the project in one afternoon'], 0, 'Recording 1 keeps fan conditions consistent; Recording 2 repeats before recommending. Both refuse over-claiming from a single rushed test.', 'boss', 'Compare the habit across BOTH recordings, not a detail from one.', 'BOSS · Cross-recording', { audioScript: listeningGameScript2 }),
    ],
  },
];

/** Total XP printed on cards / briefing (points already encode tier value). */
export function gameXpTotal(game: LearningGame): number {
  if (game.questions.length === 0) return game.xpReward ?? 0;
  return game.questions.reduce((sum, item) => sum + item.points, 0);
}

/** Tier label for a round index inside a run. */
export function tierForIndex(index: number, count: number): GameTier {
  if (count <= 1) return 'boss';
  if (index === count - 1) return 'boss';
  const progress = index / (count - 1);
  if (progress < 0.34) return 'warmup';
  if (progress < 0.68) return 'build';
  return 'mastery';
}
