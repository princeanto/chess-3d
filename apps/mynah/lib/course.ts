/**
 * The course.
 *
 * Authored as facts, not as questions: a word with a real sentence around it, a
 * mistake with the reason it is a mistake, a sentence worth being able to
 * assemble. `lesson.ts` turns each of these into several kinds of exercise, so
 * one entry becomes a meaning question, a gap in context and a listening
 * question rather than the same flashcard three times over.
 *
 * Two rules held throughout. Every example sentence contains its word exactly as
 * written, because the gap exercise is made by cutting the word out of it. And
 * every explanation says *why*, not merely what — "since marks the moment it
 * started, for measures the length" is the bit that fixes the error for good.
 */

import type { BuildItem, ErrorItem, Item, Unit, WordItem } from './types';

export const UNITS: Unit[] = [
  { id: 'a1-basics', level: 'A1', title: 'First words', blurb: 'Greetings, people, places, and the verb to be.' },
  { id: 'a1-day', level: 'A1', title: 'Your day', blurb: 'Meals, times, routines and how often you do things.' },
  { id: 'a1-place', level: 'A1', title: 'Where things are', blurb: 'Rooms, directions and the prepositions of place.' },
  { id: 'a2-past', level: 'A2', title: 'Talking about the past', blurb: 'The past simple and the irregular verbs that resist it.' },
  { id: 'a2-town', level: 'A2', title: 'Out and about', blurb: 'Shops, tickets, travel and getting things sorted.' },
  { id: 'a2-people', level: 'A2', title: 'People and feelings', blurb: 'Describing character without reaching for nice and bad.' },
  { id: 'b1-prep', level: 'B1', title: 'Prepositions that trip everyone', blurb: 'In, on, at, since, for, by, until — the ones that never settle.' },
  { id: 'b1-phrasal', level: 'B1', title: 'Phrasal verbs', blurb: 'The everyday verbs that change meaning with a small word.' },
  { id: 'b1-confuse', level: 'B1', title: 'Words that get mixed up', blurb: 'Lend and borrow, say and tell, affect and effect, fewer and less.' },
  { id: 'b2-tense', level: 'B2', title: 'Tenses that nearly work', blurb: 'Perfect and past, conditionals, reported speech.' },
  { id: 'b2-natural', level: 'B2', title: 'Sounding natural at work', blurb: 'Deadlines, drafts and feedback — English that earns its keep.' },
  { id: 'c1-register', level: 'C1', title: 'Register and nuance', blurb: 'Formal writing, hedging, and the errors that survive fluency.' },
];

/* Terse constructors, so the content reads as content and not as punctuation. */
const w = (id: string, unit: string, word: string, meaning: string, example: string, distractors: string[]): WordItem =>
  ({ kind: 'word', id, unit, word, meaning, example, distractors });
const e = (id: string, unit: string, wrong: string, right: string, why: string): ErrorItem =>
  ({ kind: 'error', id, unit, wrong, right, why });
const b = (id: string, unit: string, sentence: string, why: string): BuildItem =>
  ({ kind: 'build', id, unit, sentence, why });

export const ITEMS: Item[] = [
  /* ------------------------------ A1 · First words ----------------------- */
  w('w1', 'a1-basics', 'hello', 'a greeting when you meet someone', 'Hello, my name is Sara.', ['a way of saying goodbye', 'a word meaning thank you', 'a question about age']),
  w('w2', 'a1-basics', 'friend', 'someone you like and know well', 'She is my best friend.', ['a member of your family', 'a person you pay to help you', 'someone you have never met']),
  w('w3', 'a1-basics', 'water', 'the clear liquid you drink', 'Can I have some water, please?', ['a hot drink made with milk', 'a kind of bread', 'a piece of fruit']),
  w('w4', 'a1-basics', 'house', 'a building where people live', 'Their house has a red door.', ['a shop that sells food', 'a place where trains stop', 'a room for cooking']),
  w('w5', 'a1-basics', 'small', 'not big', 'This shirt is too small for me.', ['very tall', 'costing a lot', 'happening slowly']),
  w('w6', 'a1-basics', 'happy', 'feeling pleased', 'The children were happy with their presents.', ['feeling tired', 'feeling hungry', 'feeling afraid']),
  w('w7', 'a1-basics', 'tired', 'needing rest or sleep', 'I was tired after the long walk.', ['full of energy', 'feeling excited', 'feeling cold']),
  w('w8', 'a1-basics', 'school', 'a place where children learn', 'My brother walks to school every morning.', ['a place to buy medicine', 'a place to keep money', 'a place to catch a bus']),
  w('w9', 'a1-basics', 'expensive', 'costing a lot of money', 'That phone is too expensive for me.', ['very cheap', 'very heavy', 'very old']),
  w('w10', 'a1-basics', 'teacher', 'a person whose job is to teach', 'Our teacher gave us homework.', ['a person who studies', 'a person who drives a bus', 'a person who sells things']),
  e('e1', 'a1-basics', 'I am agree with you.', 'I agree with you.', 'Agree is a verb on its own. It does not need am, is or are in front of it.'),
  e('e2', 'a1-basics', 'She have two brothers.', 'She has two brothers.', 'He, she and it take has. Everything else takes have.'),
  e('e3', 'a1-basics', 'He don’t like coffee.', 'He doesn’t like coffee.', 'He, she and it take doesn’t. I, you, we and they take don’t.'),
  e('e4', 'a1-basics', 'I have 25 years.', 'I am 25 years old.', 'English states age with be, not have. You are a number of years old.'),
  e('e5', 'a1-basics', 'Where you are going?', 'Where are you going?', 'In a question the verb comes before the subject: are you, not you are.'),
  e('e6', 'a1-basics', 'The people is waiting outside.', 'The people are waiting outside.', 'People is already plural, so it takes are.'),
  b('b1', 'a1-basics', 'She does not live here.', 'Does not comes before the main verb, and the verb stays in its base form.'),
  b('b2', 'a1-basics', 'How much does it cost?', 'In a question with do, the subject sits between does and the verb.'),

  /* -------------------------------- A1 · Your day ------------------------ */
  w('w11', 'a1-day', 'breakfast', 'the first meal of the day', 'I have breakfast at seven.', ['the last meal of the day', 'a short sleep in the afternoon', 'a drink taken after dinner']),
  w('w12', 'a1-day', 'usually', 'most of the time', 'I usually walk to work.', ['never', 'only once', 'very quickly']),
  w('w13', 'a1-day', 'early', 'before the usual time', 'She woke up early to catch the bus.', ['after the usual time', 'late in the evening', 'very slowly']),
  w('w14', 'a1-day', 'busy', 'having a lot to do', 'I am busy this week.', ['having nothing to do', 'feeling unwell', 'away on holiday']),
  w('w15', 'a1-day', 'weekend', 'Saturday and Sunday', 'We visit my grandmother at the weekend.', ['the middle of the week', 'a public holiday', 'the end of the year']),
  w('w16', 'a1-day', 'hungry', 'wanting to eat', 'The dog looks hungry.', ['wanting to sleep', 'feeling too hot', 'wanting a drink']),
  w('w17', 'a1-day', 'cheap', 'not costing much', 'The tickets were cheap.', ['costing a great deal', 'very rare', 'hard to find']),
  w('w18', 'a1-day', 'often', 'many times', 'We often eat together on Fridays.', ['almost never', 'only in summer', 'once a year']),
  w('w19', 'a1-day', 'finish', 'to come to the end of something', 'I finish work at six.', ['to begin something', 'to forget something', 'to lose something']),
  w('w20', 'a1-day', 'quiet', 'with little noise', 'The house is quiet in the morning.', ['very loud', 'very bright', 'very crowded']),
  e('e7', 'a1-day', 'I go to school by foot.', 'I go to school on foot.', 'It is on foot, though by bus, by car and by train.'),
  e('e8', 'a1-day', 'She is teacher at our school.', 'She is a teacher at our school.', 'Jobs take a or an: a teacher, an engineer.'),
  e('e9', 'a1-day', 'I am going to home.', 'I am going home.', 'Home takes no preposition after go. Compare going to work, which does.'),
  e('e10', 'a1-day', 'I didn’t went out last night.', 'I didn’t go out last night.', 'Didn’t already carries the past, so the verb goes back to its base form.'),
  b('b3', 'a1-day', 'I usually get up at seven.', 'Words like usually and often sit before the main verb.'),
  b('b4', 'a1-day', 'My sister works in a hospital.', 'He, she and it add -s to the verb in the present simple.'),

  /* ---------------------------- A1 · Where things are -------------------- */
  w('w21', 'a1-place', 'near', 'not far away', 'The bank is near the station.', ['a long way away', 'inside a building', 'above something']),
  w('w22', 'a1-place', 'between', 'in the space separating two things', 'The cafe is between the bank and the library.', ['on top of something', 'behind everything', 'far from both']),
  w('w23', 'a1-place', 'opposite', 'facing something, on the other side', 'The chemist is opposite the school.', ['right next door to', 'inside the same building', 'underneath']),
  w('w24', 'a1-place', 'upstairs', 'on a higher floor', 'The bathroom is upstairs.', ['outside the building', 'in the garden', 'on the ground floor']),
  w('w25', 'a1-place', 'corner', 'the point where two sides meet', 'There is a post box on the corner.', ['the middle of a room', 'the top of a hill', 'the far end of a road']),
  w('w26', 'a1-place', 'kitchen', 'the room where food is cooked', 'She is in the kitchen making tea.', ['the room where you sleep', 'a room kept for guests', 'a place to wash clothes']),
  w('w27', 'a1-place', 'crowded', 'full of people', 'The train was crowded this morning.', ['completely empty', 'very quiet', 'freshly cleaned']),
  w('w28', 'a1-place', 'behind', 'at the back of', 'The garden is behind the house.', ['in front of', 'beside', 'far above']),
  w('w29', 'a1-place', 'straight', 'not turning to one side', 'Go straight for two hundred metres.', ['turning left', 'going back the way you came', 'stopping at once']),
  w('w30', 'a1-place', 'downstairs', 'on a lower floor', 'The kitchen is downstairs.', ['on the roof', 'on a higher floor', 'in the next street']),
  e('e11', 'a1-place', 'There is many people here.', 'There are many people here.', 'A plural subject takes there are.'),
  e('e12', 'a1-place', 'He is more tall than his brother.', 'He is taller than his brother.', 'Short adjectives take -er. Only longer ones take more.'),
  b('b5', 'a1-place', 'There are two rooms upstairs.', 'There are for more than one; there is for a single thing.'),

  /* ------------------------- A2 · Talking about the past ----------------- */
  w('w31', 'a2-past', 'bought', 'the past of buy', 'I bought this jacket last year.', ['the past of bring', 'the past of build', 'the past of borrow']),
  w('w32', 'a2-past', 'caught', 'the past of catch', 'She caught the early train.', ['the past of cut', 'the past of cook', 'the past of call']),
  w('w33', 'a2-past', 'thought', 'the past of think', 'I thought you were coming.', ['the past of thank', 'the past of throw', 'the past of teach']),
  w('w34', 'a2-past', 'went', 'the past of go', 'We went to the beach on Sunday.', ['the past of want', 'the past of win', 'the past of wait']),
  w('w35', 'a2-past', 'ago', 'before now', 'We met three years ago.', ['from now on', 'ever since then', 'for a short while']),
  w('w36', 'a2-past', 'yesterday', 'the day before today', 'It rained all day yesterday.', ['the day after today', 'earlier this week', 'this morning']),
  w('w37', 'a2-past', 'suddenly', 'quickly and unexpectedly', 'Suddenly the lights went out.', ['slowly over time', 'exactly as expected', 'every evening']),
  w('w38', 'a2-past', 'forgot', 'the past of forget', 'I forgot my umbrella.', ['the past of forgive', 'the past of find', 'the past of follow']),
  w('w39', 'a2-past', 'arrived', 'got to a place', 'We arrived at the hotel after midnight.', ['left a place', 'waited outside', 'turned back']),
  w('w40', 'a2-past', 'enough', 'as much as is needed', 'We did not have enough time.', ['far too much', 'almost none', 'more than needed']),
  e('e13', 'a2-past', 'Yesterday I have seen him at the market.', 'Yesterday I saw him at the market.', 'A finished time such as yesterday takes the past simple, never the present perfect.'),
  e('e14', 'a2-past', 'I am boring in this class.', 'I am bored in this class.', 'The -ed form says how you feel; the -ing form describes the thing causing it.'),
  e('e15', 'a2-past', 'Everyone are ready to leave.', 'Everyone is ready to leave.', 'Everyone, everybody and nobody are singular.'),
  e('e16', 'a2-past', 'I have a good news for you.', 'I have good news for you.', 'News is uncountable, so it takes no a.'),
  b('b6', 'a2-past', 'We did not go out last night.', 'After did not, the verb returns to its base form.'),
  b('b7', 'a2-past', 'He was watching television when I arrived.', 'The longer action takes was -ing; the one that interrupts it takes the past simple.'),
  b('b8', 'a2-past', 'Did you enjoy the film?', 'Past questions use did plus the base verb, never did plus the past form.'),

  /* ----------------------------- A2 · Out and about ---------------------- */
  w('w41', 'a2-town', 'receipt', 'a paper showing what you paid', 'Keep the receipt in case it does not fit.', ['a list of prices', 'a bill you still owe', 'an order form']),
  w('w42', 'a2-town', 'queue', 'a line of people waiting', 'There was a long queue at the counter.', ['a group of friends', 'a row of shops', 'a kind of ticket']),
  w('w43', 'a2-town', 'refund', 'money given back to you', 'They gave me a refund for the broken kettle.', ['a reduction in price', 'a free gift', 'an extra charge']),
  w('w44', 'a2-town', 'discount', 'a reduction in price', 'Students get a ten percent discount.', ['an added fee', 'the full price', 'a delivery charge']),
  w('w45', 'a2-town', 'platform', 'where you stand to get on a train', 'The train leaves from platform four.', ['a ticket window', 'a waiting room', 'a bus stop']),
  w('w46', 'a2-town', 'delayed', 'happening later than planned', 'Our flight was delayed by two hours.', ['cancelled altogether', 'earlier than planned', 'exactly on time']),
  w('w47', 'a2-town', 'nearby', 'a short distance away', 'Is there a pharmacy nearby?', ['a very long way off', 'in another city', 'on the top floor']),
  w('w48', 'a2-town', 'cash', 'notes and coins', 'Do you take cash or only cards?', ['a bank card', 'a cheque', 'a bank account']),
  w('w49', 'a2-town', 'spare', 'extra, kept in case it is needed', 'I keep a spare key at my neighbour’s.', ['the only one there is', 'already in use', 'broken beyond repair']),
  w('w50', 'a2-town', 'crossing', 'a place to walk across a road', 'Use the crossing outside the school.', ['a traffic light', 'a roundabout', 'a bridge for cars']),
  e('e17', 'a2-town', 'He said me the truth.', 'He told me the truth.', 'Tell takes a person straight after it; say does not. You tell someone, but say something.'),
  e('e18', 'a2-town', 'I explained him the problem.', 'I explained the problem to him.', 'Explain needs to before the person: explain something to someone.'),
  e('e19', 'a2-town', 'We discussed about the plan.', 'We discussed the plan.', 'Discuss takes no about. You discuss a thing, or talk about it.'),
  e('e20', 'a2-town', 'She married with a doctor.', 'She married a doctor.', 'Marry takes no with. Compare got married to a doctor.'),
  b('b9', 'a2-town', 'I have already finished my homework.', 'Already sits between have and the past participle.'),
  b('b10', 'a2-town', 'She is taller than her brother.', 'Than follows the comparative form.'),

  /* --------------------------- A2 · People and feelings ------------------ */
  w('w51', 'a2-people', 'polite', 'showing good manners', 'He was very polite to the waiter.', ['rude to strangers', 'extremely funny', 'rather shy']),
  w('w52', 'a2-people', 'shy', 'nervous with new people', 'She was too shy to ask a question.', ['confident with everyone', 'quick to get angry', 'always talking']),
  w('w53', 'a2-people', 'generous', 'happy to give', 'My uncle is generous with his time.', ['unwilling to share', 'very careful with money', 'quick to complain']),
  w('w54', 'a2-people', 'annoyed', 'slightly angry', 'I was annoyed that nobody told me.', ['extremely pleased', 'deeply sad', 'completely calm']),
  w('w55', 'a2-people', 'proud', 'pleased about something you did', 'Her parents were proud of her results.', ['ashamed', 'entirely uninterested', 'taken by surprise']),
  w('w56', 'a2-people', 'lonely', 'unhappy because you are alone', 'He felt lonely in the new city.', ['glad of the peace', 'surrounded by friends', 'busy all day']),
  w('w57', 'a2-people', 'reliable', 'able to be trusted to do what is needed', 'She is the most reliable person on the team.', ['frequently late', 'hard to find', 'full of ideas']),
  w('w58', 'a2-people', 'stubborn', 'refusing to change your mind', 'My brother is too stubborn to apologise.', ['easily persuaded', 'always agreeing', 'quick to forget']),
  w('w59', 'a2-people', 'confident', 'sure of yourself', 'He sounded confident in the interview.', ['full of doubt', 'barely audible', 'badly prepared']),
  w('w60', 'a2-people', 'patient', 'able to wait calmly', 'Teachers need to be patient.', ['easily irritated', 'always in a hurry', 'extremely strict']),
  e('e21', 'a2-people', 'I am interested about history.', 'I am interested in history.', 'Interested takes in. Only the thing itself is interesting.'),
  e('e22', 'a2-people', 'He made me to laugh.', 'He made me laugh.', 'Make and let are followed by the base verb, with no to.'),
  b('b11', 'a2-people', 'She told me not to worry.', 'A negative instruction puts not before to.'),

  /* ------------------- B1 · Prepositions that trip everyone -------------- */
  w('w61', 'b1-prep', 'until', 'up to a certain time', 'The shop stays open until nine.', ['starting from a time', 'at no fixed time', 'for a whole day']),
  w('w62', 'b1-prep', 'during', 'through the whole of a period', 'He fell asleep during the film.', ['before it began', 'after it ended', 'instead of it']),
  w('w63', 'b1-prep', 'within', 'before the end of a period', 'You will hear from us within a week.', ['after a week has passed', 'every week', 'for a full week']),
  w('w64', 'b1-prep', 'throughout', 'during the whole of', 'It rained throughout the night.', ['at the start of', 'towards the end of', 'once in the night']),
  w('w65', 'b1-prep', 'towards', 'in the direction of', 'He walked towards the station.', ['away from', 'right past', 'all the way around']),
  w('w66', 'b1-prep', 'alongside', 'next to, and together with', 'She works alongside two other designers.', ['far away from', 'instead of', 'in charge of']),
  w('w67', 'b1-prep', 'beneath', 'under', 'The keys were beneath the newspaper.', ['on top of', 'beside', 'behind']),
  w('w68', 'b1-prep', 'apart from', 'except for', 'Apart from Ravi, everyone agreed.', ['including', 'because of', 'in addition to everyone']),
  e('e23', 'b1-prep', 'I have lived here since five years.', 'I have lived here for five years.', 'For measures a length of time; since marks the moment it started. Since 2019, but for five years.'),
  e('e24', 'b1-prep', 'In Monday we have a meeting.', 'On Monday we have a meeting.', 'On for days, in for months and years, at for clock times.'),
  e('e25', 'b1-prep', 'It depends of the weather.', 'It depends on the weather.', 'Depend always takes on, with no exceptions: it depends on the weather, on you, on the result.'),
  e('e26', 'b1-prep', 'Despite of the rain, we walked home.', 'Despite the rain, we walked home.', 'Despite takes no of. It is in spite of that needs one.'),
  e('e27', 'b1-prep', 'I look forward to hear from you.', 'I look forward to hearing from you.', 'Here to is a preposition, not part of the infinitive, so the verb takes -ing.'),
  e('e28', 'b1-prep', 'I will call you when I will arrive.', 'I will call you when I arrive.', 'After when, use the present even though you mean the future.'),
  b('b12', 'b1-prep', 'I have been learning English for three years.', 'For plus a length of time, with the present perfect continuous for something still going on.'),
  b('b13', 'b1-prep', 'If it rains, we will stay at home.', 'The if half stays in the present even though the sentence is about the future.'),

  /* ----------------------------- B1 · Phrasal verbs ---------------------- */
  w('w69', 'b1-phrasal', 'give up', 'to stop trying', 'Do not give up so easily.', ['to begin something new', 'to keep going', 'to ask for help']),
  w('w70', 'b1-phrasal', 'look after', 'to take care of', 'Can you look after the baby for an hour?', ['to search for', 'to stare at', 'to copy closely']),
  w('w71', 'b1-phrasal', 'put off', 'to delay', 'They put off the meeting until Tuesday.', ['to bring forward', 'to cancel for good', 'to agree to']),
  w('w72', 'b1-phrasal', 'turn down', 'to refuse', 'It would be rude to turn down the offer.', ['to accept eagerly', 'to think it over', 'to ask for more']),
  w('w73', 'b1-phrasal', 'run out of', 'to have no more of', 'We have run out of milk.', ['to buy more of', 'to have plenty of', 'to give away']),
  w('w74', 'b1-phrasal', 'bring up', 'to mention a subject', 'Do not bring up money at dinner.', ['to forget a topic', 'to change the subject', 'to write down']),
  w('w75', 'b1-phrasal', 'take over', 'to take control of', 'A larger firm may take over the company.', ['to hand control to someone', 'to shut down', 'to move abroad']),
  w('w76', 'b1-phrasal', 'sort out', 'to solve or organise', 'I will sort out the tickets.', ['to make worse', 'to ignore', 'to pay for']),
  w('w77', 'b1-phrasal', 'carry on', 'to continue', 'Carry on until the end of the road.', ['to stop at once', 'to turn back', 'to slow down']),
  w('w78', 'b1-phrasal', 'work out', 'to calculate or figure out', 'I cannot work out the total.', ['to write down neatly', 'to forget entirely', 'to guess at random']),
  w('w79', 'b1-phrasal', 'come across', 'to find by chance', 'You sometimes come across an old photo you had forgotten.', ['to search for carefully', 'to lose something', 'to throw away']),
  w('w80', 'b1-phrasal', 'get on with', 'to have a good relationship with', 'I get on with my neighbours.', ['to argue constantly with', 'to avoid completely', 'to work for']),
  e('e29', 'b1-phrasal', 'She suggested me to go early.', 'She suggested that I go early.', 'Suggest does not take an object plus to. Use suggest that, or suggest going.'),
  e('e30', 'b1-phrasal', 'This is the more expensive one of the three.', 'This is the most expensive one of the three.', 'Two things take the comparative; three or more take the superlative.'),
  b('b14', 'b1-phrasal', 'He asked me what I wanted.', 'A reported question drops the question word order: what I wanted, not what did I want.'),
  b('b15', 'b1-phrasal', 'I would rather stay at home tonight.', 'Would rather is followed by the base verb, with no to.'),

  /* ------------------------ B1 · Words that get mixed up ----------------- */
  w('w81', 'b1-confuse', 'lend', 'to give something for a time', 'Can you lend me your charger?', ['to take something for a time', 'to give away for good', 'to sell cheaply']),
  w('w82', 'b1-confuse', 'borrow', 'to take something for a time', 'Can I borrow your charger?', ['to give something for a time', 'to buy outright', 'to keep forever']),
  w('w83', 'b1-confuse', 'advice', 'an opinion about what someone should do', 'She gave me some useful advice.', ['a formal written warning', 'a piece of equipment', 'a set of rules']),
  w('w84', 'b1-confuse', 'affect', 'to change or influence something', 'The rain did not affect the match.', ['a result of something', 'to complete something', 'to postpone something']),
  w('w85', 'b1-confuse', 'effect', 'a result', 'The medicine had no effect.', ['to influence something', 'a cause', 'a plan']),
  w('w86', 'b1-confuse', 'fewer', 'used with things you can count', 'There were fewer people than last year.', ['used with amounts you cannot count', 'used only with time', 'used only after the']),
  w('w87', 'b1-confuse', 'remind', 'to make someone remember', 'Please remind me to call the bank.', ['to recall something yourself', 'to forget on purpose', 'to repeat aloud']),
  w('w88', 'b1-confuse', 'raise', 'to lift or increase something', 'They raise the flag at eight.', ['to get up from bed', 'to fall steadily', 'to stay level']),
  e('e31', 'b1-confuse', 'Can you borrow me your pen?', 'Can you lend me your pen?', 'You lend to someone and borrow from someone. The owner lends.'),
  e('e32', 'b1-confuse', 'She gave me a good advice.', 'She gave me some good advice.', 'Advice is uncountable: some advice, or a piece of advice.'),
  e('e33', 'b1-confuse', 'The medicine did not effect him.', 'The medicine did not affect him.', 'Affect is the verb, effect the noun. The medicine affects you; it has an effect.'),
  e('e34', 'b1-confuse', 'There were less cars on the road.', 'There were fewer cars on the road.', 'Fewer counts separate things; less measures an amount. Fewer cars, less traffic.'),

  /* ------------------------ B2 · Tenses that nearly work ----------------- */
  w('w89', 'b2-tense', 'hardly', 'almost not', 'I could hardly hear him.', ['with great effort', 'very loudly', 'without difficulty']),
  w('w90', 'b2-tense', 'barely', 'only just', 'We barely made it in time.', ['comfortably', 'a good while early', 'not at all']),
  w('w91', 'b2-tense', 'eventually', 'in the end, after a long time', 'Eventually they agreed.', ['immediately', 'possibly', 'never']),
  w('w92', 'b2-tense', 'meanwhile', 'at the same time', 'Meanwhile, the guests were waiting.', ['long afterwards', 'well before', 'instead']),
  w('w93', 'b2-tense', 'apparently', 'so it seems, from what people say', 'Apparently the office is closed tomorrow.', ['certainly', 'obviously untrue', 'in my own view']),
  w('w94', 'b2-tense', 'bound to', 'certain to', 'He is bound to be late.', ['unlikely to', 'permitted to', 'obliged to travel']),
  w('w95', 'b2-tense', 'due to', 'because of', 'The delay was due to heavy traffic.', ['in spite of', 'in addition to', 'instead of']),
  w('w96', 'b2-tense', 'otherwise', 'if not', 'Leave now, otherwise you will miss it.', ['as a result', 'in the same way', 'for example']),
  e('e35', 'b2-tense', 'If I would have known, I would have come.', 'If I had known, I would have come.', 'The if half takes had plus the participle. Would have belongs only in the other half.'),
  e('e36', 'b2-tense', 'I wish I would have more time.', 'I wish I had more time.', 'A wish about now takes the past simple: I wish I had, I wish I knew.'),
  e('e37', 'b2-tense', 'He asked me where did I live.', 'He asked me where I lived.', 'A reported question is not a question any more, so it keeps normal word order.'),
  e('e38', 'b2-tense', 'The informations are very useful.', 'The information is very useful.', 'Information is uncountable and has no plural. Use pieces of information if you must count.'),
  e('e39', 'b2-tense', 'I am used to work late.', 'I am used to working late.', 'Be used to means accustomed to, and to here is a preposition, so the verb takes -ing.'),
  e('e40', 'b2-tense', 'She has been working here since three years ago.', 'She has been working here for three years.', 'Ago belongs with the past simple. With the perfect, use for plus a length.'),
  b('b16', 'b2-tense', 'By the time we arrived, the meeting had ended.', 'The earlier of two past events takes had plus the participle.'),
  b('b17', 'b2-tense', 'The report needs to be sent by Friday.', 'A passive with need takes to be plus the past participle.'),

  /* ------------------------ B2 · Sounding natural at work ---------------- */
  w('w97', 'b2-natural', 'deadline', 'the time by which something must be finished', 'The deadline is Friday at noon.', ['the start of a project', 'a short meeting', 'a list of tasks']),
  w('w98', 'b2-natural', 'draft', 'an early version', 'I sent a first draft of the report.', ['the final approved version', 'a one-line summary', 'a list of corrections']),
  w('w99', 'b2-natural', 'feedback', 'comments on how well something was done', 'Thanks for the feedback on my slides.', ['a formal complaint', 'a reply to an invitation', 'a set of instructions']),
  w('w100', 'b2-natural', 'postpone', 'to move to a later time', 'They want to postpone the launch.', ['to bring forward', 'to cancel outright', 'to shorten']),
  w('w101', 'b2-natural', 'clarify', 'to make clearer', 'Could you clarify the second point?', ['to confuse further', 'to repeat word for word', 'to cut short']),
  w('w102', 'b2-natural', 'thorough', 'complete and careful', 'She did a thorough check.', ['quick and rough', 'only half finished', 'careless']),
  w('w103', 'b2-natural', 'approve', 'to agree to officially', 'The manager still has to approve the budget.', ['to turn down', 'to look over', 'to draw up']),
  w('w104', 'b2-natural', 'attend', 'to go to an event', 'I will attend the meeting remotely.', ['to organise an event', 'to miss an event', 'to record an event']),
  e('e41', 'b2-natural', 'I would appreciate if you could send it today.', 'I would appreciate it if you could send it today.', 'Appreciate needs an object. The missing word is it.'),
  e('e42', 'b2-natural', 'Please revert back to me by Friday.', 'Please reply to me by Friday.', 'Revert means to return to a former state. It does not mean reply, and back is redundant either way.'),
  e('e43', 'b2-natural', 'Kindly do the needful and update me.', 'Please do what is needed and update me.', 'Do the needful is dated office English and unclear to most readers today.'),
  e('e44', 'b2-natural', 'I am having three years of experience.', 'I have three years of experience.', 'Have for a state, not having. The continuous is for actions in progress.'),
  b('b18', 'b2-natural', 'I would be grateful if you could confirm the details.', 'Would be grateful if you could is the standard polite request in writing.'),
  b('b19', 'b2-natural', 'Please find attached the revised document.', 'A fixed formal phrase: attached comes before the thing attached.'),

  /* -------------------------- C1 · Register and nuance ------------------- */
  w('w105', 'c1-register', 'concise', 'short and clear', 'Keep the summary concise.', ['long and detailed', 'vague', 'repetitive']),
  w('w106', 'c1-register', 'ambiguous', 'having more than one possible meaning', 'The wording is ambiguous.', ['perfectly clear', 'plainly false', 'highly formal']),
  w('w107', 'c1-register', 'tentative', 'not certain, provisional', 'We have a tentative date in June.', ['final and fixed', 'already past', 'formally approved']),
  w('w108', 'c1-register', 'albeit', 'although', 'It was a good result, albeit a slow one.', ['because of this', 'in addition', 'for instance']),
  w('w109', 'c1-register', 'nevertheless', 'in spite of that', 'It was raining; nevertheless, they played.', ['for that reason', 'at the same time', 'in other words']),
  w('w110', 'c1-register', 'compelling', 'very convincing', 'She made a compelling argument.', ['weak', 'confusing', 'obvious to everyone']),
  w('w111', 'c1-register', 'nuance', 'a small difference in meaning', 'The translation loses the nuance.', ['the main point', 'a grammatical error', 'a short summary']),
  w('w112', 'c1-register', 'pragmatic', 'practical rather than ideal', 'They took a pragmatic approach.', ['idealistic', 'careless', 'purely theoretical']),
  w('w113', 'c1-register', 'scrutiny', 'careful examination', 'The plan came under scrutiny.', ['quick approval', 'public praise', 'private discussion']),
  w('w114', 'c1-register', 'warrant', 'to justify or deserve', 'The error does not warrant a full rewrite.', ['to forbid', 'to guarantee payment', 'to postpone']),
  e('e45', 'c1-register', 'The report is comprising of three sections.', 'The report comprises three sections.', 'Comprise takes no of and no continuous. It is consist that needs of.'),
  e('e46', 'c1-register', 'The reason is because the supplier was late.', 'The reason is that the supplier was late.', 'Reason and because say the same thing twice.'),
  e('e47', 'c1-register', 'This approach is different than the last one.', 'This approach is different from the last one.', 'Different from is standard in formal writing.'),
  e('e48', 'c1-register', 'I could care less about the result.', 'I could not care less about the result.', 'Without not, the sentence says you do care, which is the opposite of what is meant.'),
  e('e49', 'c1-register', 'Between you and I, the plan is weak.', 'Between you and me, the plan is weak.', 'After a preposition such as between, use me.'),
  e('e50', 'c1-register', 'The team literally exploded with laughter.', 'The team nearly exploded with laughter.', 'Literally means it actually happened. Here, mercifully, it did not.'),
  b('b20', 'c1-register', 'Had I known, I would have said something.', 'Inverting had replaces if in formal writing.'),
  b('b21', 'c1-register', 'Seldom have I seen such a mess.', 'A negative adverb at the front forces the subject and verb to swap.'),
  b('b22', 'c1-register', 'What matters most is the reasoning behind it.', 'Starting with what turns a whole clause into the subject.'),
  b('b23', 'c1-register', 'I am writing to enquire about the position advertised.', 'A formal letter states its purpose in the opening line.'),
  b('b24', 'c1-register', 'Overall, the data suggests a steady decline.', 'Overall introduces a summary of a trend, which is how exam reports open.'),
];

export const UNIT_ITEMS = (unitId: string): Item[] => ITEMS.filter((item) => item.unit === unitId);

/** Every single word in a unit, used to build tempting wrong answers for gaps. */
export const wordPool = (unitId: string): string[] =>
  ITEMS.filter((item): item is WordItem => item.kind === 'word' && item.unit === unitId).map((item) => item.word);
