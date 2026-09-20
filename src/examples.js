/** Curated programs, each chosen to show a different shape of execution. */

export const EXAMPLES = [
  {
    id: 'pipeline',
    name: 'Array pipeline',
    blurb: 'filter → map → reduce, one item at a time',
    code: `// Three shoppers, three baskets.
const prices = [12, 40, 7, 95, 23];

const affordable = prices.filter(p => p < 50);
const withTax = affordable.map(p => p * 1.2);
const total = withTax.reduce((sum, p) => sum + p, 0);

console.log("Total:", Math.round(total));`,
  },
  {
    id: 'sort',
    name: 'Sorting numbers',
    blurb: 'watch every comparison the sorter makes',
    code: `// Sorting is just a lot of small comparisons.
const input = [5, 10, 7, 9, 1];

const sorted = input.sort((a, b) => a - b);

console.log(sorted);`,
  },
  {
    id: 'loop',
    name: 'Loops & conditions',
    blurb: 'a counter, a test, a running total',
    code: `// Add up every number that divides by 3.
let total = 0;

for (let i = 1; i <= 10; i++) {
  if (i % 3 === 0) {
    total = total + i;
  }
}

console.log("Sum of multiples of 3:", total);`,
  },
  {
    id: 'recursion',
    name: 'Recursion',
    blurb: 'a function that calls itself — watch the stack grow',
    code: `// Each call waits for the calls below it to finish.
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const answer = factorial(5);
console.log("5! =", answer);`,
  },
  {
    id: 'objects',
    name: 'Objects & shapes',
    blurb: 'reshape a list of records',
    code: `// Turn records into a leaderboard.
const players = [
  { name: "Ada", score: 91 },
  { name: "Lin", score: 68 },
  { name: "Ravi", score: 78 },
];

const names = players
  .filter(p => p.score > 70)
  .map(p => p.name);

const { name, score } = players[0];

console.log(names, name, score);`,
  },
  {
    id: 'closure',
    name: 'Closures',
    blurb: 'a function that remembers',
    code: `// The inner function keeps hold of \`count\`.
function makeCounter() {
  let count = 0;

  return function tick() {
    count = count + 1;
    return count;
  };
}

const next = makeCounter();

console.log(next());
console.log(next());
console.log(next());`,
  },
  {
    id: 'strings',
    name: 'Strings',
    blurb: 'split, transform, rejoin',
    code: `// Turn a sentence into a slug.
const title = "Make JavaScript Visible";

const words = title.split(" ");
const lower = words.map(w => w.toLowerCase());
const slug = lower.join("-");

console.log(slug);`,
  },
  {
    id: 'search',
    name: 'Searching',
    blurb: 'find stops the moment it succeeds',
    code: `// \`find\` gives up as soon as it has an answer.
const stock = [
  { item: "bolt", qty: 0 },
  { item: "nut", qty: 4 },
  { item: "washer", qty: 12 },
];

const inStock = stock.find(s => s.qty > 0);
const anyEmpty = stock.some(s => s.qty === 0);

console.log(inStock, anyEmpty);`,
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0];
