import type { ClassroomAssignment } from '../types/assignment';

export const CLASSROOM_ASSIGNMENTS: Record<string, ClassroomAssignment> = {
  'res-1': {
    resourceId: 'res-1',
    title: 'The City That Learned to Keep Its Cool',
    subtitle: 'A two-text reading lab in evidence, inference, and synthesis',
    subject: 'Reading comprehension',
    gradeBand: 'Suggested grades 6-8 · Intermediate reading',
    duration: '30-35 minutes',
    skillFocus: ['Central idea and supporting detail', 'Vocabulary in context', 'Evidence-based inference', 'Cross-text synthesis'],
    objectives: [
      'Distinguish a central idea from a supporting detail.',
      'Use nearby evidence to infer a cause or limitation.',
      'Combine information from two short nonfiction texts.'
    ],
    materials: ['Pencil', 'Highlighter (optional)'],
    teacherNotes: [
      'Have students underline one sentence that supports each selected answer.',
      'For a stretch: ask students to explain why one tempting distractor is incorrect.',
      'The passages are original classroom practice texts, not official test material.'
    ],
    sections: [
      {
        title: 'Read 1 · A cooler block',
        directions: 'Read the passage once for the big idea. Read it again and mark details that explain what changed and what did not.',
        passage: [
          'On hot afternoons, the bus stop on Mercer Street could feel warmer than the nearby park. Two years ago, residents planted rows of young trees along the sidewalk. They also replaced a dark paved corner with a small rain garden. The garden allowed water to soak into the ground instead of running straight into a storm drain.',
          'A university team measured temperatures at the bus stop and on a similar block without new trees. By the second summer, the shaded bus stop was cooler at midday. The rain garden also held water after storms, although it did little to cool the street by itself. Researchers cautioned that the comparison covered only two summers and that weather varied from year to year. The project did not solve the city’s heat problem, but it gave planners local evidence about which changes helped and where.'
        ],
        questions: [
          {
            prompt: 'Which statement best expresses the central idea of the passage?',
            choices: [
              'A. Rain gardens are the most effective way to cool every city street.',
              'B. A neighborhood project produced useful, measured evidence about shade and stormwater, while leaving questions for further study.',
              'C. A university team proved that weather does not affect street temperatures.',
              'D. Residents replaced the entire bus stop with a public park.'
            ],
            answer: 'B. The passage describes two changes, their different measured effects, and the limits of the short study.',
            rationale: 'A overstates the rain garden result, C contradicts the passage, and D is not described.'
          },
          {
            prompt: 'According to the researchers, which change was associated with a cooler bus stop at midday?',
            choices: ['A. Planting rows of trees', 'B. Paving the corner darker', 'C. Adding a storm drain', 'D. Measuring the block for one afternoon'],
            answer: 'A. Planting rows of trees.',
            rationale: 'The passage connects the shade from the new trees with a cooler bus stop.'
          },
          {
            prompt: 'In the passage, what does “cautioned” most nearly mean?',
            choices: ['A. Celebrated a success', 'B. Warned readers not to draw a stronger conclusion than the evidence supports', 'C. Repeated a measurement', 'D. Changed the project plan'],
            answer: 'B. Warned readers not to draw a stronger conclusion than the evidence supports.',
            rationale: 'The next clause gives a reason for caution: the study covered only two summers and weather varied.'
          },
          {
            prompt: 'Why does the author mention that the rain garden “did little to cool the street by itself”?',
            responseLines: 2,
            answer: 'It distinguishes the rain garden’s stormwater benefit from the trees’ cooling benefit and prevents readers from treating both changes as having the same effect.',
            rationale: 'A strong response explains why this detail sharpens the comparison between the two interventions.'
          }
        ]
      },
      {
        title: 'Read 2 · What the measurements can tell us',
        directions: 'Read the follow-up note. Then compare its evidence with the first passage. Use details from both texts in your final response.',
        passage: [
          'A year after the Mercer Street measurements began, students from a nearby school joined the project. At noon, they recorded temperatures in the sun and beneath tree canopies at four bus stops. At all four locations, shaded pavement was cooler during their visits. The students also recorded the time, cloud cover, and recent rainfall so the team could compare like with like.',
          'The student observations supported the idea that shade can lower surface temperatures. They could not show whether every route would benefit equally, or whether cooler pavement always meant cooler air for people waiting nearby. The team plans to repeat the measurements in the morning and late afternoon before recommending which stops should receive trees first.'
        ],
        questions: [
          {
            prompt: 'What new method did the student team use to make its comparisons more useful?',
            responseLines: 2,
            answer: 'They compared sunny and shaded pavement at four stops and recorded conditions such as time, cloud cover, and recent rainfall.',
            rationale: 'Naming both the paired locations and recorded conditions shows how the comparison was strengthened.'
          },
          {
            prompt: 'Which conclusion is best supported by both passages?',
            choices: [
              'A. Every street should receive the same number of trees immediately.',
              'B. Shade is linked to cooler pavement in the places measured, but more observations are needed before deciding what works everywhere.',
              'C. Rain gardens and trees have identical effects on temperature.',
              'D. Morning and afternoon measurements are unnecessary.'
            ],
            answer: 'B. Both texts describe cooler shaded surfaces and explicitly note limits or the need for more observations.',
            rationale: 'The passages support a local finding, not a universal rule or a claim that the two interventions are equivalent.'
          },
          {
            prompt: 'Synthesize both texts in 3-4 sentences: What is the strongest finding so far, and what question should the researchers investigate next? Cite one detail from each passage.',
            responseLines: 4,
            answer: 'Sample: Both passages suggest that shade can lower pavement temperatures: Mercer Street’s shaded bus stop was cooler at midday, and shaded pavement was cooler at all four student-measured stops. However, neither text proves the effect will be equal everywhere or at every time. Researchers should measure more stops and times of day before deciding where trees will help most.',
            rationale: 'Award full credit for a supported finding, a limitation or next question, and one accurate detail from each text.'
          }
        ]
      }
    ]
  },
  'res-2': {
    resourceId: 'res-2',
    title: 'Word Builders: Affixes Under the Microscope',
    subtitle: 'Decode, build, and defend academic vocabulary choices',
    subject: 'Morphology and vocabulary',
    gradeBand: 'Suggested grades 4-7 · Vocabulary',
    duration: '25-30 minutes',
    skillFocus: ['Use word parts to determine meaning', 'Apply common prefixes and suffixes', 'Explain vocabulary in context'],
    objectives: [
      'Use an affix and a base word together to predict meaning.',
      'Build a correctly spelled word from a definition and a base.',
      'Explain why a word choice fits its sentence.'
    ],
    materials: ['Pencil', 'Highlighter (optional)'],
    teacherNotes: [
      'Ask students to box the affix and underline the base in each completed word.',
      'Accept a sensible alternative in the open response if the word is correctly formed and its meaning fits.'
    ],
    sections: [
      {
        title: 'Part A · Read the word parts',
        directions: 'Use the word bank to complete each definition. Then add one example of your own in the margin.',
        wordBank: 'mis- · inter- · trans- · -able · -ist · -ology',
        questions: [
          { prompt: 'Means “wrongly” or “badly”; as in misread.', answer: 'mis-', rationale: 'The prefix mis- means wrongly or incorrectly.' },
          { prompt: 'Means “between”; as in interschool.', answer: 'inter-', rationale: 'The prefix inter- means between or among.' },
          { prompt: 'Means “across” or “through”; as in transport.', answer: 'trans-', rationale: 'The prefix trans- can mean across or through.' },
          { prompt: 'Means “capable of being”; as in washable.', answer: '-able', rationale: 'The suffix -able often means capable of being.' },
          { prompt: 'Names a person who studies or practices something; as in scientist.', answer: '-ist', rationale: 'The suffix -ist can name a person who practices or specializes in something.' },
          { prompt: 'Names a field or study; as in biology.', answer: '-ology', rationale: 'The suffix -ology means the study or science of a subject.' }
        ]
      },
      {
        title: 'Part B · Build it in context',
        directions: 'Complete each sentence by changing the base word in parentheses. Show the affix you added.',
        questions: [
          { prompt: 'The map was hard to follow because the labels were almost impossible to read. The labels were __________ (read).', answer: 'unreadable', rationale: 'un- + read + -able gives unreadable: not able to be read.' },
          { prompt: 'Please check the instructions again; we may have __________ the final step. (interpret)', answer: 'misinterpreted', rationale: 'mis- changes interpret to misinterpret; the past-tense sentence uses misinterpreted.' },
          { prompt: 'The class will use the empty jars again rather than throw them out. The jars are __________. (use)', answer: 'reusable', rationale: 're- + use + -able gives reusable: able to be used again.' },
          { prompt: 'The two teams did not share the same opinion. They __________ about the best solution. (agree)', answer: 'disagreed', rationale: 'dis- + agree gives disagree; the past tense is disagreed.' },
          { prompt: 'A person who studies rocks and minerals is a __________. (geology)', answer: 'geologist', rationale: 'geology + -ist is geologist; drop the final y before adding -ist.' }
        ]
      },
      {
        title: 'Part C · Explain your thinking',
        directions: 'Do not stop at the definition. Use the base word and affix to justify how the whole word works.',
        questions: [
          { prompt: 'Break “miscommunication” into its meaningful parts. Explain how those parts combine to create its meaning.', responseLines: 3, answer: 'mis- + communicate + -ion. mis- means wrongly or unsuccessfully, while -ion makes an action or result into a noun. Miscommunication is a failure or mistake in communicating.', rationale: 'A complete response identifies the prefix, base, and suffix and explains the combined meaning.' },
          { prompt: 'A classmate says “reusable” means “used again already.” Is that precise? Explain the difference between reusable and reused.', responseLines: 3, answer: 'Not quite. Reusable means capable of being used again; reused means that it was used again in the past.', rationale: 'Look for the difference between a possibility/capability and a completed action.' },
          { prompt: 'Choose a word from this assignment. Write a new sentence that makes its meaning clear without defining it directly.', responseLines: 3, answer: 'Answers vary. Example: “After checking the table twice, Nia noticed that she had misinterpreted the final row.”', rationale: 'The sentence should use the word accurately and provide context that supports its meaning.' }
        ]
      }
    ]
  },
  'res-3': {
    resourceId: 'res-3',
    title: 'Sound Detectives: Short Vowels and Digraphs',
    subtitle: 'Listen closely, map sounds, and make a one-sound switch',
    subject: 'Early reading and phonics',
    gradeBand: 'Pre-K to Grade 1 · Beginning readers',
    duration: '15-20 minutes',
    skillFocus: ['Hear and identify initial and final sounds', 'Recognize sh and ch digraphs', 'Blend and segment simple words'],
    objectives: [
      'Hear the difference between /sh/ and /ch/.',
      'Connect a spoken sound to the letters that represent it.',
      'Blend and change sounds in short words.'
    ],
    materials: ['Pencil or crayon', 'Teacher or partner to read the word list aloud'],
    teacherNotes: [
      'Read the word list aloud once at a natural pace and once with a short pause between words. Do not name the spelling pattern first.',
      'Invite the child to say each word aloud before marking or writing.',
      'For students who need support, model the first sound-box row with counters or finger taps.'
    ],
    sections: [
      {
        title: '1 · Hear the beginning and ending',
        directions: 'Listen as a grown-up reads each word. Put a box around every word with sh. Circle every word with ch.',
        wordBank: 'ship · chin · wish · much · shop · chop · dish · chat · rush · rich · shell · chess',
        questions: [
          { prompt: 'How many words did you box? How many did you circle?', responseLines: 1, answer: '6 words with sh and 6 words with ch.', rationale: 'The word list is balanced to help learners check that both sounds were heard.' },
          { prompt: 'Say “much” slowly. Which two letters work together to spell its last sound?', responseLines: 1, answer: 'ch', rationale: 'In much, ch spells the final /ch/ sound.' },
          { prompt: 'Which word starts with the same sound as “shop”: shell or chin? Tell your partner how you know.', responseLines: 2, answer: 'Shell. Both shell and shop begin with /sh/.', rationale: 'Listen for the initial sound, not the final letters.' }
        ]
      },
      {
        title: '2 · Tap the sounds',
        directions: 'Say each word. Tap once for each sound you hear. The two letters in sh or ch make one sound together.',
        questions: [
          { prompt: 'ship: Write the first sound, middle sound, and last sound in order.', responseLines: 1, answer: '/sh/ · /i/ · /p/', rationale: 'The digraph sh is one sound; ship has three phonemes.' },
          { prompt: 'chop: Write the first sound, middle sound, and last sound in order.', responseLines: 1, answer: '/ch/ · /o/ · /p/', rationale: 'The digraph ch is one sound; chop has three phonemes.' },
          { prompt: 'Change the first sound in ship from /sh/ to /ch/. Write the new word.', responseLines: 1, answer: 'chip', rationale: 'Changing only the first sound turns ship into chip.' }
        ]
      },
      {
        title: '3 · Short-vowel word lab',
        directions: 'Choose from the word bank. Read each whole sentence after you fill in the word.',
        wordBank: 'map · sit · red · cup',
        questions: [
          { prompt: 'We spread the paper __________ on the desk to find the river.', answer: 'map', rationale: 'Map fits the meaning and the short-a sound.' },
          { prompt: 'Please __________ by the rug while I find your book.', answer: 'sit', rationale: 'Sit fits the meaning and the short-i sound.' },
          { prompt: 'The ripe apple has a bright __________ spot.', answer: 'red', rationale: 'Red fits the meaning and the short-e sound.' },
          { prompt: 'After the game, I drank cool water from my __________.', answer: 'cup', rationale: 'Cup fits the meaning and the short-u sound.' }
        ]
      }
    ]
  },
  'res-4': {
    resourceId: 'res-4',
    title: 'Speak to Be Understood: Plan, Support, Reflect',
    subtitle: 'Timed speaking practice with a transparent teacher scoring guide',
    subject: 'Academic speaking',
    gradeBand: 'Suggested grades 7-12 · Academic English practice',
    duration: '25 minutes',
    skillFocus: ['Organize a spoken response', 'Support a claim with a specific example', 'Use clear pacing and transitions'],
    objectives: [
      'State a clear position in the opening sentence.',
      'Support the position with a relevant example and explanation.',
      'Use a brief plan to deliver a coherent timed response.'
    ],
    materials: ['Timer', 'Recording device or partner listener (optional)'],
    teacherNotes: [
      'This is original TOEFL-style classroom practice, not an official TOEFL task.',
      'Score ideas and language separately. A strong accent is not an error when the speaker is understandable.',
      'Allow a second attempt after students review one specific improvement target.'
    ],
    sections: [
      {
        title: 'Task 1 · Choose and support',
        directions: 'Planning: 30 seconds. Speaking: 45 seconds. Choose one prompt. Use the plan lines before speaking.',
        questions: [
          { prompt: 'Prompt A: Should schools set aside time for students to read books they choose themselves? Give one reason and a specific example.', responseLines: 3, answer: 'Look for a clear position, one relevant reason, a concrete example, and a closing sentence. Answers will vary.', rationale: 'The example should explain the reason, not merely repeat the opinion.' },
          { prompt: 'Prompt B: Is it more useful to learn a new skill alone or with other people? Choose one approach and explain when it works well.', responseLines: 3, answer: 'Look for a clear choice, a relevant situation, and an explanation of how the approach supports learning. Answers will vary.', rationale: 'A specific situation makes the response more persuasive than a general claim.' }
        ]
      },
      {
        title: 'Task 2 · Summarize and connect',
        directions: 'Read the short note. You have 45 seconds to plan and 60 seconds to speak. Summarize the idea, then connect it to a classroom example.',
        passage: ['A school garden can be more than a place to grow vegetables. When students measure plant growth, compare soil conditions, and keep observation journals, they practice mathematics and scientific reasoning while caring for a shared space. A garden works best when its activities are connected to clear learning goals.'],
        questions: [
          { prompt: 'Record two important ideas from the note and one example you could use in your spoken response.', responseLines: 4, answer: 'Key ideas include that gardens can support learning across subjects and that students can measure, compare, and keep observations. A suitable example connects one of these actions to a class activity.', rationale: 'An effective response summarizes rather than recites the entire note, then adds a relevant example.' },
          { prompt: 'After speaking, write one transition you used and one sentence you would improve on a second attempt.', responseLines: 3, answer: 'Answers vary. Strong reflections name a real transition and identify a specific improvement, such as adding an example or slowing down.', rationale: 'Encourage an observable next step rather than “speak better.”' }
        ]
      },
      {
        title: 'Task 3 · Listener check',
        directions: 'Ask a partner to listen without interrupting. The listener should mark one strength and one practical next step.',
        questions: [
          { prompt: 'Listener: What was the speaker’s main point? Write it in one sentence.', responseLines: 2, answer: 'Answers vary. The listener should be able to restate the speaker’s actual position or summary accurately.', rationale: 'If the listener cannot identify the main point, the speaker should make the opening clearer.' },
          { prompt: 'Speaker: Which single revision would make your response clearer: a stronger opening, a more specific example, a transition, or a slower pace? Explain.', responseLines: 2, answer: 'Answers vary. A useful response chooses one revision and explains how it helps the listener.', rationale: 'Reflection turns the rubric into a specific practice goal.' }
        ]
      }
    ],
    rubric: [
      { criterion: 'Organization', points: 4, description: '4: clear opening and logical close; 2-3: mostly organized with one unclear transition; 0-1: difficult to follow.' },
      { criterion: 'Support', points: 4, description: '4: relevant, specific example fully explained; 2-3: example present but general or partly explained; 0-1: little or no support.' },
      { criterion: 'Language', points: 4, description: '4: varied, accurate language; 2-3: meaning clear with some errors; 0-1: errors often obscure meaning.' },
      { criterion: 'Delivery', points: 4, description: '4: understandable pace and clear speech; 2-3: generally understandable with uneven pacing; 0-1: frequent breakdowns affect understanding.' }
    ]
  },
  'res-5': {
    resourceId: 'res-5',
    title: 'Paraphrase With Purpose: Evidence, Not Echoes',
    subtitle: 'A source-literacy workshop in meaning, sentence structure, and citation',
    subject: 'Academic writing',
    gradeBand: 'Suggested grades 7-12 · Academic writing',
    duration: '30-35 minutes',
    skillFocus: ['Identify a source’s key idea', 'Paraphrase without copying its structure', 'Credit a source accurately'],
    objectives: [
      'Separate a source’s main claim from its examples.',
      'Restate the claim with original sentence structure and precise vocabulary.',
      'Preserve the author’s meaning and include source credit.'
    ],
    materials: ['Pencil', 'Highlighter in two colors (optional)'],
    teacherNotes: [
      'The short source and bibliographic details below are fictional and created for this classroom exercise.',
      'Accept different wording when the idea remains accurate and the source is credited.',
      'For a stretch, ask students to explain what information was intentionally left out of their paraphrase.'
    ],
    sections: [
      {
        title: 'Read the source',
        directions: 'Read the source twice. On the first read, underline the main claim. On the second, circle the evidence that supports it.',
        passage: ['Fictional classroom source: Rivera, M. (2023). “Small Trees, Cooler Streets.” The City Science Review.\n\nStreet trees can make walking routes more comfortable during hot weather, but their benefits depend on where they are planted. In a study of three school routes, shaded sections had cooler pavement at midday than nearby sunny sections. Trees also need enough space and regular care to survive. For city planners, the best planting plan is not simply the one with the most trees; it is the one that puts healthy shade where people need it most.'],
        questions: [
          { prompt: 'State the author’s main claim in 10-15 words. Do not copy a complete sentence from the passage.', responseLines: 2, answer: 'Sample: Tree planting is most useful when healthy shade is placed where people need it.', rationale: 'The response should include both the benefit of shade and the importance of thoughtful placement.' },
          { prompt: 'Name one piece of evidence and one practical limitation or condition the author includes.', responseLines: 2, answer: 'Evidence: shaded route sections had cooler midday pavement. Condition: trees need adequate space and regular care to survive.', rationale: 'A strong reader distinguishes a study observation from the conditions for making the recommendation work.' }
        ]
      },
      {
        title: 'Part A · Diagnose the paraphrase',
        directions: 'Select the version that preserves the source’s meaning while using its own sentence structure.',
        questions: [
          {
            prompt: 'Which paraphrase is strongest?',
            choices: [
              'A. Street trees can make walking routes more comfortable during hot weather, but their benefits depend on where they are planted.',
              'B. Planting healthy trees in carefully selected places can cool routes people use, and planners should consider care and shade needs (Rivera, 2023).',
              'C. City planners should plant the most trees on every route because trees always keep cities cool.'
            ],
            answer: 'B. It restates the idea with new structure, keeps the source’s qualification, and credits Rivera.',
            rationale: 'A repeats the source sentence almost word for word. C changes the claim and removes its qualification.'
          },
          { prompt: 'Explain one way version A copies too closely and one way version C changes the author’s meaning.', responseLines: 3, answer: 'A repeats the original wording and sentence structure with little change. C turns a qualified recommendation into an absolute claim and says to plant the most trees everywhere.', rationale: 'Students should identify both copying and meaning drift as separate problems.' }
        ]
      },
      {
        title: 'Part B · Write, credit, and check',
        directions: 'Write a 35-55 word paraphrase of the source. Change the sentence structure, keep the important qualification, and include an in-text citation.',
        questions: [
          { prompt: 'Your paraphrase:', responseLines: 6, answer: 'Sample: Tree shade may make familiar walking routes cooler, but location and maintenance matter. Midday measurements found lower pavement temperatures in shaded sections of three school routes. Rivera (2023) argues that planners should prioritize lasting shade where people need it instead of focusing only on the number of trees.', rationale: 'Use the rubric below for different valid paraphrases. The sample preserves the main idea, one piece of evidence, the qualification, and source credit.' },
          { prompt: 'Self-check: Underline one phrase you changed substantially. Circle your citation. Put a star beside the qualification you preserved.', responseLines: 2, answer: 'Student self-check. Confirm that the response uses new wording and structure, includes (Rivera, 2023) or Rivera (2023), and keeps the point that placement and care matter.', rationale: 'The checklist makes source use visible before students submit.' }
        ]
      }
    ],
    rubric: [
      { criterion: 'Meaning', points: 3, description: '3: accurately preserves the main claim and qualification; 2: mostly accurate; 1: important idea missing; 0: meaning is substantially changed.' },
      { criterion: 'Original wording', points: 3, description: '3: new vocabulary and sentence structure; 2: mostly original with a close phrase; 1: source structure closely copied; 0: copied text.' },
      { criterion: 'Evidence', points: 3, description: '3: includes a relevant source detail; 2: detail present but vague; 1: detail inaccurate; 0: no evidence.' },
      { criterion: 'Citation', points: 3, description: '3: source credited clearly; 2: citation has a minor error; 1: source named incompletely; 0: no credit.' }
    ]
  },
  'res-6': {
    resourceId: 'res-6',
    title: 'Verb Relay: Past, Participle, and Proof',
    subtitle: 'A cooperative grammar game where teams must use every form in context',
    subject: 'Grammar and classroom game',
    gradeBand: 'Suggested grades 3-6 · Grammar',
    duration: '25-30 minutes',
    skillFocus: ['Recognize common irregular verb forms', 'Use past-tense and participle forms in context', 'Explain a correction'],
    objectives: [
      'Supply the past-tense and past-participle form of common irregular verbs.',
      'Choose the correct form based on the helping verb and sentence meaning.',
      'Use an irregular verb accurately in an original sentence.'
    ],
    materials: ['Pencil', 'Scissors for optional verb cards', 'Team score sheet'],
    teacherNotes: [
      'Teams of two to four. Allow a dictionary only during the final challenge round.',
      'Award one point for each correct form and one bonus point for a complete, grammatical sentence.',
      'Students may explain a disputed answer before the teacher reveals the key.'
    ],
    sections: [
      {
        title: 'Round 1 · Build the verb ladder',
        directions: 'Work in pairs. Write the simple past and past participle for each base verb. Then compare with another pair.',
        questions: [
          { prompt: 'begin → simple past: __________ → past participle: __________', answer: 'began → begun', rationale: 'Use begun after a helper such as has, have, or had.' },
          { prompt: 'bring → simple past: __________ → past participle: __________', answer: 'brought → brought', rationale: 'Both forms are brought.' },
          { prompt: 'catch → simple past: __________ → past participle: __________', answer: 'caught → caught', rationale: 'Both forms are caught.' },
          { prompt: 'choose → simple past: __________ → past participle: __________', answer: 'chose → chosen', rationale: 'The final n appears in the past participle chosen.' },
          { prompt: 'fall → simple past: __________ → past participle: __________', answer: 'fell → fallen', rationale: 'Fell is the simple past; fallen is the participle.' },
          { prompt: 'freeze → simple past: __________ → past participle: __________', answer: 'froze → frozen', rationale: 'Frozen is used with a helping verb or as an adjective.' },
          { prompt: 'hide → simple past: __________ → past participle: __________', answer: 'hid → hidden', rationale: 'Hidden is the participle.' },
          { prompt: 'leave → simple past: __________ → past participle: __________', answer: 'left → left', rationale: 'Both forms are left.' },
          { prompt: 'ride → simple past: __________ → past participle: __________', answer: 'rode → ridden', rationale: 'Ridden is used with a helping verb.' },
          { prompt: 'speak → simple past: __________ → past participle: __________', answer: 'spoke → spoken', rationale: 'Spoken is used with a helping verb.' },
          { prompt: 'teach → simple past: __________ → past participle: __________', answer: 'taught → taught', rationale: 'Both forms are taught.' },
          { prompt: 'throw → simple past: __________ → past participle: __________', answer: 'threw → thrown', rationale: 'Thrown is used with a helping verb.' }
        ]
      },
      {
        title: 'Round 2 · Choose the right form',
        directions: 'Write the correct form of the verb in parentheses. Look for time words and helping verbs.',
        questions: [
          { prompt: 'Yesterday, our team __________ (choose) a book for the class read-aloud.', answer: 'chose', rationale: 'Yesterday signals the simple past.' },
          { prompt: 'I have __________ (bring) my notebook every day this week.', answer: 'brought', rationale: 'Have is followed by the past participle.' },
          { prompt: 'While we walked beside the path, several leaves __________ (fall) from the trees.', answer: 'fell', rationale: 'This completed past action uses the simple past.' },
          { prompt: 'Mia has never __________ (speak) on the school radio before.', answer: 'spoken', rationale: 'Has is followed by the past participle.' },
          { prompt: 'The pond had __________ (freeze) before the first snow arrived.', answer: 'frozen', rationale: 'Had is followed by the past participle.' },
          { prompt: 'Our coach __________ (teach) us a new warm-up last Friday.', answer: 'taught', rationale: 'Last Friday signals the simple past.' }
        ]
      },
      {
        title: 'Final round · Make the meaning stick',
        directions: 'Choose one verb from Round 1. Use its simple past in one sentence and its past participle in a different sentence. Underline each verb form.',
        questions: [
          { prompt: 'My simple-past sentence:', responseLines: 2, answer: 'Answers vary. Example: “Our class chose a new book on Monday.”', rationale: 'Check that the sentence describes a completed past action and uses the simple-past form.' },
          { prompt: 'My past-participle sentence:', responseLines: 2, answer: 'Answers vary. Example: “Our class has chosen a new book.”', rationale: 'Check for an appropriate helping verb before the past participle.' },
          { prompt: 'Explain what changed between your two sentences.', responseLines: 2, answer: 'The simple-past sentence names a completed past action. The participle works with a helping verb such as has, have, or had.', rationale: 'A strong explanation refers to the verb form and the helping verb.' }
        ]
      }
    ],
    rubric: [
      { criterion: 'Verb forms', points: 3, description: '3: both forms accurate; 2: one form accurate; 1: attempts both; 0: blank.' },
      { criterion: 'Sentence context', points: 3, description: '3: both sentences are grammatical and show distinct uses; 2: one sentence needs a small correction; 1: forms are unclear; 0: no sentences.' },
      { criterion: 'Explanation', points: 2, description: '2: explains simple past versus a participle with a helper; 1: partly correct; 0: missing or incorrect.' }
    ]
  }
};