/**
 * PLAY's briefs.
 *
 * A hand-written deck first, because the best prompts are specific and a little
 * absurd in a way templates rarely manage. Behind it, a generator that combines
 * a thing to make, someone to make it for and a constraint, so filtering to a
 * narrow corner never runs dry. A shuffle bag keeps the recent ones from coming
 * straight back.
 */

import type { Rng } from './random';
import type { ToolId } from './storage';

export type Category = 'design' | 'drawing' | 'typography' | 'branding' | 'product' | 'photography' | 'writing' | 'weird';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'typography', label: 'Typography' },
  { id: 'branding', label: 'Branding' },
  { id: 'product', label: 'Product' },
  { id: 'photography', label: 'Photography' },
  { id: 'writing', label: 'Writing' },
  { id: 'weird', label: 'Weird' },
];

export type Minutes = 5 | 10 | 30;
export const DURATIONS: Minutes[] = [5, 10, 30];

export interface Challenge {
  text: string;
  categories: Category[];
  minutes: Minutes;
}

const c = (text: string, minutes: Minutes, ...categories: Category[]): Challenge => ({ text, minutes, categories });

export const DECK: Challenge[] = [
  // From the brief.
  c('Design a poster for a festival on Mars.', 30, 'design'),
  c('Design a banking app for aliens.', 30, 'product', 'weird'),
  c('Create a logo using only three circles.', 10, 'branding'),
  c('Design packaging for invisible water.', 30, 'product', 'weird'),
  c('Create a movie poster without using images.', 30, 'design', 'typography'),
  c('Design a chair for someone who hates chairs.', 30, 'product', 'weird'),
  c('Create a typeface inspired by traffic.', 30, 'typography'),
  c('Design a menu for a restaurant on the Moon.', 30, 'design', 'writing'),
  c('Create an app icon using one letter.', 10, 'branding', 'typography'),
  c('Design a website for a civilization underwater.', 30, 'product', 'weird'),
  c('Create a brand for a fictional planet.', 30, 'branding', 'weird'),
  c('Create packaging for a product that doesn’t exist.', 10, 'product', 'design'),

  // Design.
  c('Design a gig poster using only two colours and one shape.', 10, 'design'),
  c('Make a poster for a lost umbrella.', 10, 'design', 'writing'),
  c('Design a “Do not disturb” sign for a lighthouse keeper.', 10, 'design'),
  c('Design a ticket for a train that only runs at midnight.', 10, 'design'),
  c('Make a poster that looks loud, using no capital letters.', 10, 'design', 'typography'),
  c('Design a book cover for a novel called “Almost Tuesday”.', 30, 'design', 'typography'),
  c('Design a birthday card for a volcano.', 10, 'design', 'weird'),
  c('Make a warning sign for something that is only mildly dangerous.', 5, 'design', 'writing'),
  c('Design a stamp celebrating the humble paperclip.', 10, 'design'),
  c('Make a poster using a grid of exactly nine squares.', 10, 'design'),
  c('Design an album cover for silence.', 10, 'design', 'weird'),
  c('Make a flyer for a neighbourhood lost-sock exchange.', 10, 'design', 'writing'),
  c('Design a postcard from a city that doesn’t exist yet.', 30, 'design'),
  c('Make a calendar page for a month with 40 days.', 30, 'design', 'weird'),
  c('Design the cover of a manual for being a cloud.', 10, 'design', 'weird'),

  // Drawing.
  c('Draw a self-portrait using only rectangles.', 5, 'drawing'),
  c('Draw your breakfast as if it were a mountain range.', 10, 'drawing'),
  c('Draw a city skyline with a single continuous line.', 5, 'drawing'),
  c('Draw a snowflake with radial symmetry and one mistake on purpose.', 5, 'drawing'),
  c('Draw a creature that lives in a keyboard.', 10, 'drawing', 'weird'),
  c('Draw the sound of rain.', 5, 'drawing', 'weird'),
  c('Draw a map of your morning.', 10, 'drawing'),
  c('Draw a houseplant with opinions.', 5, 'drawing', 'weird'),
  c('Draw a vehicle powered by naps.', 10, 'drawing', 'weird', 'product'),
  c('Draw a pattern you would wear to a job interview.', 10, 'drawing', 'design'),
  c('Draw ten faces using only circles and lines.', 10, 'drawing'),
  c('Draw a monster that is afraid of you.', 5, 'drawing'),
  c('Draw the view from inside a teapot.', 10, 'drawing', 'weird'),
  c('Draw a kaleidoscope using radial symmetry with twelve segments.', 5, 'drawing'),
  c('Draw a building shaped like its purpose.', 30, 'drawing', 'design'),

  // Typography.
  c('Set the word “HEAVY” so it looks light.', 5, 'typography'),
  c('Set the word “quiet” as loudly as you can.', 5, 'typography'),
  c('Make a poster using one word and no other element.', 5, 'typography'),
  c('Set a haiku as a poster with no two lines in the same size.', 10, 'typography', 'writing'),
  c('Design a letter A that could be a building.', 10, 'typography', 'drawing'),
  c('Set your name as if it were a very expensive perfume.', 5, 'typography', 'branding'),
  c('Make the word “stretch” look stretched without distorting it.', 5, 'typography'),
  c('Set a shopping list as a dramatic film title sequence.', 10, 'typography', 'weird'),
  c('Create a poster where the letter spacing tells the story.', 10, 'typography'),
  c('Design a number 7 that feels lucky.', 5, 'typography'),
  c('Set “SALE” in a way that makes nobody want to buy anything.', 5, 'typography', 'weird'),
  c('Make a typographic poster for the smell of coffee.', 10, 'typography'),
  c('Set the alphabet so that one letter is clearly the favourite.', 10, 'typography'),

  // Branding.
  c('Brand a bakery that only sells one very good bun.', 30, 'branding'),
  c('Create a logo for a detective agency run by cats.', 10, 'branding', 'weird'),
  c('Name and brand a colour that doesn’t exist.', 10, 'branding', 'writing', 'weird'),
  c('Design a mascot for Mondays that people might actually like.', 10, 'branding', 'drawing'),
  c('Create a logo using only the negative space of a square.', 10, 'branding'),
  c('Brand a gym for fingers.', 10, 'branding', 'weird'),
  c('Design a logo for a library that lends out thunderstorms.', 10, 'branding', 'weird'),
  c('Create a brand for a very small airline with one very small plane.', 30, 'branding'),
  c('Make a monogram from your initials that fits inside a coin.', 5, 'branding', 'typography'),
  c('Brand a coffee shop for people who hate talking.', 30, 'branding', 'writing'),
  c('Create a flag for your street.', 10, 'branding', 'design'),
  c('Design a logo that works upside down.', 10, 'branding'),

  // Product.
  c('Design an alarm clock that’s kind to you.', 10, 'product'),
  c('Design the settings screen for a haunted house.', 10, 'product', 'weird'),
  c('Sketch an app that helps plants make friends.', 10, 'product', 'weird'),
  c('Design a remote control with only three buttons.', 10, 'product'),
  c('Design an umbrella for two people who don’t like each other.', 10, 'product', 'weird'),
  c('Design a weather app for someone who lives inside.', 10, 'product'),
  c('Design a mug for someone who always forgets their tea.', 5, 'product'),
  c('Design the error screen for when the internet runs out of internet.', 10, 'product', 'writing', 'weird'),
  c('Design a lunchbox for a robot.', 10, 'product', 'drawing'),
  c('Design a door handle that tells you who is outside.', 10, 'product'),
  c('Design a map for walking your dog through your own flat.', 10, 'product', 'drawing'),

  // Photography — made with the tools here, or with a phone.
  c('Photograph five things that are the same colour as your palette.', 10, 'photography'),
  c('Take a photo that looks like a pattern, then rebuild it in SHAPE.', 30, 'photography', 'design'),
  c('Photograph a shadow that looks like a letter.', 10, 'photography', 'typography'),
  c('Find a face in an everyday object and photograph it.', 5, 'photography', 'weird'),
  c('Photograph something ordinary so it looks like a luxury product.', 10, 'photography', 'product'),
  c('Photograph three circles you didn’t put there.', 5, 'photography'),
  c('Make a colour palette from the view out of your window.', 5, 'photography', 'design'),
  c('Photograph your desk as if it were a landscape.', 5, 'photography'),

  // Writing.
  c('Write the tagline for a sandwich that changed history.', 5, 'writing'),
  c('Write the instructions on a packet of clouds.', 5, 'writing', 'weird'),
  c('Write a six-word review of your chair.', 5, 'writing'),
  c('Write the out-of-office reply for a volcano.', 5, 'writing', 'weird'),
  c('Write a museum label for a used teabag.', 5, 'writing'),
  c('Write the terms and conditions for a hug.', 10, 'writing', 'weird'),
  c('Write a slogan for gravity.', 5, 'writing', 'branding'),
  c('Write a lost-and-found notice for a missing weekend.', 5, 'writing'),
  c('Write a menu description that makes toast sound unforgettable.', 5, 'writing'),
  c('Write the first line of a novel set inside a vending machine.', 5, 'writing', 'weird'),

  // Weird.
  c('Design a trophy for coming second.', 10, 'weird', 'product'),
  c('Design a passport for a houseplant.', 10, 'weird', 'design'),
  c('Create a road sign for ghosts.', 5, 'weird', 'design'),
  c('Design a uniform for a team of snails.', 10, 'weird', 'drawing'),
  c('Design currency for a country run by children.', 30, 'weird', 'design'),
  c('Make a wanted poster for the person who ate the last biscuit.', 10, 'weird', 'design', 'writing'),
  c('Design a tarot card for the internet.', 10, 'weird', 'drawing'),
  c('Design a greeting card for a robot’s first day of feelings.', 10, 'weird', 'design'),
  c('Design a festival poster for the quietest band in the world.', 10, 'weird', 'design', 'typography'),
  c('Design a medal for surviving a meeting that could have been an email.', 5, 'weird', 'design'),
];

/* ---------------------------- the generator ---------------------------- */

const THINGS: [string, Category[]][] = [
  ['a poster', ['design']], ['a logo', ['branding']], ['packaging', ['product', 'design']], ['an app icon', ['branding', 'product']],
  ['a book cover', ['design', 'typography']], ['a menu', ['design', 'writing']], ['a ticket', ['design']], ['a sign', ['design']],
  ['a mascot', ['branding', 'drawing']], ['a stamp', ['design']], ['a label', ['product', 'writing']], ['a flag', ['branding']],
  ['a record sleeve', ['design']], ['a greeting card', ['design', 'writing']], ['a badge', ['branding']], ['a wordmark', ['typography', 'branding']],
];
const FOR = [
  'a museum of lost socks', 'a very polite robot', 'a bakery run by owls', 'a festival on a glacier', 'a library that never closes',
  'a band of retired astronauts', 'a shop that only sells left shoes', 'a café at the bottom of the sea', 'a gym for tired people',
  'a cinema that only shows sunsets', 'a hotel for migrating birds', 'a dentist for dragons', 'a radio station for plants',
  'a marathon for snails', 'a detective who is afraid of the dark', 'a city with no straight roads', 'a school for clouds',
  'a museum of everyday noises', 'a bus company on the Moon', 'a florist who only sells cactuses',
];
const WITH = [
  'using only two colours', 'using only circles', 'with no straight lines', 'using a single typeface', 'in black and white',
  'with the word “maybe” somewhere in it', 'using only shapes from your palette', 'in five words or fewer', 'with lots of empty space',
  'so that it still works at the size of a stamp', 'using one huge letter', 'without using the colour blue', 'upside down',
  'using radial symmetry', 'with everything aligned to the right',
];

export function generateChallenge(rng: Rng, categories: readonly Category[], minutes: Minutes | null): Challenge {
  const pool = categories.length ? THINGS.filter(([, cats]) => cats.some((k) => categories.includes(k))) : THINGS;
  const [thing, cats] = rng.pick(pool.length ? pool : THINGS);
  const mins = minutes ?? rng.pick(DURATIONS);
  const extra: Category[] = categories.filter((k) => !cats.includes(k)).slice(0, 1);
  const verb = thing.startsWith('a mascot') ? 'Draw' : 'Design';
  return {
    text: `${verb} ${thing} for ${rng.pick(FOR)}, ${rng.pick(WITH)}.`,
    minutes: mins,
    categories: [...cats, ...extra.filter((k) => k === 'weird')],
  };
}

/**
 * The next brief: from the deck when something there matches and hasn't been
 * seen lately, otherwise invented. `recent` is the texts already shown.
 */
export function nextChallenge(rng: Rng, categories: readonly Category[], minutes: Minutes | null, recent: readonly string[]): Challenge {
  const matches = DECK.filter((ch) =>
    (!categories.length || ch.categories.some((k) => categories.includes(k))) && (minutes === null || ch.minutes === minutes));
  const fresh = matches.filter((ch) => !recent.includes(ch.text));
  // Mostly the deck; now and then an invented one, so it never feels finite.
  if (fresh.length && rng.chance(0.82)) return rng.pick(fresh);
  for (let tries = 0; tries < 8; tries += 1) {
    const made = generateChallenge(rng, categories, minutes);
    if (!recent.includes(made.text)) return made;
  }
  return fresh.length ? rng.pick(fresh) : generateChallenge(rng, categories, minutes);
}

/** Where to make it. */
export function toolFor(challenge: Pick<Challenge, 'categories' | 'text'>): ToolId {
  const cats = challenge.categories;
  // Whole words only: "shaped" is not a request for SHAPE.
  if (/\bpatterns?\b/i.test(challenge.text) || /\bSHAPE\b/.test(challenge.text)) return 'shape';
  if (/palette|colour/i.test(challenge.text) && cats.includes('photography')) return 'color';
  if (cats.includes('drawing') || /^Draw/.test(challenge.text)) return 'draw';
  if (cats.includes('typography') && !cats.includes('branding')) return 'type';
  if (cats.includes('writing') && cats.length === 1) return 'type';
  return 'make';
}

export const TOOL_NAME: Record<ToolId, string> = { color: 'COLOR', type: 'TYPE', shape: 'SHAPE', draw: 'DRAW', make: 'MAKE', play: 'PLAY' };

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
