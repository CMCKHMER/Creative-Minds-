import type { ClassroomAssignment, AssignmentQuestion } from '../types/assignment';

export type JuniorAssessmentSkill = 'Speaking' | 'Listening' | 'Writing';

export interface JuniorAssessment {
  id: string;
  skill: JuniorAssessmentSkill;
  title: string;
  summary: string;
  assignment: ClassroomAssignment;
}

function response(prompt: string, answer: string, rationale: string, responseLines = 3): AssignmentQuestion {
  return { prompt, answer, rationale, responseLines };
}

function selection(prompt: string, choices: string[], answer: string, rationale: string): AssignmentQuestion {
  return { prompt, choices, answer, rationale };
}

function rubric(criteria: Array<[string, number, string]>) {
  return criteria.map(([criterion, points, description]) => ({ criterion, points, description }));
}

const spokenRubric = rubric([
  ['Task response', 4, '4: addresses every part; 2-3: addresses the main task but misses a detail; 0-1: response is mostly unrelated or incomplete.'],
  ['Organization', 4, '4: clear opening, connected points, and close; 2-3: generally clear with one abrupt transition; 0-1: difficult to follow.'],
  ['Support and detail', 4, '4: uses specific, relevant details and explains them; 2-3: includes a general example; 0-1: little support.'],
  ['Intelligibility', 4, '4: listener can follow the message throughout; 2-3: occasional repetition is needed; 0-1: frequent breakdowns obscure meaning.']
]);

const writingRubric = rubric([
  ['Task completion', 4, '4: addresses every part of the prompt; 2-3: completes the main task but misses a detail; 0-1: incomplete or off-topic.'],
  ['Organization', 4, '4: ideas follow a clear order with useful transitions; 2-3: mostly ordered with some jumps; 0-1: difficult to follow.'],
  ['Development', 4, '4: uses specific supporting details and explains them; 2-3: support is general or partly explained; 0-1: little support.'],
  ['Language control', 4, '4: varied, mostly accurate language; 2-3: errors occur but meaning is clear; 0-1: frequent errors obscure meaning.']
]);

function makeAssessment(input: {
  id: string;
  skill: JuniorAssessmentSkill;
  title: string;
  subtitle: string;
  summary: string;
  gradeBand?: string;
  duration: string;
  objectives: string[];
  teacherNotes: string[];
  sections: ClassroomAssignment['sections'];
  rubric: ClassroomAssignment['rubric'];
}): JuniorAssessment {
  return {
    id: input.id,
    skill: input.skill,
    title: input.title,
    summary: input.summary,
    assignment: {
      resourceId: input.id,
      title: input.title,
      subtitle: input.subtitle,
      subject: `TOEFL Junior-style ${input.skill.toLowerCase()} practice`,
      gradeBand: input.gradeBand ?? 'Suggested grades 7-9 · Intermediate English practice',
      duration: input.duration,
      skillFocus: input.objectives,
      objectives: input.objectives,
      materials: input.skill === 'Listening' ? ['Teacher read-aloud script', 'Pencil'] : ['Pencil', 'Timer (optional)'],
      teacherNotes: input.teacherNotes,
      sections: input.sections,
      rubric: input.rubric,
    },
  };
}

const SPEAKING_ASSESSMENTS: JuniorAssessment[] = [
  makeAssessment({
    id: 'tj-speaking-01', skill: 'Speaking', title: 'Choose a Club, Make Your Case',
    subtitle: 'Independent speaking: state a choice and support it with a specific example',
    summary: 'Compare two after-school clubs and deliver a clear, supported recommendation in 45 seconds.', duration: '20 minutes',
    objectives: ['State a clear preference', 'Support a reason with a concrete example', 'Use an organized opening and close'],
    teacherNotes: ['Give students 20 seconds to plan and 45 seconds to speak.', 'Accept either club choice when the speaker gives relevant support.', 'This is an original timed practice task, not an official test item.'],
    sections: [{
      title: 'Task · Pick the best fit',
      directions: 'Your school can fund only one new club this term. Use the descriptions to choose, plan, then speak for 45 seconds. Include one reason and a specific example.',
      passage: ['Science Makers meets on Tuesday. Members build and test small designs using shared classroom materials. The club welcomes beginners and experienced students. Members keep a notebook of what worked and what they would change.', 'Community Garden meets on Thursday. Members plan planting areas, maintain a garden log, and share produce with a neighborhood pantry. No gardening experience is required.'],
      questions: [
        response('Choose Science Makers or Community Garden. Which club should the school fund, and what is one benefit it would bring to students?', 'Answers vary. A strong response names one club, explains a relevant benefit, and refers to a detail such as testing designs or sharing produce.', 'Look for a clear position plus a specific detail from one description.', 4),
        response('Give a concrete example that shows how a student could benefit from your chosen club.', 'Answers vary. Example: a student who enjoys solving problems could test a bridge design, study why it bends, and revise it in Science Makers.', 'The example should illustrate the reason rather than repeat it.', 3),
        response('Partner listener: State the speaker\'s recommendation and one supporting detail you heard.', 'Answers vary. The listener should accurately restate the chosen club and one detail the speaker used.', 'Use this check to see whether the main point and support were understandable.', 2)
      ]
    }], rubric: spokenRubric
  }),
  makeAssessment({
    id: 'tj-speaking-02', skill: 'Speaking', title: 'Help a Classmate Find a Study Space',
    subtitle: 'Integrated speaking: identify a problem and compare two workable solutions',
    summary: 'Listen to a short student conversation, explain the problem, and recommend a solution.', duration: '20 minutes',
    objectives: ['Identify a speaker\'s practical problem', 'Compare two possible solutions', 'Explain a recommendation with a reason'],
    teacherNotes: ['Read the dialogue twice at a natural pace. Students may take notes during the second read.', 'Give students 30 seconds to plan and 60 seconds to respond.', 'Keep the transcript in the teacher key; do not distribute it before listening.'],
    sections: [{
      title: 'Task · Summarize and recommend',
      directions: 'Listen as your teacher reads the conversation twice. In 60 seconds, describe the student\'s problem, compare the suggested solutions, and say which one you recommend.',
      audioScript: ['Maya: The library is closing early this week while the lights are replaced. I have a group project due Friday, and it is hard to meet at my apartment because my younger brothers need the table for homework.', 'Leo: Our science room stays open until four on Wednesday. You could ask the teacher if your group may meet there. The community center also has tables, but it is a fifteen-minute walk from school.', 'Maya: The science room sounds easier. I could ask the teacher after class, and all four of us could meet before our buses leave. I will send the group a message now so everyone knows the time.'],
      questions: [
        response('What problem is Maya trying to solve?', 'Maya needs a place for her group to work before a Friday deadline. The library closes early and her home workspace is unavailable.', 'Name both the group project and the space/time constraint.', 2),
        selection('Which option does Maya seem to prefer?', ['A. Meet at her apartment after dinner.', 'B. Ask to use the science room after school.', 'C. Walk to the community center after the buses leave.', 'D. Wait until the library lights are replaced.'], 'B. Ask to use the science room after school.', 'Maya says that option is easier because it is at school and fits before the buses leave.'),
        response('Give a 60-second response that compares the science room with the community center and recommends one.', 'Sample: Maya needs a place for a group project before Friday. She could ask to use the science room, which is open after school, or walk to the community center. I recommend the science room because it is closer and the whole group can meet before their buses leave.', 'A complete response identifies the issue, mentions both options, and explains one recommendation.', 5)
      ]
    }], rubric: spokenRubric
  }),
  makeAssessment({
    id: 'tj-speaking-03', skill: 'Speaking', title: 'Explain a Fair Water Test',
    subtitle: 'Academic speaking: explain a procedure and why its controls matter',
    summary: 'Turn experiment notes into a clear, step-by-step explanation for a younger student.', duration: '18 minutes',
    objectives: ['Sequence a procedure', 'Explain the purpose of a controlled comparison', 'Use time and comparison language accurately'],
    teacherNotes: ['Students may point to or annotate the procedure notes before speaking.', 'Ask listeners to note whether the speaker explained why the thermometer and timing stay constant.'],
    sections: [{
      title: 'Task · Teach the procedure',
      directions: 'Use the notes to explain the creek investigation to a younger student. Plan for 30 seconds; speak for 60 seconds. Include the sequence and the reason for repeating measurements.',
      passage: ['Investigation notes: compare water at the shaded bend and the open bank. Use the same thermometer. Wait two minutes at each point. Take three readings at both locations. Record the time. If rain begins, reschedule both measurements.'],
      questions: [
        response('List the steps in the order you will explain them.', 'Visit the shaded bend and open bank; use the same thermometer; wait two minutes at each site; take three readings at each; record the time; reschedule both if rain begins.', 'Look for an order that a listener could actually follow.', 3),
        response('Why should students use the same thermometer and take repeated readings?', 'Using the same thermometer keeps the method consistent; repeated readings reduce the influence of one unusual measurement.', 'Both responses should connect a method to a fairer comparison.', 2),
        response('Give your step-by-step spoken explanation. Include one reason the conditions should be comparable.', 'Sample: First, measure at the shaded bend and then at the open bank. Use the same thermometer, wait two minutes at each site, and take three readings at both locations. Record the time. If rain starts, repeat both visits another day because rain could affect the water differently.', 'Award for an understandable sequence and a reason for controlling the comparison.', 5)
      ]
    }], rubric: spokenRubric
  }),
  makeAssessment({
    id: 'tj-speaking-04', skill: 'Speaking', title: 'Give Directions for a Museum Visit',
    subtitle: 'Clear oral instructions: sequence, landmark, and comprehension check',
    summary: 'Plan concise directions for a visiting student and check that the route is easy to follow.', duration: '18 minutes',
    objectives: ['Give directions in logical order', 'Use precise location words and landmarks', 'Confirm the listener understands the route'],
    teacherNotes: ['Students may sketch a simple route map while planning.', 'A route can vary if each turn and landmark is clear and consistent.'],
    sections: [{
      title: 'Task · Guide a visitor',
      directions: 'A new student is meeting your class at the history museum. Plan directions from the school entrance, then explain them aloud in 45-60 seconds.',
      passage: ['Campus route: enter through the main gate. Walk past the office to the central courtyard. Turn left at the fountain. Continue to the glass doors beside the flagpole. The museum entrance is the second door on the right.'],
      questions: [
        response('Write four route steps in the order a visitor should follow.', 'Enter the main gate; pass the office to the courtyard; turn left at the fountain; go to the glass doors by the flagpole and use the second door on the right.', 'The route should keep the left turn and final door location in the correct order.', 4),
        response('What landmark should the visitor use to decide when to turn?', 'The fountain in the central courtyard.', 'A useful landmark is the fountain, not just a direction without a reference point.', 1),
        response('Give the directions aloud. End by asking one question that checks whether your visitor knows where to meet.', 'Sample: Enter the main gate and walk past the office to the courtyard. Turn left at the fountain. Continue to the glass doors beside the flagpole. The museum is the second door on the right. Can you tell me which landmark you will look for first?', 'Award for sequence, location language, and a meaningful comprehension check.', 4)
      ]
    }], rubric: spokenRubric
  }),
  makeAssessment({
    id: 'tj-speaking-05', skill: 'Speaking', title: 'Summarize a School Science Update',
    subtitle: 'Short academic presentation: summarize evidence and explain a next step',
    summary: 'Deliver a concise science update that distinguishes a finding from a future plan.', duration: '20 minutes',
    objectives: ['Select the main finding from short notes', 'Use a number and comparison accurately', 'Separate current evidence from a proposed next step'],
    teacherNotes: ['Students should not claim causation from the small one-week comparison.', 'Ask listeners to identify the measurement and the proposed next step.'],
    sections: [{
      title: 'Task · One-minute science update',
      directions: 'Use the data notes to brief your class. Plan for 30 seconds; speak for one minute. Mention what was measured, what the result shows so far, and what the class will test next.',
      passage: ['Garden study notes: three shaded trays and three unshaded trays. Soil moisture recorded at 9 a.m. for five school days. Shaded trays averaged 18 units; unshaded trays averaged 12 units. The group will repeat the test next month with the same watering amount.'],
      questions: [
        selection('What was measured?', ['A. Soil moisture in shaded and unshaded trays.', 'B. Number of students in the science class.', 'C. Rainfall for an entire year.', 'D. Plant height in two different countries.'], 'A. Soil moisture in shaded and unshaded trays.', 'The notes name soil moisture and identify shaded and unshaded trays.'),
        response('What is one careful conclusion and one next step?', 'The shaded trays had a higher average moisture reading during the five recorded days. The group plans to repeat the test next month with the same watering amount.', 'Avoid claiming the shade alone caused the difference; name the short observation and stated next step.', 3),
        response('Give your one-minute oral update. Use the numbers 18 and 12 accurately.', 'Sample: For five school days, our group checked soil moisture at 9 a.m. in three shaded and three unshaded trays. The shaded trays averaged 18 units, compared with 12 for the unshaded trays. This is a difference in our small first sample, not yet a final rule. Next month we will repeat the test using the same amount of water.', 'Award for accurate numbers, cautious interpretation, and a coherent next step.', 5)
      ]
    }], rubric: spokenRubric
  }),
];

const LISTENING_ASSESSMENTS: JuniorAssessment[] = [
  makeAssessment({
    id: 'tj-listening-01', skill: 'Listening', title: 'Science Club Announcement: What Changed?',
    subtitle: 'Listen for a schedule change, materials, and the reason for an instruction',
    summary: 'Track a short school announcement and distinguish required details from background information.', duration: '15 minutes',
    objectives: ['Identify the announcement purpose', 'Recall changed time and location details', 'Connect an instruction to its stated reason'],
    teacherNotes: ['Read the script aloud twice at a natural pace; do not distribute the script with the student copy.', 'Pause briefly between sentences, not between answer-relevant phrases.'],
    sections: [{
      title: 'Listen · Science Club update',
      directions: 'Listen as your teacher reads the announcement twice. Answer from what you hear; the script is included only in the teacher key.',
      audioScript: ['Good afternoon, Science Club. Because the gym is being prepared for the school concert, our Thursday meeting will move from the gym to room 214. We will still meet from 3:15 to 4:00. Bring your notebook, a pencil, and one clean plastic bottle for the water-filter design challenge. Please do not bring scissors; the teacher will provide safe cutting tools. If you cannot bring a bottle, a teammate can share one. The activity begins next week, not today, so use this meeting to form teams and sketch a first design.'],
      questions: [
        selection('Why is the meeting location changing?', ['A. A concert is being prepared in the gym.', 'B. Room 214 has new science equipment.', 'C. The teacher is absent on Thursday.', 'D. Students requested a longer meeting.'], 'A. A concert is being prepared in the gym.', 'The announcement says the gym is being prepared for the school concert.'),
        selection('When will the club meet?', ['A. 2:15 to 3:00', 'B. 3:15 to 4:00', 'C. 4:00 to 4:45', 'D. Friday at 3:15'], 'B. 3:15 to 4:00', 'The time stays the same even though the location changes.'),
        selection('What should a student do if they cannot bring a bottle?', ['A. Skip the meeting.', 'B. Bring scissors instead.', 'C. Ask a teammate to share one.', 'D. Bring the bottle next Thursday and leave early.'], 'C. Ask a teammate to share one.', 'The speaker explicitly says a teammate can share a bottle.'),
        response('What will students do at this meeting, and when does the design challenge begin?', 'They will form teams and sketch a first design. The challenge activity begins next week, not at this meeting.', 'Distinguish today’s planning meeting from next week’s challenge.', 2)
      ]
    }],
    rubric: rubric([['Detail accuracy', 4, 'Accurately records the changed room, unchanged time, needed materials, and activity date.'], ['Listening inference', 4, 'Explains the relationship between the concert setup and the room change.'], ['Response clarity', 4, 'Uses complete, direct responses and does not invent a detail not stated in the announcement.']])
  }),
  makeAssessment({
    id: 'tj-listening-02', skill: 'Listening', title: 'Conversation at the School Library',
    subtitle: 'Listen for two preferences and infer a reasonable next step',
    summary: 'Understand a student-librarian exchange about selecting a suitable research book.', duration: '15 minutes',
    objectives: ['Identify the student\'s task and preference', 'Compare two options using spoken details', 'Infer the next action from the conversation'],
    teacherNotes: ['Read the dialogue twice; use a distinct but natural voice for each speaker.', 'Do not read the answer options aloud.'],
    sections: [{
      title: 'Listen · Research book conversation',
      directions: 'Listen to the conversation twice. Pay attention to the student\'s assignment, preferences, and the librarian\'s suggested plan.',
      audioScript: ['Librarian: What are you researching, Sam? Student: How city parks help birds. My teacher asked us to use a nonfiction book and take notes from at least two sections. Librarian: This large guide has many species names, but it is written for specialists. This field book is shorter and has a map of the local park. Student: I think the field book will help me start. Does it have information about nesting areas? Librarian: Yes, in the habitat section. You could borrow it first, then compare its map with our park website. The website can help you check whether the places in the book still look the same. Student: I will do that and take notes on the habitat section today.'],
      questions: [
        selection('What is Sam researching?', ['A. How city parks help birds.', 'B. How maps are drawn.', 'C. Why books are written for specialists.', 'D. How to build a bird feeder.'], 'A. How city parks help birds.', 'Sam states his research topic at the beginning.'),
        selection('Why does Sam prefer the shorter field book?', ['A. It includes a local-park map and is a useful starting point.', 'B. It is written for specialists and has more species names.', 'C. It replaces the teacher\'s note-taking requirement.', 'D. It contains the current school website.'], 'A. It includes a local-park map and is a useful starting point.', 'Sam notes the field book is a good start; the librarian mentions its local map.'),
        selection('What does the librarian suggest Sam do after borrowing the book?', ['A. Ignore the habitat section.', 'B. Compare its map with the park website.', 'C. Select the specialist guide instead.', 'D. Ask the class to write the book.'], 'B. Compare its map with the park website.', 'The librarian says a website comparison can check whether the places still look the same.'),
        response('Which book will Sam use first, and what will Sam do with it today?', 'Sam will start with the shorter field book and take notes on the habitat section today.', 'Name both the book choice and the immediate action.', 2)
      ]
    }], rubric: rubric([['Purpose and preference', 4, 'Identifies the assignment and accurately explains why the student selects the field book.'], ['Details', 4, 'Recalls the habitat section and map/website suggestion.'], ['Inference', 4, 'Recognizes the librarian recommends checking whether mapped places are current.']])
  }),
  makeAssessment({
    id: 'tj-listening-03', skill: 'Listening', title: 'Student Radio: A Local History Interview',
    subtitle: 'Listen for a cause, a piece of evidence, and a distinction in a short interview',
    summary: 'Follow a student-host interview and identify why a town bridge became a historical landmark.', duration: '18 minutes',
    objectives: ['Identify a historical cause-and-effect relationship', 'Separate evidence from a broad claim', 'Recall the interviewee\'s recommended follow-up'],
    teacherNotes: ['Read the interview script twice. Avoid emphasizing the answer choices.', 'After scoring, discuss which detail supports the interviewee\'s careful conclusion.'],
    sections: [{
      title: 'Listen · The bridge and the town market',
      directions: 'Listen to the student radio interview twice. Choose the best response or explain the answer in your own words.',
      audioScript: ['Host: Why do people in Riverton talk about the old bridge? Historian: It connected the farms north of the river to the Saturday market downtown. Before the bridge opened, farmers crossed by a shallow ford, which was often difficult after heavy rain. Host: Did the bridge make everyone move downtown? Historian: We cannot conclude that from the town map alone. A shopkeeper\'s diary from 1912 says market deliveries arrived earlier after the bridge opened, and a school record shows more students from the north side attended. Those records point to changes in travel, but they do not explain every family\'s decision. Host: What would you examine next? Historian: I would compare maps and family letters from before and after the bridge opened.'],
      questions: [
        selection('What was the bridge\'s main practical purpose?', ['A. Connect north-side farms with the downtown market.', 'B. Stop all rain from reaching the river.', 'C. Move the school to the northern farms.', 'D. Replace the Saturday market.'], 'A. Connect north-side farms with the downtown market.', 'The historian says the bridge connected northern farms to the Saturday market.'),
        selection('What do the diary and school record suggest?', ['A. Travel and access may have changed after the bridge opened.', 'B. Every family moved downtown in 1912.', 'C. Heavy rain stopped permanently.', 'D. The market no longer needed deliveries.'], 'A. Travel and access may have changed after the bridge opened.', 'The records point to changes, but the historian warns they do not explain every family\'s choice.'),
        selection('Why does the historian avoid concluding that everyone moved downtown?', ['A. The historian has only a map and a few records that cannot explain every family\'s decision.', 'B. The bridge was never opened.', 'C. The market closed after 1912.', 'D. The school record was written in another town.'], 'A. The historian has only a map and a few records that cannot explain every family\'s decision.', 'The interview explicitly warns against treating limited evidence as a universal explanation.'),
        response('What sources does the historian plan to compare next?', 'Maps and family letters from before and after the bridge opened.', 'Both source types and the before/after comparison matter.', 2)
      ]
    }], rubric: rubric([['Key information', 4, 'Identifies the bridge connection and the market purpose.'], ['Evidence and limits', 4, 'Uses both historical records and respects the historian\'s caution.'], ['Next-step inference', 4, 'Names maps and family letters as the proposed next sources.']])
  }),
  makeAssessment({
    id: 'tj-listening-04', skill: 'Listening', title: 'Field Trip: A Change in the Weather Plan',
    subtitle: 'Listen for a schedule sequence, a condition, and a reason for the change',
    summary: 'Track how a science field trip changes when the weather forecast shifts.', duration: '18 minutes',
    objectives: ['Recall a revised schedule', 'Identify a condition that changes the plan', 'Explain how the teacher protects the learning goal'],
    teacherNotes: ['Read twice. Students may take brief notes on times and locations.', 'The intended inference is a change in activity order, not cancellation of the whole trip.'],
    sections: [{
      title: 'Listen · Wetland field trip update',
      directions: 'Listen twice to the teacher\'s update. Note which activities move and which stay on the schedule.',
      audioScript: ['Teacher: The forecast now shows rain between nine and ten, so we will change our wetland schedule. We will begin with the indoor visitor exhibit when we arrive at nine. At ten fifteen, if the rain has stopped, our guide will take us to the bird-viewing deck. Bring your notebook and a waterproof jacket. We will still return to school at one thirty. If the deck is closed, the guide will lead a map activity inside instead. This way we can study the habitat even if the trail is unsafe.'],
      questions: [
        selection('Which activity will students do first?', ['A. Visit the indoor exhibit.', 'B. Go to the bird-viewing deck.', 'C. Return to school.', 'D. Walk the trail before nine.'], 'A. Visit the indoor exhibit.', 'The teacher changes the order so the group begins indoors during the rain.'),
        selection('What condition must be met before students go to the deck?', ['A. The class must finish its notebooks.', 'B. The rain must have stopped and the deck must be available.', 'C. The group must arrive at school by one.', 'D. The exhibit must be closed.'], 'B. The rain must have stopped and the deck must be available.', 'The teacher gives weather and access conditions for the outdoor activity.'),
        selection('What happens if the deck is closed?', ['A. The trip is cancelled immediately.', 'B. The class does a map activity indoors.', 'C. Students return to school before lunch.', 'D. The guide waits outside until one thirty.'], 'B. The class does a map activity indoors.', 'The indoor map activity lets students study the habitat if the trail is unsafe.'),
        response('Why does the teacher keep an indoor activity in the plan?', 'It allows students to study the wetland habitat even if rain makes the trail unsafe.', 'Connect the safety condition to the preserved learning goal.', 2)
      ]
    }], rubric: rubric([['Schedule recall', 4, 'Correctly places the indoor exhibit first and the deck later if conditions allow.'], ['Conditional detail', 4, 'Identifies the rain/deck condition and indoor map alternative.'], ['Reasoning', 4, 'Explains that the backup activity preserves habitat learning while avoiding an unsafe trail.']])
  }),
  makeAssessment({
    id: 'tj-listening-05', skill: 'Listening', title: 'Science Class: Testing a Paper Bridge',
    subtitle: 'Listen for the variable, the control, and a conclusion supported by trial data',
    summary: 'Analyze a brief classroom discussion about fair testing and bridge strength.', duration: '18 minutes',
    objectives: ['Identify what is changed and measured', 'Explain why one test condition stays constant', 'Match a conclusion to recorded evidence'],
    teacherNotes: ['Read the discussion twice. Keep stress and speaking rate natural.', 'Ask students to justify the answer using a detail heard in the discussion.'],
    sections: [{
      title: 'Listen · How much weight can the bridge hold?',
      directions: 'Listen to the class discussion twice. Focus on the materials, the test setup, and what the students can reasonably conclude.',
      audioScript: ['Teacher: Each team will fold one sheet of paper into a bridge between two identical books. What should we change? Student: The fold pattern. We can test a flat sheet, an accordion fold, and a triangular fold. Teacher: Good. What should stay the same? Student: The distance between the books and the size of the paper. Teacher: Exactly. Add metal washers one at a time and count how many the bridge holds before it bends. Student: If the accordion bridge holds the most in our tests, can we say accordion folds are always strongest? Teacher: You can say they held more in these trials. Repeat each pattern three times before making a broader claim.'],
      questions: [
        selection('What variable will the teams change?', ['A. The fold pattern of the paper.', 'B. The size of the books.', 'C. The space between the books.', 'D. The number of test trials.'], 'A. The fold pattern of the paper.', 'The student proposes comparing flat, accordion, and triangular folds.'),
        selection('What should remain the same?', ['A. The fold pattern and washer count.', 'B. The paper size and distance between the books.', 'C. The final conclusion.', 'D. The number of students on each team.'], 'B. The paper size and distance between the books.', 'The discussion explicitly identifies both controlled conditions.'),
        selection('What does the teacher say students may conclude after a single set of trials?', ['A. One pattern is always strongest in every situation.', 'B. One pattern held the most weight in their trials.', 'C. The paper can never bend.', 'D. The paper size does not matter.'], 'B. One pattern held the most weight in their trials.', 'The teacher limits the claim to the observed tests and requests repeated trials.'),
        response('Why repeat each pattern three times?', 'Repeating the test gives more observations before making a broader claim and reduces reliance on one unusual trial.', 'Look for the reason to support a reliable, limited conclusion.', 2)
      ]
    }], rubric: rubric([['Variables', 4, 'Correctly names the fold pattern as the changed variable and paper size/book spacing as controls.'], ['Evidence', 4, 'Uses the washer count/trial result accurately.'], ['Conclusion limits', 4, 'Recognizes that the results support a claim about these trials, not every paper bridge.']])
  }),
];

const WRITING_ASSESSMENTS: JuniorAssessment[] = [
  makeAssessment({
    id: 'tj-writing-01', skill: 'Writing', title: 'Reply to a Field Trip Schedule Change',
    subtitle: 'Purposeful email writing: confirm, clarify, and suggest one practical detail',
    summary: 'Write a concise message to a teacher after the field-trip timetable changes.', duration: '25 minutes',
    objectives: ['Respond to every part of a school email', 'Organize a clear request or confirmation', 'Use an appropriate greeting and closing'],
    teacherNotes: ['The scenario is original practice, not an official TOEFL task.', 'Accept a suitable request that fits the stated schedule and keeps student safety in mind.'],
    sections: [{
      title: 'Task · Write the reply',
      directions: 'Read the teacher message. Write an 80-110 word reply that confirms what you understand, asks one useful question, and suggests one preparation item.',
      passage: ['Message from Ms. Chen: Our visit to the town history museum is now on Thursday. The bus leaves school at 9:10 a.m. and returns by 1:30 p.m. Please bring lunch and your observation notebook. We will meet beside the library doors before boarding. Reply by Tuesday if you need to borrow a notebook.'],
      questions: [
        response('Write your reply. Include a greeting, confirmation of the new day or meeting place, one useful question, and a closing.', 'Sample: Hello Ms. Chen, Thank you for the schedule update. I will meet the class beside the library doors on Thursday before the 9:10 bus. I will bring lunch and my notebook. Could you please tell me whether we should pack a pencil as well? I do not need to borrow a notebook. Best, Jordan.', 'Award for purpose, accurate details, a relevant question, and appropriate tone. Answers vary.', 7),
        response('Underline the sentence that asks a useful question. Why would the answer help you prepare?', 'Answers vary. The question should relate to the visit (for example, whether to bring a pencil) and its answer should help the student prepare.', 'A useful question requests missing information rather than repeating a detail already given.', 2),
        response('Check your reply: list two details from the original message that you included accurately.', 'Any two accurate details: Thursday, departure at 9:10, return by 1:30, lunch, observation notebook, meeting beside the library doors, or the Tuesday borrow-notebook deadline.', 'Check details against the source message; do not accept invented times or locations.', 2)
      ]
    }], rubric: writingRubric
  }),
  makeAssessment({
    id: 'tj-writing-02', skill: 'Writing', title: 'Summarize the Rooftop Garden Trial',
    subtitle: 'Academic summary: select the key finding and preserve the study limitation',
    summary: 'Write a concise, accurate summary of a small school experiment without overstating its results.', duration: '25 minutes',
    objectives: ['Identify the study question and measured result', 'Use comparative data accurately', 'Include a limitation or next step'],
    teacherNotes: ['Require students to distinguish an observed association from proof of cause.', 'The data and study are fictional, original teaching materials.'],
    sections: [{
      title: 'Task · Write a 70-90 word summary',
      directions: 'Read the study note. Summarize the question, result, and next step in your own words. Do not claim that one short trial proves a general rule.',
      passage: ['Study note: A science class placed three identical soil trays in a shaded area and three in an open area. All trays received the same measured amount of water. For five school days, the class recorded soil moisture at 9 a.m. The shaded trays averaged 18 units; the open trays averaged 12. The class plans to repeat the experiment next month because temperature and rainfall can change.'],
      questions: [
        response('Write a 70-90 word summary of the question, method, result, and planned next step.', 'Sample: A science class compared soil moisture in shaded and open areas. Students watered six identical trays equally and recorded moisture each morning for five days. The shaded trays averaged 18 units, while the open trays averaged 12. The observation suggests a difference during this short trial, but it does not establish a general rule. The class plans to repeat the test next month because weather conditions can change.', 'Look for method, both numbers, careful interpretation, and planned replication.', 7),
        selection('Which statement is too strong for the evidence?', ['A. In this trial, shaded trays had a higher average reading.', 'B. The class plans to repeat the test.', 'C. Shade always makes soil exactly six units wetter.', 'D. The experiment lasted five school days.'], 'C. Shade always makes soil exactly six units wetter.', 'One small trial cannot prove an always-true result or establish a universal difference.'),
        response('Name one detail you left out of your summary and explain why it was less important than the main finding.', 'Answers vary. A reasonable response may omit the time of day or number of trays because the result, method, limitation, and next step are more central to the short summary.', 'The student should identify a real detail and explain the summarizing choice.', 2)
      ]
    }], rubric: writingRubric
  }),
  makeAssessment({
    id: 'tj-writing-03', skill: 'Writing', title: 'Make a Case for a Quiet Study Period',
    subtitle: 'Opinion writing: make a claim and support it with a relevant example',
    summary: 'Write a short school proposal and address one practical concern fairly.', duration: '25 minutes',
    objectives: ['State a specific position', 'Support it with a reason and example', 'Acknowledge a concern and answer it'],
    teacherNotes: ['Either position can earn full credit when it is well supported.', 'Do not score students for agreeing with a particular policy preference.'],
    sections: [{
      title: 'Task · Propose a school routine',
      directions: 'Write 100-130 words recommending whether the school should offer a 20-minute quiet study period twice a week. Include a claim, one example, and one concern with a response.',
      passage: ['Student council note: Several students say they need a quiet place to finish reading or review class notes before going home. Other students worry that a quiet period would reduce time for clubs and group activities. The council has asked for short written recommendations before its next meeting.'],
      questions: [
        response('Write your recommendation. Make your position clear and use a specific example from a student\'s school day.', 'Answers vary. A complete answer states a yes/no position, gives a relevant example, addresses the club-time concern, and explains its response.', 'Use the rubric: the example must support the claim and the counterpoint must be acknowledged fairly.', 9),
        response('Underline your main claim. Circle the sentence that responds to a concern. Which is easier to locate, and how could you make the other clearer?', 'Answers vary. Students should identify both rhetorical moves and make one actionable revision.', 'This reflection checks structure as well as the opinion itself.', 3)
      ]
    }], rubric: writingRubric
  }),
  makeAssessment({
    id: 'tj-writing-04', skill: 'Writing', title: 'Compare Two Plans for the School Garden',
    subtitle: 'Source-based writing: compare options and cite specific details',
    summary: 'Combine two short proposals into a supported recommendation for a class garden.', duration: '30 minutes',
    objectives: ['Compare two plans fairly', 'Use evidence from both sources', 'Support a practical recommendation with a reason'],
    teacherNotes: ['Both notes are fictional and written for this assessment.', 'Students may prefer either proposal; assess the evidence and reasoning, not the choice.'],
    sections: [{
      title: 'Read · Two garden proposals',
      directions: 'Read both notes, then write a 120-150 word recommendation that uses at least one detail from each.',
      passage: ['Plan A: The class could plant quick-growing herbs in containers beside the sunny classroom windows. Students can measure growth each week, and the containers can be moved if the temperature changes. The class would need to water them regularly.', 'Plan B: The class could plant native flowers in a small outdoor bed. The flowers could provide food for local pollinators and need less watering after they are established. Students would need permission to use the outdoor area and help prepare the soil.'],
      questions: [
        response('Which plan do you recommend? Compare at least one benefit and one requirement or limitation of each plan.', 'Answers vary. A complete response accurately contrasts indoor moveable herb containers and their watering need with an outdoor native flower bed and its permission/soil preparation needs.', 'Use the source details accurately; the recommendation must follow from the trade-off described.', 9),
        response('Write one sentence that cites a detail from Plan A and one that cites a detail from Plan B.', 'Answers vary. Plan A evidence: containers can move with temperature changes or support weekly growth measurements. Plan B evidence: native flowers can support pollinators or need less watering after establishment, but need approval/soil prep.', 'Both sources need to contribute relevant evidence.', 4),
        response('What additional information would help the class decide?', 'Answers vary. Useful questions include whether the outdoor area is approved, how much sunlight the indoor windows receive, who will water plants during breaks, or what the soil needs.', 'A useful question identifies missing decision information rather than repeating a stated fact.', 2)
      ]
    }], rubric: writingRubric
  }),
  makeAssessment({
    id: 'tj-writing-05', skill: 'Writing', title: 'Report a Small Library Survey',
    subtitle: 'Data-based writing: describe a pattern without claiming more than the table shows',
    summary: 'Write a short report on student book-format preferences and suggest a next survey question.', duration: '25 minutes',
    objectives: ['Report and compare numerical information', 'Describe a clear pattern', 'Avoid interpreting preferences as causes or reading ability'],
    teacherNotes: ['The following invented class results are for writing practice, not actual research.', 'Accept alternative descriptions that use counts accurately and do not imply causes.'],
    sections: [{
      title: 'Read · Class survey results',
      directions: 'Use the table to write a 90-120 word report. Describe the largest and smallest counts and suggest one follow-up question.',
      passage: ['Format chosen for a free-reading session (24 students total): Print book - 11 students; e-book - 7 students; audiobook - 4 students; no preference - 2 students. Students were asked to select one format. The survey did not ask why they selected it.'],
      questions: [
        response('Write a 90-120 word report describing the survey results. Include at least two exact counts.', 'Sample: In a class survey of 24 students, print books were the most selected format, with 11 students. Seven chose e-books, four chose audiobooks, and two reported no preference. The survey describes format choices for one free-reading session only. Because students were not asked why they chose a format, the results do not show the reason for their preferences. A useful follow-up question would ask what matters most when choosing a book format.', 'Check the totals and avoid claiming why students chose a format.', 8),
        selection('Which conclusion is supported by the table?', ['A. Every student reads more in print.', 'B. Print books received the most selections in this class survey.', 'C. Audiobooks are the least useful format.', 'D. The format caused students to prefer different subjects.'], 'B. Print books received the most selections in this class survey.', 'The count supports a description of this survey, not a claim about reading amount, value, or cause.'),
        response('What follow-up question would help explain the choices?', 'Answers vary. Example: “What is the main reason you chose that format for this session?”', 'A useful question asks about a reason the original survey did not collect.', 2)
      ]
    }], rubric: writingRubric
  }),
];

export const TOEFL_JUNIOR_ASSESSMENTS: JuniorAssessment[] = [
  ...SPEAKING_ASSESSMENTS,
  ...LISTENING_ASSESSMENTS,
  ...WRITING_ASSESSMENTS,
];