/*
 * Interactive communication-skills workbook for the Reading Room's
 * Parents & Teachers shelf:
 *   - How to Talk So Kids Will Listen & Listen So Kids Will Talk
 *     (Adele Faber & Elaine Mazlish, 30th-Anniversary Edition, Scribner)
 *
 * Mirrors all seven chapters, workshop exercises, and "A Quick Reminder"
 * skill summaries in public/library/books/how-to-talk-so-kids-will-listen.pdf
 * (358 pages), plus personal reflection prompts and a printable one-page
 * Reading & Workshop Report. Kept separate from `READER_WORKBOOKS` so the
 * Kid Program hub remains pinned to Kid 1–11.
 */

import type { ReaderWorkbookMeta } from './readerWorkbooks';

const HOW_TO_TALK_WORKBOOK: ReaderWorkbookMeta = {
  id: 'how-to-talk-so-kids-will-listen',
  gradeNumber: 11,
  gradeLabel: 'Parents & Teachers',
  seriesLabel: '30th-Anniversary Edition · Scribner (with Afterword by Joanna Faber)',
  title: 'How to Talk So Kids Will Listen & Listen So Kids Will Talk',
  author: 'Adele Faber & Elaine Mazlish',
  cover: './library/covers/how-to-talk-so-kids-will-listen.jpg',
  bookHref: '#library/how-to-talk-so-kids-will-listen',
  workbookHref: '#library/how-to-talk-so-kids-will-listen/workbook',
  drillSlug: 'reader-guide-how-to-talk-kids-listen',
  drillTitle: 'Parents & Teachers · How to Talk So Kids Will Listen — Workshop',
  tagline: 'A 100-item, seven-chapter interactive workshop practicing every Faber & Mazlish skill—accepting feelings, engaging cooperation, alternatives to punishment, five-step problem-solving, autonomy, descriptive praise, and freeing children from roles—plus reflection notes and a printable report.',
  skills: ['Empathic Listening', 'Cooperation & Problem-Solving', 'Autonomy & Descriptive Praise', 'Freeing Kids from Roles'],
  accent: 'amber',
  sections: [
    // ── Chapter 1: Helping Children Deal with Their Feelings (PDF p. 18) ─────
    {
      id: 'htt-ch1-feelings',
      shortTitle: '1 · Feelings',
      title: 'Chapter 1 · Helping Children Deal with Their Feelings',
      subtitle: 'Accepting emotions, naming feelings & wishes in fantasy (PDF pp. 18–64 · Reminder p. 44)',
      pdfPage: 18,
      activities: [
        {
          kind: 'bank-fill',
          id: 'htt-c1-reminder',
          badge: 'Quick Reminder · PDF p. 44',
          title: 'Four Ways to Accept a Child’s Feelings',
          instruction: 'Complete Chapter 1’s “A Quick Reminder” summary using the words in the Word Bank.',
          wordBank: ['quietly', 'word', 'name', 'fantasy', 'actions'],
          items: [
            {
              id: 'htt-c1-r1',
              label: 'Skill 1',
              prefix: 'Instead of half-listening or interrupting, listen ',
              suffix: ' and attentively.',
              answer: 'quietly',
            },
            {
              id: 'htt-c1-r2',
              label: 'Skill 2',
              prefix: 'Acknowledge a child’s feelings with a brief ',
              suffix: ' such as “Oh . . . Mmm . . . I see . . .”',
              answer: 'word',
            },
            {
              id: 'htt-c1-r3',
              label: 'Skill 3',
              prefix: 'Give the feeling a ',
              suffix: '—for example, “That sounds frustrating!”',
              answer: 'name',
            },
            {
              id: 'htt-c1-r4',
              label: 'Skill 4',
              prefix: 'Give the child his or her wishes in ',
              suffix: ': “I wish I could make the banana ripe for you right now!”',
              answer: 'fantasy',
            },
            {
              id: 'htt-c1-r5',
              label: 'Key Rule',
              prefix: 'All feelings can be accepted, while certain ',
              suffix: ' must be limited (“Tell him with words, not fists”).',
              answer: 'actions',
            },
          ],
        },
        {
          kind: 'category-sort',
          id: 'htt-c1-sort',
          badge: 'Workshop Practice · Ch. 1',
          title: 'Accepting Feelings vs. Dismissing Feelings',
          instruction: 'Sort each adult reply into the column that describes its effect on an upset child.',
          categories: [
            { key: 'empathic', label: 'Accepts & Respects Feelings', hint: 'Helps the child feel understood and cope' },
            { key: 'dismissive', label: 'Denies, Pities, or Gives Unwanted Advice', hint: 'Shuts the child down or sparks argument' },
          ],
          items: [
            { id: 'htt-c1-s1', text: '“That sounds frustrating!”', answer: 'empathic' },
            { id: 'htt-c1-s2', text: '“You don’t really feel that way.”', answer: 'dismissive' },
            { id: 'htt-c1-s3', text: '“Oh . . . Mmm . . . I see.”', answer: 'empathic' },
            { id: 'htt-c1-s4', text: '“Oh, you poor thing! That is terrible—I feel so sorry for you, I could just cry.”', answer: 'dismissive' },
            { id: 'htt-c1-s5', text: '“I wish I could make the banana ripe for you right now!”', answer: 'empathic' },
            { id: 'htt-c1-s6', text: '“There’s no reason to be so upset—it’s only a pencil.”', answer: 'dismissive' },
            { id: 'htt-c1-s7', text: '“I can see how angry you are at your brother. Tell him what you want with words, not fists.”', answer: 'empathic' },
            { id: 'htt-c1-s8', text: '“You know what you should do? Tomorrow march right in and tell your friend off.”', answer: 'dismissive' },
          ],
        },
        {
          kind: 'mcq',
          id: 'htt-c1-mcq',
          badge: 'Questions Parents Ask · PDF p. 45',
          title: 'Chapter 1 Comprehension & Application',
          instruction: 'Choose the best answer according to Adele Faber and Elaine Mazlish.',
          items: [
            {
              id: 'htt-c1-m1',
              prompt: 'What foundational insight from Dr. Haim Ginott opens Chapter 1?',
              options: [
                { key: 'a', text: 'Children behave best when adults quickly distract them from bad moods.' },
                { key: 'b', text: 'There is a direct connection between how kids feel and how they behave: when kids feel right, they behave right.' },
                { key: 'c', text: 'Children should explain why they are upset before adults listen to them.' },
                { key: 'd', text: 'Strict lectures early on prevent negative feelings later.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c1-m2',
              prompt: 'Why does a short “Oh . . . Mmm . . . I see” coupled with caring attention often help more than instant advice?',
              options: [
                { key: 'a', text: 'It shows the adult does not want to continue the conversation.' },
                { key: 'b', text: 'It tricks the child into forgetting the problem.' },
                { key: 'c', text: 'It gives the child room to explore their own thoughts and work out their own solution.' },
                { key: 'd', text: 'It signals silent agreement that someone else is completely at fault.' },
              ],
              answer: 'c',
            },
            {
              id: 'htt-c1-m3',
              prompt: 'Your child says casually, “Mom, I decided to go to David’s house after school today.” According to Part II, what is the most natural reply?',
              options: [
                { key: 'a', text: '“So you made a deeply meaningful decision to visit a friend this afternoon.”' },
                { key: 'b', text: 'A simple, ordinary acknowledgment like “Thanks for letting me know”—empathy is reserved for emotional moments, not casual updates.' },
                { key: 'c', text: '“Why David’s house? Did something happen with your other friends?”' },
                { key: 'd', text: '“I wish I could conjure ten houses for you to visit!”' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c1-m4',
              prompt: 'A child begs for a cereal that is completely out of stock at home. Which response uses “giving the wish in fantasy”?',
              options: [
                { key: 'a', text: '“Stop whining—oatmeal is healthier for you anyway.”' },
                { key: 'b', text: '“If you knew how hard I work, you wouldn’t complain about cereal.”' },
                { key: 'c', text: '“I wish I had the magic power to make a giant box of that cereal appear on this table right now!”' },
                { key: 'd', text: '“You don’t even like that cereal that much.”' },
              ],
              answer: 'c',
            },
          ],
        },
      ],
    },

    // ── Chapter 2: Engaging Cooperation (PDF p. 65) ──────────────────────────
    {
      id: 'htt-ch2-cooperation',
      shortTitle: '2 · Cooperation',
      title: 'Chapter 2 · Engaging Cooperation',
      subtitle: 'Five respectful ways to invite teamwork without nagging (PDF pp. 65–110 · Reminder p. 95)',
      pdfPage: 65,
      activities: [
        {
          kind: 'match-qa',
          id: 'htt-c2-towel',
          badge: 'Quick Reminder · PDF pp. 95–96',
          title: 'The Wet Towel on the Bed — Five Cooperation Skills',
          instruction: 'Match each parent response from Chapter 2’s Quick Reminder with the skill it demonstrates.',
          scene: 'A child rushes out of the bathroom and drops a sopping wet towel right on your bed.',
          options: [
            { key: 'a', text: '1. Describe what you see, or describe the problem.' },
            { key: 'b', text: '2. Give information.' },
            { key: 'c', text: '3. Say it with a word.' },
            { key: 'd', text: '4. Describe what you feel.' },
            { key: 'e', text: '5. Write a note.' },
          ],
          items: [
            { id: 'htt-c2-t1', question: '“There’s a wet towel on the bed.”', answer: 'a' },
            { id: 'htt-c2-t2', question: '“The towel is getting my blanket wet.”', answer: 'b' },
            { id: 'htt-c2-t3', question: '“The towel!”', answer: 'c' },
            { id: 'htt-c2-t4', question: '“I don’t like sleeping in a wet bed!”', answer: 'd' },
            { id: 'htt-c2-t5', question: 'Sign above the rack: “Please put me back so I can dry. Thanks! — Your Towel”', answer: 'e' },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'htt-c2-choice',
          badge: 'Workshop Exercises · Ch. 2',
          title: 'Trade Blame & Threats for Cooperation',
          instruction: 'Pick the phrase that engages cooperation without attacking the child.',
          items: [
            {
              id: 'htt-c2-b1',
              prefix: 'Milk spills across the kitchen floor → ',
              options: ['“The milk spilled. We need a sponge.”', '“You’re always so clumsy! Look what you did!”'],
              answer: '“The milk spilled. We need a sponge.”',
              suffix: '',
              hint: 'Describe the problem so the child focuses on the solution, not guilt.',
            },
            {
              id: 'htt-c2-b2',
              prefix: 'A child is heading out the door without lunch → ',
              options: ['“Kids, your lunches!”', '“You’d forget your head if it weren’t attached—come back and get your lunch!”'],
              answer: '“Kids, your lunches!”',
              suffix: '',
              hint: 'Say it with a short word or phrase so children can take the initiative themselves.',
            },
            {
              id: 'htt-c2-b3',
              prefix: 'An open milk carton sits on the counter → ',
              options: ['“Milk turns sour when it isn’t refrigerated.”', '“Who left the milk out again? How many times do I have to tell you?”'],
              answer: '“Milk turns sour when it isn’t refrigerated.”',
              suffix: '',
              hint: 'Information is much easier to accept than an accusation.',
            },
            {
              id: 'htt-c2-b4',
              prefix: 'A child keeps tugging your sleeve while you talk → ',
              options: ['“It frustrates me to start something and be interrupted three times.”', '“What is wrong with you? You are so rude and inconsiderate!”'],
              answer: '“It frustrates me to start something and be interrupted three times.”',
              suffix: '',
              hint: 'Describe your own feelings without attacking the child’s character.',
            },
            {
              id: 'htt-c2-b5',
              prefix: 'Homework must be finished before evening TV → ',
              options: ['Tape a note on the screen: “Before turning me on, think: Homework done? Piano practiced?”', '“Don’t you dare touch that TV or you’re grounded for a month!”'],
              answer: 'Tape a note on the screen: “Before turning me on, think: Homework done? Piano practiced?”',
              suffix: '',
              hint: 'A brief, friendly note reminds without raising anyone’s voice.',
            },
            {
              id: 'htt-c2-b6',
              prefix: 'Apple cores are left on the sofa table → ',
              options: ['“Apple cores belong in the garbage.”', '“You live like an animal! Clean this filthy mess this instant!”'],
              answer: '“Apple cores belong in the garbage.”',
              suffix: '',
              hint: 'Simple information invites the child to figure out what needs to be done.',
            },
          ],
        },
        {
          kind: 'true-false',
          id: 'htt-c2-tf',
          badge: 'Part II Check · PDF p. 97',
          title: 'True or False — Tone, Attitude & Cooperation',
          instruction: 'Decide whether each statement matches Chapter 2.',
          items: [
            {
              id: 'htt-c2-tf1',
              statement: 'The attitude children thrive on communicates: “You’re basically a lovable, capable person, and right now there’s a problem that needs attention.”',
              answer: 'T',
            },
            {
              id: 'htt-c2-tf2',
              statement: 'Comparing a child unfavorably to a sibling (“Why can’t you hang up your coat like your sister?”) reliably motivates cheerful teamwork.',
              answer: 'F',
            },
            {
              id: 'htt-c2-tf3',
              statement: 'When describing a problem, leaving the word “you” out makes it easier for a child to focus on what needs to be done instead of defending themselves.',
              answer: 'T',
            },
            {
              id: 'htt-c2-tf4',
              statement: 'Written notes only work for teenagers—even a simple picture note cannot help a non-reading young child.',
              answer: 'F',
            },
          ],
        },
      ],
    },

    // ── Chapter 3: Alternatives to Punishment (PDF p. 111) ───────────────────
    {
      id: 'htt-ch3-punishment',
      shortTitle: '3 · No Punishment',
      title: 'Chapter 3 · Alternatives to Punishment & Problem-Solving',
      subtitle: 'Guidance, restitution, choices & the five-step problem-solving method (PDF pp. 111–162 · Reminder p. 135)',
      pdfPage: 111,
      activities: [
        {
          kind: 'multi-blank',
          id: 'htt-c3-saw',
          badge: 'Quick Reminder · PDF pp. 135–136',
          title: 'Instead of Punishment — The Rusty Saw',
          instruction: 'Use the Word Bank to complete the six alternatives to punishment from Chapter 3’s Quick Reminder.',
          wordBank: ['character', 'returned', 'amends', 'choice', 'locked', 'work'],
          sentences: [
            {
              id: 'htt-c3-saw-p1',
              scene: 'A child borrows a parent’s new saw and leaves it outside to rust in the rain.',
              parts: [
                '1. Express your feelings strongly without attacking ',
                { id: 'htt-c3-sw1', answer: 'character' },
                ': “I’m furious that my new saw was left outside to rust in the rain!” 2. State your expectations: “I expect my tools to be ',
                { id: 'htt-c3-sw2', answer: 'returned' },
                ' after they’ve been borrowed.” 3. Show the child how to make ',
                { id: 'htt-c3-sw3', answer: 'amends' },
                ': “What this saw needs now is a little steel wool and a lot of elbow grease.”',
              ],
            },
            {
              id: 'htt-c3-saw-p2',
              scene: 'If the problem continues, follow through calmly with choices, action, and collaborative problem-solving.',
              parts: [
                '4. Offer a ',
                { id: 'htt-c3-sw4', answer: 'choice' },
                ': “You can borrow my tools and return them or give up the privilege of using them. You decide.” 5. Take action—when the child asks why the toolbox is ',
                { id: 'htt-c3-sw5', answer: 'locked' },
                ', reply calmly, “You tell me why.” 6. Problem-solve: “What can we ',
                { id: 'htt-c3-sw6', answer: 'work' },
                ' out so you can use my tools when you need them, and I’ll be sure they’re there when I need them?”',
              ],
            },
          ],
        },
        {
          kind: 'sequence',
          id: 'htt-c3-seq',
          badge: 'Problem-Solving · PDF pp. 125–130',
          title: 'Order the Five Steps of Problem-Solving',
          instruction: 'Number the five steps of Faber & Mazlish’s problem-solving method from 1 (first) to 5 (last).',
          count: 5,
          items: [
            { id: 'htt-c3-q1', badge: 'a', text: 'Write down all ideas—without evaluating.', answer: 4 },
            { id: 'htt-c3-q2', badge: 'b', text: 'Talk about the child’s feelings and needs.', answer: 1 },
            { id: 'htt-c3-q3', badge: 'c', text: 'Decide which suggestions you like, which you don’t like, and which you plan to follow through on.', answer: 5 },
            { id: 'htt-c3-q4', badge: 'd', text: 'Brainstorm together to find a mutually agreeable solution.', answer: 3 },
            { id: 'htt-c3-q5', badge: 'e', text: 'Talk about your own feelings and needs.', answer: 2 },
          ],
        },
        {
          kind: 'mcq',
          id: 'htt-c3-mcq',
          badge: 'Chapter 3 Insights · PDF pp. 114–138',
          title: 'Why Discipline Works Better Than Punishment',
          instruction: 'Select the best answer for each question from Chapter 3.',
          items: [
            {
              id: 'htt-c3-m1',
              prompt: 'When parents in the workshop recalled being punished as children, what did punishment distract them from?',
              options: [
                { key: 'a', text: 'Facing and regretting their own behavior—instead filling them with resentment, defiance, revenge fantasies, or crushing guilt.' },
                { key: 'b', text: 'Remembering the rules of board games.' },
                { key: 'c', text: 'Asking for extra chores around the house.' },
                { key: 'd', text: 'Reading books before bedtime.' },
              ],
              answer: 'a',
            },
            {
              id: 'htt-c3-m2',
              prompt: 'A toddler who isn’t talking yet reaches for a breakable china dog. What do the authors recommend instead of slapping the child’s hand?',
              options: [
                { key: 'a', text: 'Wait until the dog breaks so the toddler learns a painful lesson.' },
                { key: 'b', text: 'Remove the child or object while giving clear, dignified information: “This china dog can break. Your stuffed dog won’t break.”' },
                { key: 'c', text: 'Give a twenty-minute lecture on family heirlooms.' },
                { key: 'd', text: 'Ignore it completely and hope the china survives.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c3-m3',
              prompt: 'During Step 4 of problem-solving (like Bobby’s late-for-dinner role-play), what should you do when a child suggests a wild or impractical idea?',
              options: [
                { key: 'a', text: 'Immediately explain why that idea is ridiculous and refuse to write it down.' },
                { key: 'b', text: 'End the meeting and assign a punishment instead.' },
                { key: 'c', text: 'Write it down without judging—evaluating comes only in Step 5 after every idea is on the list.' },
                { key: 'd', text: 'Agree to follow every single item on the list forever.' },
              ],
              answer: 'c',
            },
            {
              id: 'htt-c3-m4',
              prompt: 'Your energetic preschooler starts dashing down supermarket aisles grabbing items. Which skill turns that energy around right away?',
              options: [
                { key: 'a', text: 'Point out a way to be helpful—for example, “It would be a help to me if you picked out three big lemons for our cart.”' },
                { key: 'b', text: 'Call the child a “terror” in front of other shoppers.' },
                { key: 'c', text: 'Promise three candy bars for standing motionless.' },
                { key: 'd', text: 'Threaten to leave the child at the store.' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },

    // ── Chapter 4: Encouraging Autonomy (PDF p. 163) ─────────────────────────
    {
      id: 'htt-ch4-autonomy',
      shortTitle: '4 · Autonomy',
      title: 'Chapter 4 · Encouraging Autonomy',
      subtitle: 'Helping children grow into capable, self-reliant thinkers (PDF pp. 163–198 · Reminder p. 179)',
      pdfPage: 163,
      activities: [
        {
          kind: 'match-qa',
          id: 'htt-c4-match',
          badge: 'Quick Reminder · PDF pp. 179–180',
          title: 'Match Each Response to Its Autonomy Skill',
          instruction: 'Match each verbatim example from Chapter 4’s Quick Reminder to the skill it illustrates.',
          scene: 'Small everyday habits let children practice making decisions, wrestling with problems, and trusting their own competence.',
          options: [
            { key: 'a', text: '1. Let children make choices.' },
            { key: 'b', text: '2. Show respect for a child’s struggle.' },
            { key: 'c', text: '3. Don’t ask too many questions.' },
            { key: 'd', text: '4. Don’t rush to answer questions.' },
            { key: 'e', text: '5. Encourage children to use sources outside the home.' },
            { key: 'f', text: '6. Don’t take away hope.' },
          ],
          items: [
            { id: 'htt-c4-m1', question: '“Are you in the mood for your gray pants, or your red pants?”', answer: 'a' },
            { id: 'htt-c4-m2', question: '“A jar can be hard to open. Sometimes it helps if you tap the lid with a spoon.”', answer: 'b' },
            { id: 'htt-c4-m3', question: '“Glad to see you. Welcome home.”', answer: 'c' },
            { id: 'htt-c4-m4', question: '“That’s an interesting question. What do you think?”', answer: 'd' },
            { id: 'htt-c4-m5', question: '“Maybe the pet shop owner would have a suggestion.”', answer: 'e' },
            { id: 'htt-c4-m6', question: '“So you’re thinking of trying out for the play! That should be an experience.”', answer: 'f' },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'htt-c4-choice',
          badge: 'Everyday Practice · PDF pp. 179–182',
          title: 'Fostering Self-Reliance in Daily Moments',
          instruction: 'Choose the response that respects the child’s growing autonomy.',
          items: [
            {
              id: 'htt-c4-b1',
              prefix: 'Medicine time → ',
              options: [
                '“I see how much you dislike this medicine. Would it be easier to take it with apple juice or ginger ale?”',
                '“Stop making faces and swallow it right now because I said so!”',
              ],
              answer: '“I see how much you dislike this medicine. Would it be easier to take it with apple juice or ginger ale?”',
              suffix: '',
              hint: 'Even a small choice about how something is done reduces resentment.',
            },
            {
              id: 'htt-c4-b2',
              prefix: 'Crossing a busy street with three-year-old Tony → ',
              options: [
                '“You can hold Mommy’s hand or my hand—or maybe you have another idea that’s safe.”',
                '“You’re impossible! Why do you always pull away in the street?”',
              ],
              answer: '“You can hold Mommy’s hand or my hand—or maybe you have another idea that’s safe.”',
              suffix: '',
              hint: 'Inviting an acceptable safe option keeps safety firm while honoring autonomy.',
            },
            {
              id: 'htt-c4-b3',
              prefix: 'A child struggles with a tangled shoelace → ',
              options: [
                '“Untangling a knot can be tricky.”',
                '“Here, move your hands—let me do it, that’s too easy to struggle over!”',
              ],
              answer: '“Untangling a knot can be tricky.”',
              suffix: '',
              hint: 'Calling a task “easy” discourages a child if they fail and cheapens success if they manage it.',
            },
            {
              id: 'htt-c4-b4',
              prefix: 'A child asks, “Why do people have to grow old?” → ',
              options: [
                '“You’re wondering about growing old. What are your thoughts about it?”',
                'Launch immediately into a ten-minute biology lecture before the child can speak.',
              ],
              answer: '“You’re wondering about growing old. What are your thoughts about it?”',
              suffix: '',
              hint: 'Giving kids the first crack at their own questions exercises their mental muscles.',
            },
            {
              id: 'htt-c4-b5',
              prefix: 'A child dreams of building a wooden birdhouse or becoming a vet → ',
              options: [
                '“So that’s something you’d like to try! Tell me what you have in mind.”',
                '“Be realistic—you haven’t got the grades or the patience for that.”',
              ],
              answer: '“So that’s something you’d like to try! Tell me what you have in mind.”',
              suffix: '',
              hint: 'Much of the joy of childhood lies in dreaming, planning, and hoping—don’t crush hope.',
            },
          ],
        },
        {
          kind: 'true-false',
          id: 'htt-c4-tf',
          badge: 'Autonomy Check · Ch. 4',
          title: 'True or False — Letting Go Gracefully',
          instruction: 'Mark each statement True (T) or False (F).',
          items: [
            {
              id: 'htt-c4-tf1',
              statement: 'Children who are constantly told what to wear, eat, and think often feel helpless or resentful toward the adult taking over their decisions.',
              answer: 'T',
            },
            {
              id: 'htt-c4-tf2',
              statement: 'Saying “You’re a big boy now—you’re old enough to make your own bed!” is the warmest, most effective way to shift a new responsibility.',
              answer: 'F',
            },
            {
              id: 'htt-c4-tf3',
              statement: 'Greeting a child after school with a barrage of rapid-fire questions often makes them clam up; kids talk when they want to talk.',
              answer: 'T',
            },
            {
              id: 'htt-c4-tf4',
              statement: 'Pointing children toward a librarian, dentist, coach, or shopkeeper shows them the wider world holds helpful resources they can consult too.',
              answer: 'T',
            },
          ],
        },
      ],
    },

    // ── Chapter 5: Praise (PDF p. 199) ───────────────────────────────────────
    {
      id: 'htt-ch5-praise',
      shortTitle: '5 · Praise',
      title: 'Chapter 5 · Praise and Self-Esteem',
      subtitle: 'Describing instead of evaluating so children praise themselves (PDF pp. 199–227 · Reminder p. 214)',
      pdfPage: 199,
      activities: [
        {
          kind: 'category-sort',
          id: 'htt-c5-sort',
          badge: 'Quick Reminder · PDF p. 214',
          title: 'Descriptive Praise vs. Evaluative Praise',
          instruction: 'Sort each compliment into Descriptive Praise (names what you see, feel, or the quality shown) or Evaluative Praise (sweeping judgment label).',
          categories: [
            { key: 'descriptive', label: 'Descriptive Praise', hint: 'Specific observation the child can believe and internalize' },
            { key: 'evaluative', label: 'Evaluative Praise', hint: 'Broad label like “best”, “angel”, or “brilliant” that sparks doubt or pressure' },
          ],
          items: [
            { id: 'htt-c5-s1', text: '“I see a clean floor, a smooth bed, and books neatly lined up on the shelf.”', answer: 'descriptive' },
            { id: 'htt-c5-s2', text: '“You’re an angel—the neatest kid on earth!”', answer: 'evaluative' },
            { id: 'htt-c5-s3', text: '“It’s a pleasure to walk into this room!”', answer: 'descriptive' },
            { id: 'htt-c5-s4', text: '“You have a brilliant mind.”', answer: 'evaluative' },
            { id: 'htt-c5-s5', text: '“You sorted your Legos, cars, and farm animals into separate boxes. That’s what I call organization!”', answer: 'descriptive' },
            { id: 'htt-c5-s6', text: '“You’re always so beautifully dressed.”', answer: 'evaluative' },
            { id: 'htt-c5-s7', text: '“Look at the bright yellow sun and bold brushstrokes in this painting—it cheers up the whole kitchen!”', answer: 'descriptive' },
            { id: 'htt-c5-s8', text: '“You’re the greatest artist in the whole school!”', answer: 'evaluative' },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'htt-c5-word',
          badge: 'Skill 3 · Sum It Up in a Word',
          title: 'Sum Up the Praiseworthy Behavior with a Word',
          instruction: 'Pick the single word from the Word Bank that gives each child a lasting, truthful picture of their own strength.',
          wordBank: ['organization', 'perseverance', 'self-control', 'willpower', 'thoughtfulness'],
          items: [
            {
              id: 'htt-c5-w1',
              label: '1.',
              prefix: '“You sorted your Legos, cars, and farm animals and put them in separate boxes. That’s what I call ',
              suffix: '!”',
              answer: 'organization',
            },
            {
              id: 'htt-c5-w2',
              label: '2.',
              prefix: '“Even though that math problem was tough, you kept trying different approaches until you solved it. That’s what I call ',
              suffix: '!”',
              answer: 'perseverance',
            },
            {
              id: 'htt-c5-w3',
              label: '3.',
              prefix: '“I noticed you were really angry, and yet you kept your hands to yourself and used words. That took real ',
              suffix: '.”',
              answer: 'self-control',
            },
            {
              id: 'htt-c5-w4',
              label: '4.',
              prefix: '“You said you were going to save half your allowance instead of spending it all today, and you stuck to it. That’s ',
              suffix: '!”',
              answer: 'willpower',
            },
            {
              id: 'htt-c5-w5',
              label: '5.',
              prefix: '“You called home as soon as you knew you’d be ten minutes late so I wouldn’t worry. I call that ',
              suffix: '.”',
              answer: 'thoughtfulness',
            },
          ],
        },
        {
          kind: 'mcq',
          id: 'htt-c5-mcq',
          badge: 'Cautions About Praise · Ch. 5',
          title: 'Making Praise Authentic & Safe',
          instruction: 'Choose the best answer based on Chapter 5.',
          items: [
            {
              id: 'htt-c5-m1',
              prompt: 'Why can sweeping evaluative praise (“You’re always so good!”) make a child anxious or misbehave right afterward?',
              options: [
                { key: 'a', text: 'Children dislike hearing their parents’ voices.' },
                { key: 'b', text: 'It creates fear of not living up to the label, focuses on flaws the adult hasn’t seen, or feels impossible to trust.' },
                { key: 'c', text: 'Children cannot understand adjectives until high school.' },
                { key: 'd', text: 'Praise should never be offered at home.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c5-m2',
              prompt: 'Which praise avoids hinting at a child’s past weakness or failure?',
              options: [
                { key: 'a', text: '“Well, you finally practiced piano without me nagging you!”' },
                { key: 'b', text: '“I never thought you’d pass that spelling test, but you did!”' },
                { key: 'c', text: '“I enjoyed hearing you play the whole second page so smoothly today.”' },
                { key: 'd', text: '“Your room looks clean—why couldn’t you do that last week?”' },
              ],
              answer: 'c',
            },
            {
              id: 'htt-c5-m3',
              prompt: 'When an adult describes accurately and appreciatively what a child accomplished, what happens inside the child?',
              options: [
                { key: 'a', text: 'The child praises himself or herself—building realistic, independent self-esteem.' },
                { key: 'b', text: 'The child becomes completely dependent on external stickers.' },
                { key: 'c', text: 'The child stops trying on future tasks.' },
                { key: 'd', text: 'The child argues that the room isn’t actually clean.' },
              ],
              answer: 'a',
            },
          ],
        },
      ],
    },

    // ── Chapter 6: Freeing Children from Playing Roles (PDF p. 228) ──────────
    {
      id: 'htt-ch6-roles',
      shortTitle: '6 · Freeing Roles',
      title: 'Chapter 6 · Freeing Children from Playing Roles',
      subtitle: 'Helping kids step out of labels like “stubborn”, “clumsy”, or “bossy” (PDF pp. 228–253 · Reminder p. 245)',
      pdfPage: 228,
      activities: [
        {
          kind: 'match-qa',
          id: 'htt-c6-match',
          badge: 'Quick Reminder · PDF pp. 245–246',
          title: 'Six Skills for Freeing Children from Roles',
          instruction: 'Match each parent statement from Chapter 6’s Quick Reminder to the role-freeing skill it shows.',
          scene: 'When a child gets stuck in a negative role, adults can deliberately reflect back a larger, truer picture of who that child can be.',
          options: [
            { key: 'a', text: '1. Look for opportunities to show the child a new picture of himself/herself.' },
            { key: 'b', text: '2. Put children in situations where they can see themselves differently.' },
            { key: 'c', text: '3. Let children overhear you say something positive about them.' },
            { key: 'd', text: '4. Model the behavior you’d like to see.' },
            { key: 'e', text: '5. Be a storehouse for your child’s special moments.' },
            { key: 'f', text: '6. When your child acts according to the old label, state your feelings and/or expectations.' },
          ],
          items: [
            { id: 'htt-c6-m1', question: '“You’ve had that toy since you were three and it almost looks like new!”', answer: 'a' },
            { id: 'htt-c6-m2', question: '“Sara, would you take the screwdriver and tighten the pulls on these drawers?”', answer: 'b' },
            { id: 'htt-c6-m3', question: 'To the doctor or spouse: “He held his arm steady even though the shot hurt.”', answer: 'c' },
            { id: 'htt-c6-m4', question: '“It’s hard to lose, but I’ll try to be a sport about it. Congratulations!”', answer: 'd' },
            { id: 'htt-c6-m5', question: '“I remember the time you patiently helped your little cousin tie his shoes . . .”', answer: 'e' },
            { id: 'htt-c6-m6', question: '“I don’t like that. Despite your strong feelings, I expect sportsmanship from you.”', answer: 'f' },
          ],
        },
        {
          kind: 'binary-choice',
          id: 'htt-c6-choice',
          badge: 'Retiring Old Labels · Ch. 6',
          title: 'Show the Child a New Picture',
          instruction: 'Select the response that frees the child from a limiting label rather than cementing it.',
          items: [
            {
              id: 'htt-c6-b1',
              prefix: 'A child once seen as “destructive” builds a careful block tower → ',
              options: [
                '“Look how gently you balanced that top block so the whole tower stayed standing.”',
                '“Watch out, Mr. Wrecking Ball—you’ll knock it down in five seconds!”',
              ],
              answer: '“Look how gently you balanced that top block so the whole tower stayed standing.”',
              suffix: '',
              hint: 'Spotlight genuine moments that contradict the old label.',
            },
            {
              id: 'htt-c6-b2',
              prefix: 'A child labeled “irresponsible” wants to help with dinner → ',
              options: [
                '“Would you be in charge of slicing the mushrooms and setting out the napkins tonight?”',
                '“Stay out of the kitchen—you always drop everything.”',
              ],
              answer: '“Would you be in charge of slicing the mushrooms and setting out the napkins tonight?”',
              suffix: '',
              hint: 'Put children in real situations where they can experience themselves as capable.',
            },
            {
              id: 'htt-c6-b3',
              prefix: 'A child called “stingy” shares half a cookie → ',
              options: [
                'Mention casually to your partner within earshot: “Maya split her last cookie right down the middle with Sam.”',
                '“Miracle of miracles! Did everyone see the stingiest kid in the family finally share?”',
              ],
              answer: 'Mention casually to your partner within earshot: “Maya split her last cookie right down the middle with Sam.”',
              suffix: '',
              hint: 'Overheard sincere appreciation sinks in deeply without sarcasm.',
            },
            {
              id: 'htt-c6-b4',
              prefix: 'A child labeled “stubborn” refuses to change plans → ',
              options: [
                'Notice the strength underneath—determination—and remember times they chose to be flexible.',
                'Announce, “Once a mule, always a mule—nobody can talk to you.”',
              ],
              answer: 'Notice the strength underneath—determination—and remember times they chose to be flexible.',
              suffix: '',
              hint: 'Reframing “stubborn” as “determined” and noticing flexibility changes how both of you relate.',
            },
            {
              id: 'htt-c6-b5',
              prefix: 'A child dubbed “forgetful” misplaces a library book again → ',
              options: [
                '“The library book is due tomorrow. Where would be a good spot by the door so it gets into your backpack?”',
                '“There goes our Absent-Minded Professor again!”',
              ],
              answer: '“The library book is due tomorrow. Where would be a good spot by the door so it gets into your backpack?”',
              suffix: '',
              hint: 'Even playful nicknames can lock a child into repeating the habit.',
            },
          ],
        },
        {
          kind: 'true-false',
          id: 'htt-c6-tf',
          badge: 'Parents’ Stories · PDF pp. 245–248',
          title: 'True or False — Breaking Self-Fulfilling Prophecies',
          instruction: 'Decide whether each statement matches Chapter 6.',
          items: [
            {
              id: 'htt-c6-tf1',
              statement: 'Even when an adult never says a negative label aloud, thinking of a child as a “problem child” still leaks through in tone, body language, and expectations.',
              answer: 'T',
            },
            {
              id: 'htt-c6-tf2',
              statement: 'Casting one child as “The Good One” or “The Little Princess” is completely harmless and never limits that child.',
              answer: 'F',
            },
            {
              id: 'htt-c6-tf3',
              statement: 'When David’s mother slipped years later and called her grown son “pigheaded,” he replied gently, “That’s okay, Mom. Thanks to you, I have another opinion of myself.”',
              answer: 'T',
            },
          ],
        },
      ],
    },

    // ── Chapter 7: Putting It All Together & Reflection Report (PDF p. 254) ──
    {
      id: 'htt-ch7-together',
      shortTitle: '7 · All Together',
      title: 'Chapter 7 · Putting It All Together, Afterwords & Report',
      subtitle: '“The Princess”, “What’s It All About, Anyway?” & Joanna Faber’s Next Generation (PDF pp. 254–340)',
      pdfPage: 254,
      activities: [
        {
          kind: 'mcq',
          id: 'htt-c7-mcq',
          badge: 'Chapter 7 & Afterwords · PDF pp. 254–299',
          title: 'Putting Every Skill Together in Real Life',
          instruction: 'Choose the best answer based on Chapter 7 and the 30th-Anniversary Afterword.',
          items: [
            {
              id: 'htt-c7-m1',
              prompt: 'In “The Princess—Part I” (PDF pp. 254–256), what happens when Susie’s mother calls her “spoiled,” slaps her arm in frustration, and then feels guilty?',
              options: [
                { key: 'a', text: 'Susie calmly apologizes and puts away her crayons.' },
                { key: 'b', text: 'Mother caves in out of guilt and lets Betsy sleep over after all—accidentally reinforcing the “Princess” role.' },
                { key: 'c', text: 'Susie decides blue is her new favorite color.' },
                { key: 'd', text: 'They use the five-step problem-solving sheet together.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c7-m2',
              prompt: 'In “The Princess—Part II” (PDF pp. 257–258), how does Mother respond when Susie throws her coloring book on the floor because Betsy can’t sleep over tonight?',
              options: [
                { key: 'a', text: 'She cancels her own dinner party immediately.' },
                { key: 'b', text: 'She sets a firm limit (“Books are not for throwing!”), invites Susie to express her anger in words, and empathizes with Susie’s disappointment while holding her own boundary.' },
                { key: 'c', text: 'She throws Susie’s crayons in the trash.' },
                { key: 'd', text: 'She tells Susie that sleepovers are silly anyway.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c7-m3',
              prompt: 'What reassuring reminder do Faber and Mazlish give adults at the end of Chapter 7 (PDF p. 259)?',
              options: [
                { key: 'a', text: 'You must never make another mistake or the skills will stop working forever.' },
                { key: 'b', text: 'Don’t cast yourself into roles either (“good parent, bad parent”)—life isn’t a memorized script, and these principles always give you a clear direction to return to.' },
                { key: 'c', text: 'Memorize word-for-word scripts and recite them in a monotone voice.' },
                { key: 'd', text: 'Always put a child’s wishes ahead of every adult need.' },
              ],
              answer: 'b',
            },
            {
              id: 'htt-c7-m4',
              prompt: 'In the 30th-Anniversary section “The Next Generation” (PDF p. 298), what helped Adele Faber’s daughter Joanna feel confident sharing these tools with other parents and teachers?',
              options: [
                { key: 'a', text: 'Realizing there is no calm, conflict-free life with young kids—what matters is having practical skills to get through conflicts with good feelings and relationships intact.' },
                { key: 'b', text: 'Waiting until her own children never argued about a single toy.' },
                { key: 'c', text: 'Keeping her last name secret for the rest of her teaching career.' },
                { key: 'd', text: 'Replacing empathy with strict reward charts.' },
              ],
              answer: 'a',
            },
          ],
        },
        {
          kind: 'bank-fill',
          id: 'htt-c7-creed',
          badge: 'What’s It All About, Anyway? · PDF p. 260',
          title: 'The Heart of Faber & Mazlish’s Approach',
          instruction: 'Complete the four closing principles from “What’s It All About, Anyway?” using the Word Bank.',
          wordBank: ['blame', 'feelings', 'damage', 'needs'],
          items: [
            {
              id: 'htt-c7-c1',
              label: '1.',
              prefix: 'We want to find a way to live without ',
              suffix: ' and recrimination.',
              answer: 'blame',
            },
            {
              id: 'htt-c7-c2',
              label: '2.',
              prefix: 'We want to find a way to be more sensitive to one another’s ',
              suffix: '.',
              answer: 'feelings',
            },
            {
              id: 'htt-c7-c3',
              label: '3.',
              prefix: 'We want to find a way to express our irritation or anger without doing ',
              suffix: '.',
              answer: 'damage',
            },
            {
              id: 'htt-c7-c4',
              label: '4.',
              prefix: 'We want to be respectful of our children’s ',
              suffix: ' and just as respectful of our own.',
              answer: 'needs',
            },
          ],
        },
        {
          kind: 'open-prompts',
          id: 'htt-c7-journal',
          badge: 'Personal Workshop Notes (Autosaved)',
          title: 'Put One Skill into Action This Week',
          instruction: 'Jot down real moments from your home or classroom. These personal notes save on your device and are not auto-graded.',
          prompts: [
            {
              id: 'htt-c7-p1',
              label: '1. Accepting Feelings — Write down a real child or student complaint and the empathic response you want to try:',
              placeholder: 'Child/student says: “…” → My response naming the feeling or giving the wish in fantasy: “…”',
            },
            {
              id: 'htt-c7-p2',
              label: '2. Cooperation or Descriptive Praise — Rewrite one everyday command or “Good job!” into a specific description:',
              placeholder: 'Instead of “…” → I will describe what I see/feel: “…”',
            },
            {
              id: 'htt-c7-p3',
              label: '3. Freeing from a Role — Name one limiting label you want to retire and a new picture you can show instead:',
              placeholder: 'Old label to let go of: … → Moment or strength I can spotlight: …',
            },
          ],
        },
        {
          kind: 'book-report',
          id: 'htt-c7-report',
          badge: 'Reading & Workshop Summary',
          title: 'Complete & Print Your Book Reflection',
          instruction: 'Choose the chapter or skill that stood out most, summarize your biggest takeaway, and print a clean one-page summary.',
          defaultTitle: 'How to Talk So Kids Will Listen & Listen So Kids Will Talk',
          defaultAuthor: 'Adele Faber & Elaine Mazlish',
          characterChoices: [
            'Ch. 1 · Accepting Feelings',
            'Ch. 2 · Engaging Cooperation',
            'Ch. 3 · Alternatives to Punishment',
            'Ch. 4 · Encouraging Autonomy',
            'Ch. 5 · Descriptive Praise',
            'Ch. 6 · Freeing Kids from Roles',
            'Ch. 7 · Putting It All Together',
            'Joanna Faber · The Next Generation',
          ],
        },
      ],
    },
  ],
};

export const GUIDE_READER_WORKBOOKS: readonly ReaderWorkbookMeta[] = [
  HOW_TO_TALK_WORKBOOK,
];
