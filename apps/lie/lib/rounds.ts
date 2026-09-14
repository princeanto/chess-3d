/**
 * The deck.
 *
 * Three true statements and one invention per round, all four on one theme so
 * the fake cannot be found by spotting the odd topic out. Every true statement
 * is picked for being hard to believe — a round of ordinary facts with one
 * whopper in it is a spelling test, not a game — and every invention is either
 * an inversion of something real or a myth people already half-believe.
 *
 *  indexes the invented statement.  is shown on the reveal and says
 * what is actually the case, so a wrong answer still teaches you something.
 */

export interface Round {
  /** Theme, which also selects the photograph. */
  t: string;
  /** Four statements, in their authored order; the game shuffles them. */
  s: string[];
  fake: number;
  why: string;
}

export const ROUNDS: Round[] = [
  {
    "t": "Animals",
    "s": [
      "Octopuses have three hearts and blue blood",
      "A shrimp's heart is in its head",
      "Wombats produce cube-shaped droppings",
      "Jellyfish have a single large eye at the centre of the bell"
    ],
    "fake": 3,
    "why": "Box jellyfish have twenty-four eyes in four clusters — and no brain to assemble what they see into one picture."
  },
  {
    "t": "Animals",
    "s": [
      "Sloths can hold their breath longer than dolphins can",
      "Elephants cannot jump",
      "Koala fingerprints are almost indistinguishable from human ones",
      "A giraffe's tongue is blue because it has no blood vessels"
    ],
    "fake": 3,
    "why": "The tongue really is dark blue-purple, but from melanin, which stops it burning in the sun while it feeds. It has plenty of blood vessels."
  },
  {
    "t": "Animals",
    "s": [
      "Tardigrades have survived being exposed to the vacuum of space",
      "A mantis shrimp punches so fast the water around its claw briefly boils",
      "Horseshoe crabs have blue blood, used to test medicines for contamination",
      "Lobsters scream when they are dropped into boiling water"
    ],
    "fake": 3,
    "why": "Lobsters have no vocal cords. The noise is steam forcing its way out of the shell."
  },
  {
    "t": "Animals",
    "s": [
      "Crows recognise individual human faces and hold grudges for years",
      "Honeybees can be trained to tell one human face from another",
      "Butterflies taste with their feet",
      "Ants never sleep"
    ],
    "fake": 3,
    "why": "Fire ant workers take around 250 naps a day, roughly a minute each."
  },
  {
    "t": "Animals",
    "s": [
      "Sea otters hold hands while sleeping so they do not drift apart",
      "Flamingos hatch grey and turn pink from what they eat",
      "A group of flamingos is called a flamboyance",
      "Female seahorses give birth after the male carries the eggs"
    ],
    "fake": 3,
    "why": "The female puts the eggs into the male's pouch, and it is the male that gives birth."
  },
  {
    "t": "Animals",
    "s": [
      "Axolotls can regrow limbs, jaws and parts of their brain",
      "Platypuses glow blue-green under ultraviolet light",
      "Platypuses sweat milk instead of feeding through nipples",
      "Bats are blind and navigate entirely by echolocation"
    ],
    "fake": 3,
    "why": "Every bat species can see, and many see well in low light. Echolocation is an addition, not a replacement."
  },
  {
    "t": "Animals",
    "s": [
      "Sharks were swimming the oceans before the first trees grew",
      "A narwhal's tusk is really an overgrown tooth",
      "A snail can have thousands of teeth on its tongue",
      "A goldfish has a memory of about three seconds"
    ],
    "fake": 3,
    "why": "Goldfish remember things for months and can be trained to push levers for food."
  },
  {
    "t": "Animals",
    "s": [
      "Cows have best friends and get stressed when separated from them",
      "Goats have rectangular pupils",
      "Chickens can tell apart more than a hundred different faces",
      "Pigs physically cannot look up at the sky"
    ],
    "fake": 3,
    "why": "Pigs can look up. Their neck muscles make it awkward, not impossible."
  },
  {
    "t": "Animals",
    "s": [
      "Hummingbirds are the only birds that can fly backwards",
      "A hummingbird's heart can beat more than 1,200 times a minute",
      "The smallest hummingbird weighs less than a penny",
      "A hummingbird must eat every ten minutes or it dies within the hour"
    ],
    "fake": 3,
    "why": "They get through the night by dropping into torpor, slowing heart and body temperature almost to a stop."
  },
  {
    "t": "Animals",
    "s": [
      "Dolphins have names for each other, in the form of signature whistles",
      "The orca is the largest member of the dolphin family",
      "The closest living land relative of the whale is the hippopotamus",
      "A blue whale's arteries are wide enough for a person to swim through"
    ],
    "fake": 3,
    "why": "A blue whale's aorta is about the width of a dinner plate. Enormous, but nobody is swimming down it."
  },
  {
    "t": "Animals",
    "s": [
      "Cats cannot taste sweetness",
      "A cat's nose print is as individual as a human fingerprint",
      "Cats sleep for around two thirds of their lives",
      "Cats purr only when they are content"
    ],
    "fake": 3,
    "why": "Cats also purr when injured, frightened or giving birth. The vibration may help them heal."
  },
  {
    "t": "Animals",
    "s": [
      "Reindeer eyes turn from gold in summer to blue in winter",
      "Polar bears have black skin under their white fur",
      "Arctic ground squirrels let their body temperature drop below freezing",
      "Polar bear meat is poisonous but the liver is safe to eat"
    ],
    "fake": 3,
    "why": "It is the other way round. Polar bear liver holds enough vitamin A to make a person seriously ill."
  },
  {
    "t": "Space",
    "s": [
      "A day on Venus lasts longer than a year on Venus",
      "Venus is hotter than Mercury even though it is further from the Sun",
      "Venus spins the opposite way to almost every other planet",
      "Venus is the only planet named after a male god"
    ],
    "fake": 3,
    "why": "Venus is the only planet named after a goddess. All the others carry male Roman names."
  },
  {
    "t": "Space",
    "s": [
      "There are more trees on Earth than stars in the Milky Way",
      "The Moon moves about 3.8 cm further away from us every year",
      "Helium was found on the Sun before anyone found it on Earth",
      "The Great Wall of China is the only human structure visible from the Moon"
    ],
    "fake": 3,
    "why": "Nothing built by people can be seen from the Moon. The wall is hard to pick out even from low orbit."
  },
  {
    "t": "Space",
    "s": [
      "Saturn is light enough to float, given a big enough bath",
      "About a million Earths would fit inside the Sun",
      "A teaspoon of neutron star would weigh roughly a billion tonnes",
      "Jupiter is so large it has a small star burning at its core"
    ],
    "fake": 3,
    "why": "Jupiter would need to be around eighty times heavier before it could ignite as a star."
  },
  {
    "t": "Space",
    "s": [
      "Astronauts grow up to five centimetres taller in orbit",
      "Astronauts describe space as smelling of seared steak and welding fumes",
      "There is no sound in space because there is nothing for it to travel through",
      "A person exposed to space would freeze solid within seconds"
    ],
    "fake": 3,
    "why": "You would lose consciousness in about fifteen seconds from lack of oxygen. A vacuum carries heat away slowly."
  },
  {
    "t": "Space",
    "s": [
      "Olympus Mons on Mars is roughly three times the height of Everest",
      "Mars has seasons, and its ice caps grow and shrink with them",
      "Sunsets on Mars are blue",
      "A day on Mars is exactly as long as a day on Earth"
    ],
    "fake": 3,
    "why": "A Martian day runs about thirty-nine minutes longer, which is why mission teams on Earth slowly slip out of step with it."
  },
  {
    "t": "Space",
    "s": [
      "Sunlight takes about eight minutes to reach us",
      "The Sun accounts for more than 99% of the mass of the solar system",
      "The Sun is white; our atmosphere is what makes it look yellow",
      "The Sun is the largest star in our galaxy"
    ],
    "fake": 3,
    "why": "The Sun is an ordinary star. Some, such as UY Scuti, are more than a thousand times wider."
  },
  {
    "t": "Space",
    "s": [
      "Footprints left on the Moon could survive for millions of years",
      "The Moon has moonquakes",
      "There is water ice on the Moon, in craters the Sun never reaches",
      "The Moon always shows us the same face because it does not rotate"
    ],
    "fake": 3,
    "why": "It rotates exactly once per orbit. That is precisely why the same side always faces us."
  },
  {
    "t": "Space",
    "s": [
      "Voyager 1 carries a gold-plated record of sounds and music from Earth",
      "Voyager 1 is the most distant human-made object from Earth",
      "The Voyager probes run on less power than an electric kettle",
      "Voyager 1 has now left the Milky Way"
    ],
    "fake": 3,
    "why": "It left the Sun's bubble of particles in 2012. Leaving the galaxy would take hundreds of millions of years."
  },
  {
    "t": "Space",
    "s": [
      "Mercury has ice at its poles despite being nearest the Sun",
      "A year on Mercury is about 88 Earth days",
      "Mercury is shrinking as its core cools",
      "Mercury is the hottest planet in the solar system"
    ],
    "fake": 3,
    "why": "Venus is hotter. Its thick atmosphere traps heat; Mercury has almost none and freezes at night."
  },
  {
    "t": "History",
    "s": [
      "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid",
      "Woolly mammoths were still alive when the Great Pyramid was built",
      "Oxford was teaching students before the Aztec Empire existed",
      "Egyptian records show the pyramids were built by slaves"
    ],
    "fake": 3,
    "why": "The workers' village turned up bakeries, medical care and tombs of honour. They were paid labourers."
  },
  {
    "t": "History",
    "s": [
      "The shortest war on record lasted about 38 minutes",
      "The fax machine was invented before the telephone",
      "Harvard University is older than calculus",
      "The Hundred Years' War lasted exactly one hundred years"
    ],
    "fake": 3,
    "why": "It ran 116 years, from 1337 to 1453, with long stretches of peace in the middle."
  },
  {
    "t": "History",
    "s": [
      "Napoleon was an ordinary height for a Frenchman of his day",
      "France's last execution by guillotine happened the year Star Wars came out",
      "Nintendo was founded in 1889, making playing cards",
      "Vikings wore horned helmets into battle"
    ],
    "fake": 3,
    "why": "Not one horned helmet has ever been found in a Viking grave. The look was invented for a 19th-century opera."
  },
  {
    "t": "History",
    "s": [
      "Ketchup was sold as medicine in the 1830s",
      "7-Up once contained lithium",
      "Dr Pepper is older than Coca-Cola",
      "Coca-Cola was originally green"
    ],
    "fake": 3,
    "why": "It has always been caramel brown. The green belonged to the bottles."
  },
  {
    "t": "History",
    "s": [
      "The Eiffel Tower can stand 15 cm taller in summer than in winter",
      "The Eiffel Tower was meant to be temporary and was nearly pulled down",
      "There is a small private apartment at the top of the Eiffel Tower",
      "The Eiffel Tower is repainted every single year"
    ],
    "fake": 3,
    "why": "It is repainted roughly every seven years, by hand, using about sixty tonnes of paint."
  },
  {
    "t": "History",
    "s": [
      "Roman concrete can heal its own cracks, which is why it outlasts ours",
      "Roman gladiators ate a largely vegetarian diet",
      "Romans used urine as mouthwash",
      "Julius Caesar was the first Roman emperor"
    ],
    "fake": 3,
    "why": "Caesar was never emperor. His adopted heir Augustus was the first, after Caesar was killed."
  },
  {
    "t": "History",
    "s": [
      "The first item sold on eBay was a broken laser pointer",
      "The first webcam was set up to watch a coffee pot",
      "The computing term bug caught on after a moth was found inside a machine",
      "The first email was sent between two computers on different continents"
    ],
    "fake": 3,
    "why": "Ray Tomlinson sent it between two machines sitting next to each other in the same room."
  },
  {
    "t": "History",
    "s": [
      "Nokia began as a paper mill",
      "Samsung started out selling dried fish and groceries",
      "Wi-Fi is not short for anything",
      "Bluetooth is named after its inventor, Dr Harald Bluetooth"
    ],
    "fake": 3,
    "why": "It is named after Harald Bluetooth Gormsson, a 10th-century Danish king who united warring tribes."
  },
  {
    "t": "History",
    "s": [
      "Scotland's national animal is the unicorn",
      "The Netherlands has more bicycles than people",
      "Australia fought a war against emus and lost",
      "Switzerland is so neutral it has no army"
    ],
    "fake": 3,
    "why": "Switzerland has compulsory military service and one of the more heavily armed populations in Europe."
  },
  {
    "t": "History",
    "s": [
      "Tug of war used to be an Olympic sport",
      "An Olympic gold medal is mostly silver",
      "Painting and sculpture once won Olympic medals",
      "The marathon is 42.195 km because that was the distance from Marathon to Athens"
    ],
    "fake": 3,
    "why": "That distance was fixed at the 1908 London Games, stretched so the race could finish in front of the royal box."
  },
  {
    "t": "The body",
    "s": [
      "Babies are born with about 300 bones; adults have 206",
      "You are taller in the morning than you are at night",
      "The cornea has no blood supply at all",
      "We use only 10% of our brains"
    ],
    "fake": 3,
    "why": "Scans light up across the whole organ over the course of a day. The 10% line has no basis in anything."
  },
  {
    "t": "The body",
    "s": [
      "Your stomach lining replaces itself every few days so it does not digest itself",
      "Stomach acid is strong enough to dissolve some metals",
      "You produce enough saliva in a lifetime to fill a couple of swimming pools",
      "Swallowed chewing gum stays in your stomach for seven years"
    ],
    "fake": 3,
    "why": "It passes through in a few days, like anything else you cannot digest."
  },
  {
    "t": "The body",
    "s": [
      "Fingernails grow faster than toenails",
      "Hair and nails do not keep growing after death",
      "Your fingerprints form before you are born and never change",
      "Shaving makes hair grow back thicker and darker"
    ],
    "fake": 3,
    "why": "Shaving cuts hair at its thickest point, so the regrowth only feels coarser."
  },
  {
    "t": "The body",
    "s": [
      "Your heart beats roughly 100,000 times a day",
      "The blood vessels in one adult would stretch about 100,000 km end to end",
      "A heart can keep beating outside the body as long as it has oxygen",
      "Your heart stops for a moment every time you sneeze"
    ],
    "fake": 3,
    "why": "A sneeze briefly changes the rhythm. It has never stopped anyone's heart."
  },
  {
    "t": "The body",
    "s": [
      "You carry roughly as many bacterial cells as human ones",
      "Your gut has its own nervous system, sometimes called the second brain",
      "Most household dust is not dead skin",
      "Your body replaces its entire skeleton every seven years"
    ],
    "fake": 3,
    "why": "Bone renews gradually, around a tenth a year, and some cells — in the brain's cortex, for instance — last your whole life."
  },
  {
    "t": "The body",
    "s": [
      "You cannot hum while holding your nose closed",
      "The human eye can distinguish around ten million colours",
      "Everyone with blue eyes shares a single common ancestor",
      "Every baby is born with blue eyes"
    ],
    "fake": 3,
    "why": "Plenty of babies are born with brown eyes. The blue-at-birth idea comes mostly from European populations."
  },
  {
    "t": "Food",
    "s": [
      "Bananas are berries, and strawberries are not",
      "Peanuts are not nuts; they are legumes",
      "Cashews grow attached to the bottom of a fruit",
      "Pineapples grow on trees"
    ],
    "fake": 3,
    "why": "A pineapple grows from a low spiky plant close to the ground, one fruit at a time."
  },
  {
    "t": "Food",
    "s": [
      "Honey found in Egyptian tombs was still edible",
      "Carrots were originally purple",
      "Most wasabi served outside Japan is dyed horseradish",
      "Vanilla is the cheapest spice in the world because it grows almost everywhere"
    ],
    "fake": 3,
    "why": "Vanilla is the second most expensive spice after saffron. Every flower has to be pollinated by hand."
  },
  {
    "t": "Food",
    "s": [
      "Nutmeg is poisonous in large doses",
      "Apples float because a quarter of their volume is air",
      "Chocolate was once used as currency",
      "Chocolate is dangerous for dogs because of the sugar in it"
    ],
    "fake": 3,
    "why": "It is theobromine, which dogs break down far more slowly than we do. Dark chocolate is the worst of it."
  },
  {
    "t": "Food",
    "s": [
      "Ripe cranberries bounce",
      "Pound cake is named after a pound of each of its four ingredients",
      "Fortune cookies were not invented in China",
      "Crisps were invented for a customer who kept asking for thicker chips"
    ],
    "fake": 3,
    "why": "The story runs the other way: a customer kept sending chips back for being too thick, so the cook sliced them paper-thin out of spite."
  },
  {
    "t": "Food",
    "s": [
      "There is a museum in Sweden devoted to disgusting food",
      "In 1981 the US government proposed counting ketchup as a vegetable in school lunches",
      "Europeans once feared tomatoes as poisonous",
      "Carrots improve night vision, which is why wartime pilots ate them"
    ],
    "fake": 3,
    "why": "That was British wartime propaganda, spread to explain away the accuracy of their pilots and hide the existence of radar."
  },
  {
    "t": "Food",
    "s": [
      "Cheese is the most stolen food in the world",
      "The world's most expensive coffee is made from beans eaten by a civet",
      "Saffron has to be picked by hand, flower by flower",
      "White chocolate contains no part of the cocoa bean"
    ],
    "fake": 3,
    "why": "It is made from cocoa butter, which comes from the same bean — just without the solids that make chocolate brown."
  },
  {
    "t": "Geography",
    "s": [
      "Russia spans eleven time zones",
      "Alaska is both the westernmost and the easternmost state in the US",
      "Africa lies in all four hemispheres",
      "The Nile is the only major river that flows north"
    ],
    "fake": 3,
    "why": "Rivers flow downhill, not southwards. The Ob, the Rhine and the Mackenzie all run north too."
  },
  {
    "t": "Geography",
    "s": [
      "Canada has more lakes than the rest of the world put together",
      "Canada has the longest coastline of any country",
      "Part of Canada lies further south than part of California",
      "Canada is named after a French phrase meaning big village"
    ],
    "fake": 3,
    "why": "It comes from kanata, an Iroquoian word for village, which Jacques Cartier picked up and applied to the whole country."
  },
  {
    "t": "Geography",
    "s": [
      "It has snowed in the Sahara",
      "The largest desert on Earth is Antarctica, not the Sahara",
      "Antarctica is the driest continent",
      "Nobody has ever been born in Antarctica"
    ],
    "fake": 3,
    "why": "At least eleven children have been born there, the first in 1978 at an Argentine base."
  },
  {
    "t": "Geography",
    "s": [
      "Everest is not the furthest point on the surface from the centre of the Earth",
      "Everest grows a few millimetres every year",
      "Climbers queue in traffic jams near Everest's summit",
      "Everest is the tallest mountain on Earth measured from base to peak"
    ],
    "fake": 3,
    "why": "Measured from its base, Mauna Kea in Hawaii is more than a kilometre taller — most of it under the sea."
  },
  {
    "t": "Geography",
    "s": [
      "At Point Nemo, the nearest humans are often the crew of the space station",
      "Retired spacecraft are deliberately crashed into Point Nemo",
      "The Pacific is shrinking while the Atlantic grows",
      "Nothing at all lives in the Dead Sea"
    ],
    "fake": 3,
    "why": "Salt-loving microbes and algae live there quite happily. It is animals and plants that cannot."
  },
  {
    "t": "Geography",
    "s": [
      "Istanbul sits on two continents",
      "Lake Van in Turkey is alkaline enough to wash clothes in",
      "The Bosphorus has an undersea current running the opposite way to the surface",
      "Constantinople was renamed Istanbul in 1453"
    ],
    "fake": 3,
    "why": "The name changed officially in 1930, though people living there had used Istanbul for centuries."
  },
  {
    "t": "Words",
    "s": [
      "The dot over a lower-case i is called a tittle",
      "Q is the only letter that appears in no US state name",
      "No English word is a perfect rhyme for month",
      "The longest word in English has 45 letters and means fear of long words"
    ],
    "fake": 3,
    "why": "The 45-letter one is a lung disease, pneumonoultramicroscopicsilicovolcanoconiosis. The fear of long words is a different, jokier word."
  },
  {
    "t": "Words",
    "s": [
      "In almost every language pineapple is a version of ananas — except English",
      "In Danish the @ sign is called an elephant's trunk",
      "Norwegian and Swedish speakers can largely understand one another",
      "Esperanto is an official language of the European Union"
    ],
    "fake": 3,
    "why": "The EU has 24 official languages and every one of them is a national language. Esperanto is not among them."
  },
  {
    "t": "Words",
    "s": [
      "Shakespeare is the first recorded user of hundreds of English words",
      "OK may be the most widely understood word on Earth",
      "Nice once meant foolish or ignorant",
      "Posh comes from port out, starboard home on ships to India"
    ],
    "fake": 3,
    "why": "There is no evidence for it. Dictionaries file it as a folk etymology invented long after the word appeared."
  },
  {
    "t": "Words",
    "s": [
      "Japanese uses three writing systems side by side",
      "Some languages have no words for left and right, using compass directions instead",
      "There are languages left with only a handful of living speakers",
      "Chinese has an alphabet of about 5,000 characters, learned in order"
    ],
    "fake": 3,
    "why": "Chinese has no alphabet at all. It uses characters, and everyday literacy takes around three thousand of them."
  },
  {
    "t": "Invention",
    "s": [
      "The first computer programmer was a woman, Ada Lovelace",
      "The first hard drive weighed over a tonne and held 5 MB",
      "The @ symbol was on typewriters long before email existed",
      "The first computer mouse was made of metal and glass"
    ],
    "fake": 3,
    "why": "Douglas Engelbart's 1964 original was a carved wooden shell with two metal wheels underneath."
  },
  {
    "t": "Invention",
    "s": [
      "Bubble wrap was invented as wallpaper",
      "Play-Doh was originally a wallpaper cleaner",
      "Listerine was once sold as a floor cleaner",
      "Velcro was invented by NASA for the Apollo missions"
    ],
    "fake": 3,
    "why": "A Swiss engineer, George de Mestral, invented it in the 1940s after picking burrs off his dog. NASA were just early customers."
  },
  {
    "t": "Numbers",
    "s": [
      "There are more possible games of chess than atoms in the observable universe",
      "A shuffled deck of cards has almost certainly never been in that order before",
      "Zero was a relatively late arrival in European mathematics",
      "A googol is the largest number that has a name"
    ],
    "fake": 3,
    "why": "A googolplex is a one followed by a googol of zeros, and mathematicians have named numbers that dwarf even that."
  }
];

/**
 * One picture per theme, never one per question: a photograph of the thing a
 * statement is about would hand over the answer.
 */
export function plateFor(theme: string): string {
  const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return "/plates/" + slug + ".jpg";
}
