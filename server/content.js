// Content banks. Facts are rounded, well-established values; generators only pair items that are far
// enough apart (see challenges.js) so rounding or source disagreement can never flip an answer.

export const MAGNITUDES = [
  {
    id: 'population', prompt: 'Which has more people?', unit: 'million people',
    items: [
      ['India', 1441], ['China', 1425], ['USA', 341], ['Indonesia', 279], ['Pakistan', 245], ['Nigeria', 229],
      ['Brazil', 217], ['Bangladesh', 174], ['Russia', 144], ['Japan', 124], ['Egypt', 114], ['Vietnam', 100],
      ['Germany', 84], ['Thailand', 72], ['United Kingdom', 68], ['France', 66], ['Italy', 59], ['South Korea', 52],
      ['Spain', 48], ['Argentina', 46], ['Canada', 39], ['Australia', 27], ['Netherlands', 18], ['Sweden', 10.5],
      ['Portugal', 10.4], ['Norway', 5.5], ['Ireland', 5.2], ['Iceland', 0.39],
    ],
  },
  {
    id: 'height', prompt: 'Which is taller?', unit: 'metres',
    items: [
      ['Burj Khalifa', 828], ['Tokyo Skytree', 634], ['CN Tower', 553], ['One World Trade Center', 541],
      ['Taipei 101', 508], ['Empire State Building', 443], ['Eiffel Tower', 330], ['Golden Gate Bridge tower', 227],
      ['Space Needle', 184], ['Great Pyramid of Giza', 139], ['Big Ben (Elizabeth Tower)', 96],
      ['Statue of Liberty (with pedestal)', 93], ['Leaning Tower of Pisa', 56], ['Christ the Redeemer (with pedestal)', 38],
    ],
  },
  {
    id: 'speed', prompt: 'Which is faster at top speed?', unit: 'km/h',
    items: [
      ['Peregrine falcon (diving)', 390], ['Cheetah', 110], ['Lion', 80], ['Greyhound', 70], ['Giraffe', 60],
      ['Grizzly bear', 56], ['Usain Bolt', 44], ['Squirrel', 19], ['Chicken', 14], ['Garden snail', 0.05],
    ],
  },
  {
    id: 'planet', prompt: 'Which is bigger across?', unit: 'km diameter',
    items: [
      ['Jupiter', 139820], ['Saturn', 116460], ['Neptune', 49244], ['Earth', 12742], ['Mars', 6779],
      ['Mercury', 4879], ['The Moon', 3474], ['Pluto', 2377],
    ],
  },
  {
    id: 'river', prompt: 'Which river is longer?', unit: 'km',
    items: [
      ['Nile', 6650], ['Yangtze', 6300], ['Mekong', 4350], ['Volga', 3530], ['Danube', 2850], ['Ganges', 2525],
      ['Rhine', 1230], ['Seine', 777], ['Thames', 346],
    ],
  },
  {
    id: 'mountain', prompt: 'Which peak is higher?', unit: 'metres',
    items: [
      ['Mount Everest', 8849], ['Aconcagua', 6961], ['Denali', 6190], ['Kilimanjaro', 5895], ['Mont Blanc', 4806],
      ['Matterhorn', 4478], ['Mount Fuji', 3776], ['Ben Nevis', 1345], ['Table Mountain', 1085],
    ],
  },
  {
    id: 'weight', prompt: 'Which is heavier (typical adult)?', unit: 'kg',
    items: [
      ['Blue whale', 140000], ['African elephant', 6000], ['Hippopotamus', 1500], ['Polar bear', 450],
      ['Gorilla', 160], ['Human', 70], ['Emperor penguin', 30], ['House cat', 4.5], ['Chicken', 2.5],
      ['Hummingbird', 0.004],
    ],
  },
];

// Negative years are BCE.
export const EVENTS = [
  ['Great Pyramid of Giza completed', -2560], ['Cleopatra is born', -69], ['Rome’s Colosseum opens', 80],
  ['Teaching begins at Oxford University', 1096], ['Aztec city of Tenochtitlan founded', 1325],
  ['Gutenberg’s printing press', 1440], ['Columbus reaches the Americas', 1492], ['Shakespeare is born', 1564],
  ['Great Fire of London', 1666], ['US Declaration of Independence', 1776], ['French Revolution begins', 1789],
  ['Battle of Waterloo', 1815], ['Darwin publishes On the Origin of Species', 1859], ['Telephone patented', 1876],
  ['Edison’s light bulb patent', 1879], ['Statue of Liberty dedicated', 1886], ['Nintendo is founded', 1889],
  ['First modern Olympic Games', 1896], ['Wright brothers’ first flight', 1903], ['Ford Model T launched', 1908],
  ['Titanic sinks', 1912], ['Penicillin discovered', 1928], ['First FIFA World Cup', 1930],
  ['Everest first summited', 1953], ['Disneyland opens', 1955], ['Sputnik launched', 1957],
  ['The modern LEGO brick', 1958], ['Barbie launched', 1959], ['The Beatles’ first album', 1963],
  ['First Star Trek episode airs', 1966], ['First Moon landing', 1969], ['First email sent', 1971],
  ['Star Wars hits cinemas', 1977], ['Tetris is created', 1984], ['Chernobyl disaster', 1986],
  ['Berlin Wall falls', 1989], ['Jurassic Park in cinemas', 1993], ['Channel Tunnel opens', 1994],
  ['Toy Story released', 1995], ['First Harry Potter book', 1997], ['Google founded', 1998],
  ['Wikipedia launched', 2001], ['Euro notes and coins arrive', 2002], ['Facebook launched', 2004],
  ['YouTube launched', 2005], ['First iPhone', 2007], ['Bitcoin launched', 2009], ['Instagram launched', 2010],
  ['ChatGPT released', 2022],
];

export const ESTIMATES = [
  { q: 'How many keys on a standard piano?', a: 88, min: 0, max: 200, step: 1 },
  { q: 'How tall is the Eiffel Tower, in metres?', a: 330, min: 0, max: 1000, step: 5 },
  { q: 'In what year did the Titanic sink?', a: 1912, min: 1800, max: 2000, step: 1 },
  { q: 'How many bones in an adult human body?', a: 206, min: 0, max: 500, step: 1 },
  { q: 'How many member states does the UN have?', a: 193, min: 0, max: 300, step: 1 },
  { q: 'How many minutes are in a week?', a: 10080, min: 0, max: 20000, step: 10 },
  { q: 'How long is a marathon, in kilometres?', a: 42, min: 0, max: 100, step: 1 },
  { q: 'Water boils at sea level at how many °F?', a: 212, min: 0, max: 400, step: 1 },
  { q: 'How many hearts does an octopus have?', a: 3, min: 0, max: 10, step: 1 },
  { q: 'In what year did humans first land on the Moon?', a: 1969, min: 1900, max: 2020, step: 1 },
  { q: 'How many seconds are in an hour?', a: 3600, min: 0, max: 10000, step: 10 },
  { q: 'How high is Mount Everest, in metres?', a: 8849, min: 0, max: 15000, step: 10 },
  { q: 'How many teeth does an adult usually have?', a: 32, min: 0, max: 60, step: 1 },
  { q: 'How far is the Moon, in thousands of km?', a: 384, min: 0, max: 1000, step: 1 },
  { q: 'How many time zones does Russia span?', a: 11, min: 0, max: 20, step: 1 },
  { q: 'In what year was the first Harry Potter book published?', a: 1997, min: 1950, max: 2020, step: 1 },
  { q: 'How many stripes are on the US flag?', a: 13, min: 0, max: 50, step: 1 },
  { q: 'How many cards in a deck, without jokers?', a: 52, min: 0, max: 100, step: 1 },
  { q: 'In what year did the Berlin Wall fall?', a: 1989, min: 1940, max: 2020, step: 1 },
  { q: 'How many moons does Mars have?', a: 2, min: 0, max: 10, step: 1 },
  { q: 'What percentage of Earth’s surface is water?', a: 71, min: 0, max: 100, step: 1 },
  { q: 'How many countries are in the European Union?', a: 27, min: 0, max: 60, step: 1 },
  { q: 'How many years did the Hundred Years’ War last?', a: 116, min: 0, max: 200, step: 1 },
  { q: 'Normal human body temperature, in °C?', a: 37, min: 30, max: 45, step: 0.5 },
  { q: 'World population in 2024, in billions?', a: 8.1, min: 0, max: 15, step: 0.1 },
  { q: 'In what year was Google founded?', a: 1998, min: 1980, max: 2020, step: 1 },
  { q: 'How many minutes does the ISS take to orbit Earth?', a: 92, min: 0, max: 300, step: 1 },
  { q: 'How many squares on a chessboard?', a: 64, min: 0, max: 200, step: 1 },
  { q: 'How many players are on the pitch in a football match?', a: 22, min: 0, max: 50, step: 1 },
  { q: 'How many US states are there?', a: 50, min: 0, max: 100, step: 1 },
];

// Category words. INCOMPATIBLE pairs share words that could belong to both (peach is a colour, gold a metal).
export const CATEGORIES = {
  fruit: { label: 'a fruit', words: ['apple', 'banana', 'cherry', 'mango', 'peach', 'grape', 'lemon', 'plum', 'pear', 'melon', 'apricot', 'papaya', 'lime', 'fig', 'coconut'] },
  vegetable: { label: 'a vegetable', words: ['carrot', 'onion', 'potato', 'spinach', 'celery', 'cabbage', 'radish', 'leek', 'turnip', 'broccoli', 'lettuce', 'parsnip'] },
  mammal: { label: 'a mammal', words: ['tiger', 'otter', 'horse', 'rabbit', 'camel', 'zebra', 'beaver', 'panda', 'wolf', 'moose', 'badger', 'hamster'] },
  bird: { label: 'a bird', words: ['eagle', 'robin', 'parrot', 'owl', 'swan', 'pigeon', 'falcon', 'crow', 'heron', 'sparrow', 'penguin', 'flamingo'] },
  fish: { label: 'a fish', words: ['salmon', 'trout', 'tuna', 'cod', 'shark', 'carp', 'herring', 'mackerel', 'sardine', 'halibut', 'perch', 'pike'] },
  instrument: { label: 'an instrument', words: ['violin', 'trumpet', 'piano', 'flute', 'cello', 'drums', 'guitar', 'harp', 'oboe', 'banjo', 'tuba', 'clarinet'] },
  sport: { label: 'a sport', words: ['tennis', 'rugby', 'cricket', 'hockey', 'golf', 'boxing', 'rowing', 'fencing', 'cycling', 'archery', 'surfing', 'judo'] },
  colour: { label: 'a colour', words: ['crimson', 'scarlet', 'indigo', 'maroon', 'magenta', 'beige', 'cyan', 'mauve', 'ochre', 'lilac'] },
  capital: { label: 'a capital city', words: ['Paris', 'Tokyo', 'Cairo', 'Oslo', 'Madrid', 'Berlin', 'Ottawa', 'Nairobi', 'Canberra', 'Dublin', 'Rome', 'Lisbon'] },
  metal: { label: 'a metal', words: ['iron', 'copper', 'silver', 'gold', 'zinc', 'nickel', 'cobalt', 'platinum', 'titanium', 'aluminium'] },
  kitchen: { label: 'a kitchen tool', words: ['spatula', 'whisk', 'ladle', 'kettle', 'colander', 'toaster', 'grater', 'skillet', 'peeler', 'rolling pin'] },
  body: { label: 'a body part', words: ['elbow', 'ankle', 'knee', 'wrist', 'shoulder', 'thumb', 'heel', 'chin', 'ear', 'nose'] },
  weather: { label: 'weather', words: ['thunder', 'drizzle', 'hail', 'sleet', 'blizzard', 'fog', 'monsoon', 'frost', 'gale', 'breeze'] },
  clothing: { label: 'clothing', words: ['jacket', 'scarf', 'sweater', 'jeans', 'glove', 'boots', 'hoodie', 'blazer', 'sock', 'beanie'] },
};

export const INCOMPATIBLE = [
  ['colour', 'fruit'], ['colour', 'metal'], ['fruit', 'vegetable'], ['mammal', 'bird'], ['mammal', 'fish'],
  ['bird', 'fish'], ['colour', 'vegetable'], ['colour', 'bird'], ['colour', 'mammal'],
];

export const UNSCRAMBLE_WORDS = [
  'planet', 'garden', 'silver', 'bridge', 'castle', 'rocket', 'pirate', 'forest', 'winter', 'summer', 'orange',
  'marble', 'puzzle', 'dragon', 'island', 'jungle', 'candle', 'butter', 'coffee', 'guitar', 'legend', 'mirror',
  'needle', 'pencil', 'rabbit', 'tunnel', 'velvet', 'wizard', 'anchor', 'basket', 'cactus', 'donkey', 'engine',
  'falcon', 'jacket', 'kettle', 'ladder', 'magnet', 'napkin', 'oyster', 'parrot', 'ribbon', 'shadow', 'ticket',
  'violin', 'walrus', 'yogurt', 'zipper', 'beach', 'cloud', 'dream', 'flame', 'ghost', 'heart', 'juice', 'knife',
  'lemon', 'mouse', 'night', 'ocean', 'piano', 'queen', 'river', 'storm', 'tiger', 'voice', 'whale', 'honey',
  'robot', 'laser', 'pizza', 'sugar', 'train', 'crown', 'smile', 'light', 'music', 'party', 'magic', 'sport',
  'toast', 'brick', 'chair', 'clock', 'plant', 'sheep', 'snake', 'spoon', 'truck', 'bread', 'horse', 'house',
  'money', 'water', 'space', 'stone', 'world', 'apple', 'eagle', 'field', 'glass', 'grape', 'metal', 'comet',
  'pocket', 'circus', 'button', 'hammer', 'monkey', 'lizard', 'banana', 'cookie', 'helmet', 'sunset',
];

export const MISSING_WORDS = [
  'planet', 'kitchen', 'blanket', 'journey', 'dolphin', 'thunder', 'library', 'pumpkin', 'volcano', 'diamond',
  'chimney', 'compass', 'lantern', 'harvest', 'gallery', 'penguin', 'pyramid', 'rainbow', 'skeleton', 'trumpet',
  'tornado', 'whisper', 'avocado', 'balloon', 'captain', 'dinosaur', 'elephant', 'festival', 'giraffe', 'hospital',
  'kangaroo', 'lighthouse', 'mountain', 'notebook', 'octopus', 'painting', 'question', 'sandwich', 'telescope',
  'umbrella', 'vanilla', 'waterfall', 'airport', 'bicycle', 'chocolate', 'dragonfly', 'envelope', 'football',
  'gorilla', 'hedgehog', 'iceberg', 'jellyfish', 'keyboard', 'lemonade', 'magician', 'necklace', 'orchestra',
  'parachute', 'scissors', 'treasure', 'vampire', 'wardrobe', 'yesterday', 'zucchini', 'astronaut', 'carnival',
];

export const CLASH_COLOURS = [
  { key: 'red', label: 'RED', hex: '#FF4D4D' },
  { key: 'blue', label: 'BLUE', hex: '#4C8DFF' },
  { key: 'yellow', label: 'YELLOW', hex: '#FFD23F' },
  { key: 'green', label: 'GREEN', hex: '#3EE0A0' },
];

export const MEMORY_SYMBOLS = ['diamond', 'circle', 'triangle', 'square', 'cross', 'star'];
