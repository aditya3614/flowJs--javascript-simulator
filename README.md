# flowJs--javascript-simulator

# FlowJS

*See your JavaScript think.*

FlowJS is a small web app for watching JavaScript run.

You type some code, press **Run**, and get a replay. Each step shows the line
that's running, one plain-English sentence about what just happened, and a
picture of that moment. You can play it, pause it, drag back and forth through
it, or have it read aloud to you.

It all runs in your browser. There's no server, no login, and your code never
leaves your machine.

It's meant for anyone who has stared at a line of code and wondered what it
actually does: people learning to program, people teaching it, or people who
just want to see why a loop gave the number it gave.

**This README is written so you can understand the whole project from it,
including how it works inside.** If you've never programmed, read sections 1 to
4 and the [glossary](#glossary). If you're a developer, jump to
[How it works inside](#5-how-it-works-inside).

---

## Contents

1. [Try it](#1-try-it)
2. [What's on the screen](#2-whats-on-the-screen)
3. [Reading the pictures](#3-reading-the-pictures)
4. [A whole run, start to finish](#4-a-whole-run-start-to-finish)
5. [How it works inside](#5-how-it-works-inside)
6. [What FlowJS can't do](#6-what-flowjs-cant-do)
7. [Where everything lives](#7-where-everything-lives)
8. [Changing things](#8-changing-things)
9. [Built with](#9-built-with)
10. [Look and feel](#10-look-and-feel)
11. [Glossary](#glossary)

---

## 1. Try it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

A good first minute:

1. The page opens with an example already loaded. Press **Run** (or
   `⌘ Enter` / `Ctrl Enter`). The replay starts playing by itself.
2. Press `Space` to pause. Press `→` and `←` to step forward and back one
   moment at a time. Or grab the bar at the bottom and drag it.
3. Open the **Example** menu at the top left, pick **Recursion**, press Run,
   and watch the **Call stack** tab grow and shrink.
4. Press **Read aloud** and let it narrate.
5. Change the code in the editor. The button turns into **Run changes**. Press
   it to replay your version.

To make a version you can host somewhere:

```bash
npm run build     # writes static files into dist/
npm run preview   # serves dist/ locally so you can check it
```

`dist/` is plain static files, so any static host will serve it. The only thing
it fetches from the internet is the fonts (Google Fonts). Offline, it falls back
to your system fonts and everything else works the same.

---

## 2. What's on the screen

Two boxes, side by side. The left one is where your code lives. The right one
is where it gets replayed.

```
▲ FlowJS
┌ EXAMPLE [array pipeline ▾]    [Run] ┐  ┌ STEP KIND · line 4      [Read aloud]  Step 8 of 28 ┐
│                                     │  ├─────────────────────────────────────────────────────┤
│   the code editor (dark)            │  │  One sentence saying what is happening.             │
│   the current line is highlighted   │  ├─────────────────────────────────────────────────────┤
│                                     │  │                                                     │
├─────────────────────────────────────┤  │       One picture of this moment                    │
│ Output │ Variables │ Call stack │…   │  │                                                     │
│ (whichever tab is selected)         │  ├─────────────────────────────────────────────────────┤
└─────────────────────────────────────┘  └ ⏮ ◀ ▶ ▶ ⏭  ──────●─────────────  8 / 28   1× ──────┘
```

### The left box: your code

- **Example menu** loads one of eight small programs (listed in section 8).
- **Run** runs whatever is in the editor. It says *Run changes* if you've edited
  the code since the last run. Editing never re-runs anything on its own.
- **The editor** is a normal code editor (CodeMirror). While a replay is on
  screen, the line being described is highlighted and marked with a `▶` in the
  margin. If a step spans several lines, they're all tinted.
- **The four tabs** underneath show the program's state *at the step you're
  looking at*:

| Tab | What it shows |
| --- | --- |
| **Output** | Everything `console.log` has printed so far. Scrub backwards and lines disappear again, because they haven't been printed yet at that point. Errors show up here too. |
| **Variables** | Every variable that exists at this step and what it holds. A variable that just changed flashes. |
| **Call stack** | Which functions are currently in the middle of running, newest on top, with the values they were called with. |
| **Steps** | A written transcript of the entire run. Click any row to jump to that moment. |

### The right box: the replay

- **Top bar** says what kind of step this is ("Decision", "Loop", "Function
  call"…), which line it's on, and which step you're at out of how many.
- **The sentence** is the biggest text on the screen because it's the part you
  actually read.
- **The picture** is one diagram for this moment. While an array pipeline is
  running, the pipeline *is* the picture and nothing else is drawn next to it.
- **The bottom bar** has the play controls and the timeline. The colored ticks
  on the timeline are the steps, one tick each (grouped together for very long
  runs), colored by what kind of thing happens there. So you can see the
  shape of a run at a glance: where the loops are, where the function calls
  are. Drag the bar or click on it to jump. The speed buttons run from 0.5× to
  4×.

### Keyboard

| Do this | Press |
| --- | --- |
| Run the code | `⌘ Enter` or `Ctrl Enter` (also `⌘ S` / `Ctrl S`), works even while typing |
| Play / pause | `Space` |
| Step forward / back | `→` / `←` |
| Read aloud on / off | `V` |

The last three don't fire while your cursor is in the editor, so you can type
spaces and arrow around normally.

---

## 3. Reading the pictures

Each step has a *kind*, and each kind has its own picture. Here's the whole
set:

| What just happened | Example sentence | What you see |
| --- | --- | --- |
| A variable was created | *Make a new box called `total` and put 0 inside.* | A labeled box holding the value, tagged `let`, `const` or `var`. Destructuring (`const {a, b} = obj`) shows one box per name. |
| A variable changed | *`total` changes from 0 to 3.* | The old value in a box marked "was", an arrow, then the new value. |
| A decision (`if`, `? :`, `switch`) | *Check `i % 3 === 0` → false, so we skip this.* | A fork. The test is at the top, and the branch that was taken lights up. |
| A loop went round | *3rd time round the loop. `i` is 3.* | A ring with the round number in the middle and the loop's variables beside it. |
| A function was called | *Step into `factorial` with n = 3.* | The function's name and the values it was given. |
| A function returned | *`factorial` hands back 6.* | The function, an arrow labeled "hands back", and the result. |
| Something was printed | *Print "Sum:" 3 to the console.* | The printed values. |
| An array method ran | *Does 3 pass `x > 2`? Yes, keep it.* | The [pipeline diagram](#the-pipeline-diagram), described below. |
| The next line is about to run | *Next line*, with the code shown | The code that's about to run. Used when nothing more specific applies. |
| Something broke | *Something went wrong: …* | An error card with a plain-English hint. |
| The end | *All finished. That is the whole program.* | A tick. |

Colors are used consistently. **Terracotta** means "you are here": the current
step, the active line, the Run button. **Green** means a value was created or
kept. **Blue** means a function call. **Mauve** means an error. Everything else
stays neutral.

### The pipeline diagram

A lot of everyday JavaScript is "take a list, do something to every item".
That's what `map`, `filter`, `reduce`, `sort`, `find` and friends do. If you
chain them, like `prices.filter(...).map(...).reduce(...)`, the diagram is a
vertical stack of cards, one per method, and the items visibly travel through
them.

Each card has a header with the method's name and a one-line description of what
it does, the rule you gave it (`p < 50`), the items, and the result. The card
changes shape depending on what kind of method it is:

- **Transformers** (`map`, `flatMap`, `forEach`…). Each item becomes a small
  tile that shows `3 → 6` as it's processed.
- **Tests** (`filter`, `find`, `some`, `every`, `findIndex`…). Each item gets a ✓ or
  ✕. Dropped items are visibly dropped. `find` and `some` stop as soon as they
  have an answer, so only the items they actually looked at appear.
- **Folds** (`reduce`). A "running total" sits on one side and the remaining
  items are lined up like pellets to be eaten, one at a time, each combining
  with the total.
- **Sorts** (`sort`, `toSorted`). The two values being compared face each other,
  with the words "stays in front" or "swap them" (which is just what your
  comparison function answered), and underneath is the list. Note that browsers
  built on Chrome's engine only rearrange the array once the sort has finished,
  so during the comparisons that list still shows the original order.

While a card is running it only shows what it has produced *so far*. It doesn't
show the final answer early, since the answer is the thing being explained.
After the statement ends, the finished pipeline stays on screen, dimmed, and the
next line's own picture appears alongside it, until another pipeline replaces it.

---

## 4. A whole run, start to finish

Here's a small program. The line numbers are just for reference.

```js
1  let total = 0;
2  for (let i = 1; i <= 3; i++) {
3    if (i % 3 === 0) {
4      total = total + i;
5    }
6  }
7  console.log("Sum:", total);
```

FlowJS turns it into twelve steps. This is what it actually produces (I ran it
and copied the output):

| # | Line | Kind | Sentence |
| --- | --- | --- | --- |
| 1 | 1 | New variable | Make a new box called `total` and put 0 inside. |
| 2 | 2 | New variable | Make a new box called `i` and put 1 inside. |
| 3 | 2 | Loop | 1st time round the loop. `i` is 1. |
| 4 | 3 | Decision | Check `i % 3 === 0` → false, so we skip this. |
| 5 | 2 | Loop | 2nd time round the loop. `i` is 2. |
| 6 | 3 | Decision | Check `i % 3 === 0` → false, so we skip this. |
| 7 | 2 | Loop | 3rd time round the loop. `i` is 3. |
| 8 | 3 | Decision | Check `i % 3 === 0` → true, so we go inside. |
| 9 | 4 | Value changes | `total` changes from 0 to 3. |
| 10 | 2 | Decision | Check `i <= 3` → false. The loop is finished. |
| 11 | 7 | Output | Print "Sum:" 3 to the console. |
| 12 | 7 | Finished | All finished. That is the whole program. |

A few things worth noticing, because they show the choices the tool makes:

- **One line, one step.** Line 1 is a single step, not two ("about to run
  `let total = 0`" followed by "made `total`"). The step and the thing it did are
  merged. [Section 5](#one-line-one-moment) explains how.
- **The loop test gets no step until it fails.** Every time round, `i <= 3` is
  checked and comes out true, but that would be noise, since "3rd time round the
  loop" already says the loop continued. Only the last check, the one that ends
  the loop, is reported (step 10).
- **`i++` gets no step of its own.** The counter going up is folded into the
  next "time round the loop" sentence, which reports the new `i`.
- **Every step is self-contained.** To draw step 7, the screen doesn't need to
  know anything about step 6. The step carries everything needed to draw it.
  This is the main design idea, and the rest of this README is mostly about it.

---

## 5. How it works inside

### The big idea: record first, replay later

Most debuggers run your code live and freeze it at each line. FlowJS doesn't.

When you press Run it does this instead:

1. It runs your **whole program once, immediately, at full speed**, with a
   note-taker attached that writes down what happens at every interesting moment.
2. When the program is finished, it has a long list of notes. Each note is called a **frame**:
   one moment, with everything needed to draw it.
3. Only then does the screen start showing anything. Playing the replay just
   means walking down the list of frames, one at a time.

Nothing runs during the replay. The "replay" is a flipbook.

This has some useful consequences:

- **Going backwards is free.** There's nothing to undo. Step 5 is just item 5 in
  a list, and you can look at it whenever you like.
- **Your code runs exactly once per press of Run.** A `console.log` doesn't fire
  again when you scrub past it.
- **The trade-off:** a slow program makes you wait *before* the replay
  starts, and the whole run has to fit in memory as frames. That's why
  [there are limits](#limits-in-one-place).

Here's the whole pipeline in one picture:

```
 your code (text)
      │
      │  1. acorn reads it and builds a syntax tree            engine/instrument.js
      ▼
 syntax tree
      │
      │  2. we walk the tree and add note-taking calls
      │     everywhere something interesting can happen         engine/instrument.js
      ▼
 syntax tree with hooks
      │
      │  3. astring prints the tree back out as code            engine/instrument.js
      ▼
 rewritten code (text) ─────────────┐
      │                             │
      │  4. run it once inside      │  each hook calls the tracer,
      │     an AsyncFunction        │  which adds a frame
      ▼                             ▼                            engine/run.js
 program finishes ◄──────────── engine/tracer.js
      │
      ▼
 frames[]   output[]   pipelines[]         ← the "trace": everything that happened
      │
      │  5. App.jsx keeps one number, `index`
      ▼
 what you see = draw(frames[index])                              App.jsx + components/
```

The rest of this section walks through each stage.

### Step 1: Read the code (parsing)

The first thing that happens to your code is that it's *parsed*. A library called
[acorn](https://github.com/acornjs/acorn) reads the text and builds a tree that
describes its structure. Programmers call this an **abstract syntax tree**, or
AST. For example, `let total = 0;` becomes something like "a variable
declaration, whose name is `total`, whose starting value is the number 0, found
on line 1, columns 0 to 14."

Why bother? Because with a tree you know what each piece of your code *is*,
whether it's a loop, a function, or a condition. Finding those by searching the
text would break constantly.

If the code can't be parsed (a missing bracket, say), that's a syntax error. It
is caught right here, before anything runs. You get a card that says which line
to look at, plus a hint. No replay is produced.

The parser is set to accept modern JavaScript, `await` at the top level, and
`return` outside a function.

### Step 2: Add the note-taker (instrumenting)

This is the heart of the project, in [`instrument.js`](src/engine/instrument.js).

FlowJS never modifies what your code *does*. It walks the tree and, next to every
statement that matters, it inserts a call to a note-taker called `__T` (short
for "tracer"). Here's a three-line program and what it turns into. This is real
output:

```js
// what you wrote          // what actually gets run
let total = 0;             __T.s(0, () => ({}));
total = total + 5;         let total = __T.d(1, "total", 0);
console.log(total);        __T.s(2, () => ({ total: total }));
                           __T.a(3, "total", total, total = total + 5, () => total);
                           __T.s(4, () => ({ total: total }));
                           __T.log(5, "log", [total]);
```

Three ideas are packed in here.

**Hooks return what they were given.** Look at `let total = __T.d(1, "total", 0)`.
`__T.d` records that a variable was declared, then hands back the `0` it was
given. So the line still means `let total = 0`. Every hook that sits in the
middle of an expression works this way: note it down, pass the value through
untouched. That's why the program behaves exactly as it would without FlowJS.

**Numbers instead of text.** The first argument to every hook (`0`, `1`, `2`…)
is an index into a table called `meta`, built at the same time. Entry 1 in that
table says: *line 1, columns 4 to 13, this is a declaration, its name is
`total`, its kind is `let`, and the source text is `total = 0`.* Keeping this
information in a table, rather than spelling it out in every call, keeps the
rewritten code small and quick to run.

**Variables are read through little functions.** `() => ({ total: total })`
is a function that, when called, looks up the current value of every variable
that is visible at that spot. It's a function (not a value) because the value
has to be read *at the moment of recording*, not when the code was rewritten.
The compiler knows which names to put in it because it keeps track of scopes as
it walks the tree: what's declared in this block, in the enclosing function, and
so on. It even accounts for `var` and function declarations being "hoisted" to
the top of their scope.

Here is every hook:

| Hook | Stands for | Inserted around |
| --- | --- | --- |
| `__T.s` | statement | The start of every statement. "A new line is about to run." |
| `__T.d` | declare | The value in `let x = …` / `const x = …` / `var x = …` |
| `__T.dp` | destructure | After `const { a, b } = obj` or `const [x, y] = list`, to report all the new names |
| `__T.a` | assign | `x = …`, `x += …` |
| `__T.am` | assign member | `obj.key = …`, `list[2] = …` |
| `__T.u` | update | `x++` and `x--` |
| `__T.cond` | condition | The test in `if`, `while`, `for`, `do…while`, `? :`, and the value in `switch` |
| `__T.iter` | iteration | The top of every loop body |
| `__T.enter` | enter | The start of every function body |
| `__T.ret` | return | The value in a `return` statement |
| `__T.exit` | exit | The end of every function body (see below) |
| `__T.log` | log | Every `console.something(…)` |
| `__T.c` | call | Array/string method calls like `list.map(…)`, described next |

A few more details about the rewriting:

- **Functions** get their body wrapped as `enter → try { your code } finally { exit }`.
  The `finally` matters: `exit` is recorded even when the function returns
  early or throws. Arrow functions written as `x => x * 2` are quietly turned
  into `x => { return x * 2 }` so they have a place to attach the hooks.
  Anonymous arrow functions are called `λ` in the sentences.
- **`console.log`** is replaced with `__T.log` so that printing is captured
  (see [step 3](#step-3-run-it)).
- **Array methods.** `prices.filter(p => p < 50)` becomes
  `__T.c(7, prices, "filter", [p => p < 50])`. That means the note-taker calls
  `filter` *for you*, which lets it wrap the callback and see every single item.
  Only a fixed list of names gets this (`map`, `filter`, `reduce`, `sort`, `find`,
  `some`, `every`, `push`, `slice`, `join`, `split` and about twenty more).
  It's the `TRACED_METHODS` set at the top of `instrument.js`.
- **`i++` in a `for` header** is deliberately left alone, for the reason given in
  section 4.
- **Function declarations** get no "next line" step, because JavaScript sets them
  up before anything runs, so having one would be a lie.
- **Destructuring, classes, `switch`, `try/catch`, labels…** each have their
  own small case in the compiler. Anything it doesn't recognize is walked
  through generically and left as it is.

Finally, [astring](https://github.com/davidbonnet/astring) prints the
modified tree back out as plain JavaScript text.

### Step 3: Run it

[`run.js`](src/engine/run.js) takes the rewritten text and runs it. Roughly:

```js
const fn = new AsyncFunction(
  '__T', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  `"use strict";\n${code}`,
);
await fn(tracer.api, consoleShim, timers.setTimeout, timers.setInterval, /* … */);
```

- **`AsyncFunction`** is a way to build a function out of text, and specifically
  a function that's allowed to use `await`. That's why `await` works at the top
  level of your code, even though that normally isn't allowed in a plain script.
- The function takes `__T` (the note-taker every hook calls), `console`, and the
  four timer functions. Passing a `console` in shadows the real one, so your
  `console.log` lands in FlowJS's own Output tab instead of the browser's
  developer tools. Passing the timers in lets FlowJS keep track of any your code
  leaves running (see the fourth way a run can end, below).
- All of this happens inside a **Web Worker**: a separate thread with no access to
  the page. [`sandbox.js`](src/engine/sandbox.js) starts one per run and can
  stop it from outside; [`worker.js`](src/engine/worker.js) is what runs in it.
- `console.log`, `info`, `warn`, `error`, `debug` and `table` are captured.
  `group`, `time`, `count` and the like exist so your code doesn't crash on them,
  but they don't do anything.

There are four ways a run can end:

1. **It finishes normally.** A final *Finished* frame is added.
2. **It throws an error.** The error is caught, turned into a frame ("Something
   went wrong: …"), and given a beginner-friendly hint if it matches a known
   pattern, for instance *"You called something that is not a function"*, *"That
   name has not been created yet"*, or *"A function kept calling itself with no
   way out. Recursion needs a base case."* The steps recorded up until the error
   are still there to scrub through, which is usually the most useful part.
3. **It hits a limit.** See [limits](#limits-in-one-place). The run is stopped, the
   frames so far are kept, and a note says it stopped early.
4. **It gets stuck.** If it is still running after 6 seconds without ever
   calling back into the note-taker (a regular expression that backtracks
   forever, say), the worker is killed from outside. There is no trace to show,
   so you get a "Got stuck" card instead, and the next Run starts a fresh worker.

When the program itself finishes, any timers it left running get a short grace
period (1.5 seconds) so a `setTimeout` still shows up in the trace. A
`setInterval` that never stops is cut off with a note, and nothing is allowed to
write into a run once it is over.

### Step 4: Take notes (the tracer)

Every hook lands in [`tracer.js`](src/engine/tracer.js), which decides whether
to write a frame. A frame for `total = total + 5` looks like this (real output,
trimmed of some fields):

```js
{
  i: 1,                       // position in the list
  line: 2, endLine: 2,        // which lines to highlight
  kind: 'assign',             // what sort of moment this is
  name: 'total',
  prev:  { k: 'num', v: '0' },
  value: { k: 'num', v: '5' },
  scope: { total: { k: 'num', v: '5' } },   // every visible variable, right now
  stack: [],                  // the open function calls, right now
  outLen: 0,                  // how many console lines exist so far
  pipe: null,                 // pipeline progress, if any
  narr: '`total` changes from {{0}} to {{5}}.'   // the sentence
}
```

The important thing is that the frame is *complete*. The variables panel,
the call stack, the output count and the picture are all in there. That's why
the screen can jump to any frame without knowing about the others.

The kinds of frame are: `step`, `decl`, `assign`, `cond`, `switch`, `iter`,
`enter`, `exit`, `log`, `stage-start`, `stage-item`, `stage-end`, `error` and
`done`.

#### Snapshots: why values are copied

Suppose your code does this:

```js
const list = [1];
list.push(2);
```

If a frame just held a *reference* to `list`, then when the replay shows the
first frame, the list would already contain `2`, because it's the same object
that was changed later. The past would keep rewriting itself.

So [`value.js`](src/engine/value.js) copies values into plain descriptions at
the moment they're recorded. A list becomes `{ k: 'arr', items: [...] }`, a
number becomes `{ k: 'num', v: '5' }`, an object becomes
`{ k: 'obj', entries: [...] }`, and so on. These copies never change. It also
handles `Map`, `Set`, `Date`, regular expressions, errors, promises, functions
and circular references (an object that contains itself is drawn as `↻ circular`
instead of looping forever).

Copies are capped so a giant value can't bloat the trace: at most 60 items per
list, 40 keys per object, 4 levels of nesting and 120 characters per string. If
something was cut off, the copy says so and the UI shows a "+N more".

#### One line, one moment

You saw in section 4 that a line produces a single step even though several
hooks fire for it. Here's how.

The `__T.s` hook at the start of a statement doesn't create a frame. It just
leaves a "pending" note: *line 1 is about to run.* Then one of two things happens:

- If the statement does something specific (declares a variable, assigns, logs,
  evaluates a condition), that hook **absorbs** the pending note. It takes over
  the line number and the variable snapshot and becomes the one frame for that
  line.
- If it doesn't (say the statement is just `factorial(3);` and the next thing
  that happens is a function being entered), the next event **flushes** the
  pending note as a plain "Next line" frame first.

That's why line 1 of the example became one *New variable* step and not two.

#### The call stack

The tracer keeps its own list of open function calls. `enter` pushes onto it and
`exit` pops. Each frame stores a copy of the list as it stood at that moment,
which is what the **Call stack** tab draws. For `factorial(3)` the stack, at the
deepest point, looks like this:

```
factorial(3) > factorial(2) > factorial(1)
```

and then it unwinds: `factorial(1)` exits and hands back 1, then `factorial(2)`
hands back 2, and finally `factorial(3)` hands back 6.

#### Loops

`iter` is called at the top of every loop body. The tracer keeps a count for each
loop (separately for each call depth, so a loop inside a recursive function
doesn't mix up its rounds with the levels above it). That count is where "3rd
time round the loop" comes from. It also looks at the loop's own variables (`i`,
or `item` in a `for…of`) so the sentence can say what they are this time.

One quirk: the count is never reset during a run. If you call a function twice
and it has a loop with two rounds, the second call's rounds are numbered "3rd"
and "4th", not "1st" and "2nd".

#### Sentences

Each frame gets its sentence at the moment it's recorded. The sentences are
written with a tiny bit of markup: `` `code` `` in backticks for code, and
`{{value}}` for a value. Different parts of the app read the same sentence
differently:

- The **narration bar** shows code in a monospace face and values in bold.
- The **Steps tab** strips the markup and shows plain text.
- The **voice** turns them into spoken words (see [Read aloud](#read-aloud)).

Writing the sentence once, in one place, means these can't drift apart.

### Array methods and pipelines

This is the most involved part of the tracer, in the `stage` method.

When the rewritten code calls `__T.c(id, list, "filter", [callback])`:

1. The tracer starts a **stage**, which is one card in the diagram. All the
   methods chained within one statement share a **pipeline**, so
   `a.filter(…).map(…).reduce(…)` on one line becomes three cards in one
   diagram.
2. It records a `stage-start` frame: *"`filter` keeps only the items that pass a
   test. Starting with [12, 40, 7, 95, 23]."* The one-line descriptions come from
   a table called `METHOD_STORY`.
3. It **wraps your callback** in a small function of its own and calls the real
   method with that. Every time the method calls your callback, the wrapper lets
   your code run, then records the item, the result and what kind of thing this
   was (`transform`, `test`, `fold` or `compare`, depending on the method), and
   writes a `stage-item` frame: *"Does 95 pass `p < 50`? No, drop it."*
4. When the method is done, it records a `stage-end` frame with the final result.

A few details:

- **"Quiet" callbacks.** If your callback is a one-liner like `p => p * 1.2`, the
  card already says everything, so FlowJS *mutes* the hooks inside it, and you
  don't get separate "step into λ" frames for every item. If the callback is a
  multi-line block, the muting is off and you *do* see its inner steps (its
  variables, its `console.log`s) between the items. Try `forEach` with a block
  body to see the difference.
- **Sort reorders in place**, so after each comparison the tracer re-reads the
  array and stores that as the variable's new snapshot. In practice, Chrome's
  engine (V8) sorts a private copy and writes the result back at the very end, so
  the array looks unchanged until the sort finishes.
- **Strings.** `"a b c".split(" ")` is a traced method, but its receiver isn't a
  list, so no per-item animation exists. You get a simple `in → out` card.
- **After the statement ends**, the pipeline is copied forward (marked
  `stale`) onto the frames that follow, so the finished diagram doesn't vanish
  the instant the next line starts.

### Step 5: Replay (the screen)

[`App.jsx`](src/App.jsx) holds the whole thing together. The state that matters
is small:

| State | Meaning |
| --- | --- |
| `trace` | The result of the last run: `frames`, `output`, `pipelines`, `meta`, `error` |
| `index` | Which frame we're looking at |
| `playing` | Is the timer running? |
| `speed` | Milliseconds to wait between steps |

From these it works out one line: `frame = frames[index]`. Everything on screen
is drawn from that single frame:

| On screen | Drawn by | Reads from the frame |
| --- | --- | --- |
| Highlighted line and `▶` | `CodeEditor.jsx` | `line`, `endLine` |
| The sentence and step kind | `Narration.jsx` | `narr`, `kind`, `line` |
| The picture | `MomentView.jsx` | `kind` and its details |
| The pipeline cards | `PipelineView.jsx` | `pipe` |
| Output tab | `ConsoleView.jsx` | `outLen` (shows the first N lines) |
| Variables tab | `MemoryView.jsx` | `scope` |
| Call stack tab | `MemoryView.jsx` | `stack` |
| Steps tab | `StoryTrail.jsx` | all frames, highlighting `index` |
| Timeline | `Transport.jsx` | all frames (for the colored ticks) |

**Playing** is just a timer: wait, then `index + 1`, repeat until the last frame.
**Scrubbing** sets `index` to whatever you dragged to. **Jumping to a row** in
Steps does the same. Nothing else is needed, because the frame has the full
picture in it.

Two small rules keep the screen readable:

- **No doubling up.** When a pipeline is running, the pipeline *is* the
  picture, so the separate "moment" card steps aside instead of saying
  the same thing twice. Once the statement is over, the pipeline stays (dimmed)
  and the next line's own picture shows up next to it.
- **The Steps list only draws about 80 rows** around the current one. A long run
  can have thousands of frames, and rendering all of them would make the page
  crawl for no benefit.

Animation (cards sliding in, the fork lighting up, the ring filling) is done with
[Framer Motion](https://www.framer.com/motion/). It's only decoration and has no
effect on the logic.

### Read aloud

The **Read aloud** button (or `V`) speaks each step using the speech engine
that's already built into your browser. It's free, works offline, and needs no
API key. Three files are involved, each with one job:

- [`audio/script.js`](src/audio/script.js) turns a sentence into words that
  sound right. It's pure text in, text out. `p < 50` becomes "p is less than
  50", `u.name.toUpperCase()` becomes "u dot name dot to upper case", a list of
  records becomes "a list of 3 objects", and `0.30000000000000004` is rounded so
  nobody has to hear seventeen digits. The first time a run meets a new idea (a
  variable, an `if`, a loop, a function call, a `reduce`), it also adds one
  sentence explaining what that idea *is*, and never repeats it.
- [`audio/synth.js`](src/audio/synth.js) is the only file that touches the
  browser's `speechSynthesis`. It lists English voices (hiding the novelty ones
  macOS ships, like "Zarvox"), ranks the good ones first, and speaks.
- [`audio/useNarrator.js`](src/audio/useNarrator.js) keeps the voice and the
  timeline in step.

The important part is the last one: **with the voice on, the voice drives the
timeline**, not the other way round. A step ends when its sentence ends, plus a
short breath, so the picture never races ahead of the speech. Pausing cuts the
voice off, and resuming repeats the sentence that was cut short. Stepping by hand
speaks the step you land on. If the speech engine breaks or stalls, a watchdog
timer moves things along anyway, so silence can never freeze the replay.

It's off by default (audio that starts by itself is rude, and browsers block it
without a click anyway). The only thing saved is your chosen voice's name, in
the browser's local storage. If your browser has no speech support, the button
simply isn't shown.

### Limits, in one place

| Limit | Value | Where | What happens |
| --- | --- | --- | --- |
| Recorded steps | 3,200 | `LIMITS.frames` in `tracer.js` | Run stops, a note says it stopped early |
| Operations counted | 400,000 | `LIMITS.calls` | Same |
| Time for the program itself | 2 seconds | `LIMITS.seconds` | Same |
| Wait for timers left running | 1.5 seconds | `LIMITS.drainMs` | Then they're cancelled, with a note |
| Hard limit, from outside | 6 seconds | `HARD_LIMIT_MS` in `sandbox.js` | Worker is killed; "Got stuck" card, no trace |
| Items shown per pipeline card | 100 | `LIMITS.stageItems` | Card shows the first 100, marked cut off |
| `sort` comparisons shown | 60 | `LIMITS.comparisons` | Same |
| List items snapshotted | 60 | `MAX_ITEMS` in `value.js` | "+N more" |
| Object keys snapshotted | 40 | `MAX_KEYS` | "+N more" |
| Nesting depth snapshotted | 4 | `MAX_DEPTH` | Deeper levels drawn as `…` |
| String length snapshotted | 120 | `MAX_STRING` | Cut with `…` |

These are what turn `while (true) {}` into a helpful message. The loop keeps
calling `iter`, which counts, until the limit fires and the run is cut off
with *"Stopped early: this program produced more than 3,200 steps."* The
frames it did record are kept so you can see how the loop was behaving.

That covers anything that calls back into FlowJS: `while (true)`, `for (;;)`,
infinite recursion, loops inside callbacks, async loops and endless promise
chains. Once a limit has tripped it stays tripped, so a `try/catch` in your code
can't swallow it and carry on. The hard limit exists for the one thing that can't
be counted: code stuck *inside* a built-in, which never calls back at all.

---

## 6. What FlowJS can't do

It's worth being clear about the edges.

- **Your code runs in a worker, which is not a security boundary.** It has no
  access to the page (no `document`, no `window`, no `localStorage`), so it can't
  change FlowJS or read anything from it. But it can still use the network and the
  CPU like any script. It's a local, no-account tool for your own code; don't
  paste in code you don't understand and don't trust.
- **It's not a live debugger.** No breakpoints, no changing a variable mid-run.
  It's a recording, and you can't edit a recording.
- **A program stuck in a built-in leaves no trace.** The page stays responsive
  and the worker is stopped after 6 seconds, but code stuck inside a single native
  operation never reports back, so there is nothing to replay, only the "Got
  stuck" message. A program that allocates enormous amounts of memory can still
  take the tab down with it.
- **Asynchronous code isn't drawn.** Top-level `await` works, and things that
  happen while you're waiting are recorded in the order they occur, but there's
  no picture of the event loop or task queue. Async functions and generators run,
  but the call-stack view assumes each function finishes before the next
  starts, so interleaved ones can look odd. Timers left running when the
  program ends are waited for (up to 1.5 seconds) and included; after that they are
  cancelled, so a callback due later than that never appears.
- **No `import` or `require`.** The code is treated as a plain script, and there's
  no Node.js here, it's a browser.
- **Only what's in scope is shown.** The Variables tab lists variables that are
  visible at that line. It doesn't show `this`, or variables captured
  inside other functions' closures.
- **Only a set of array/string methods get the pipeline treatment.** Other calls
  just show up as ordinary function calls or steps.
- **`console.group`, `console.time`, `console.count` and similar** do nothing.
- **Editing while a replay is on screen.** The highlight keeps following the *old*
  run's line numbers until you press Run again.

---

## 7. Where everything lives

```
index.html            the page shell; loads fonts and src/main.jsx
vite.config.js        dev-server settings (port 5173) and worker format
public/               favicon.svg and favicon.png
scripts/favicon.mjs   regenerates public/favicon.svg from src/mascot.js

src/
  main.jsx            starts React and loads the stylesheets
  App.jsx             the conductor: run, keep `index`, playback timer, shortcuts, layout
  examples.js         the eight built-in programs
  mascot.js           the pixel-grid logo: one source for both the header and the favicon

  engine/             everything that understands JavaScript. No React in here.
    instrument.js       parse code, add hooks, print it back out, build the meta table
    tracer.js           the note-taker: hooks in, frames out. Also the sentences and pipelines
    run.js              runs the rewritten code, tracks its timers, catches errors, adds the closing frame
    sandbox.js          runs run.js in a Web Worker and enforces the hard time limit
    worker.js           the code that lives inside that worker
    problems.js         the shape of a run that produced no trace, only a reason
    value.js            copies runtime values into plain snapshots, and prints them as text

  audio/              everything about speech. No React except the hook.
    script.js           sentence → spoken words, plus the first-time explanations
    synth.js            the only file that touches the browser's speech engine
    useNarrator.js      keeps the voice and the timeline in step

  components/         the pictures
    CodeEditor.jsx      CodeMirror, plus the current-line highlight and ▶ marker
    Narration.jsx       the top bar and the sentence
    MomentView.jsx      one picture per kind of step (box, fork, ring, call…)
    PipelineView.jsx    the stack of cards for array methods
    MemoryView.jsx      the Variables and Call stack tabs
    ConsoleView.jsx     the Output tab
    StoryTrail.jsx      the Steps tab
    Transport.jsx       play, scrub bar, speed, colored timeline
    ValueView.jsx       draws any snapshot: chips, list cells, record cards
    ErrorBoundary.jsx   so one broken panel can't take the whole page down
    DotField.jsx        the twinkling dots in the background
    Mascot.jsx          the logo, blinking

  styles/
    base.css            colors, fonts, sizes (the tokens)
    app.css             the page layout and the two boxes
    visual.css          the diagrams
```

The split to remember: **`engine/` knows JavaScript and knows nothing about the
screen. `components/` knows the screen and nothing about how JavaScript was
traced.** They only meet through the frame format. That's why either side can
change without breaking the other.

---

## 8. Changing things

**Add an example.** Add an object to `EXAMPLES` in [`src/examples.js`](src/examples.js)
with an `id`, a `name`, a one-line `blurb` and the `code`. It shows up in the menu
on its own.

The eight that ship: *Array pipeline*, *Sorting numbers*, *Loops & conditions*,
*Recursion*, *Objects & shapes*, *Closures*, *Strings*, *Searching*. Each one is
picked to show a different shape of execution.

**Teach it another array method.** Add its name to `TRACED_METHODS` in
`instrument.js` and a one-line description to `METHOD_STORY` in `tracer.js`. If
its callback should behave like something new (not a transform, test, fold or
compare), look at `wrapCallback` in `tracer.js` and add a case.

**Change what a sentence says.** On-screen sentences are written in `tracer.js`
(in the hooks, plus `describeStep` and `describeItem` at the bottom). How they're
*spoken* is in `audio/script.js`.

**Change the limits.** The `LIMITS` object at the top of `tracer.js`.

**Change how a step looks.** Each kind of step has a small component in
`MomentView.jsx`, and its styling is in `styles/visual.css`.

**Restyle everything.** The colors, fonts and radii are tokens at the top of
`styles/base.css`.

**Redo the logo.** Edit the grid in `src/mascot.js`, then run `npm run favicon`
to rewrite `public/favicon.svg` from it.

---

## 9. Built with

| Library | Why it's here |
| --- | --- |
| [React](https://react.dev) 18 | The screen: each piece is a component that redraws from the current frame |
| [Vite](https://vitejs.dev) 5 | Dev server and build tool |
| [acorn](https://github.com/acornjs/acorn) | Reads JavaScript and produces the syntax tree |
| [astring](https://github.com/davidbonnet/astring) | Turns the modified tree back into JavaScript text |
| [CodeMirror 6](https://codemirror.net) (via `@uiw/react-codemirror`) | The code editor |
| [Framer Motion](https://www.framer.com/motion/) | The animation |

There's no backend and no database. The browser's built-in speech engine does
the voice.

---

## 10. Look and feel

The look is deliberate, so here's the short version.

- **Colors.** A cream page (`#FAF9F5`), near-black ink (`#141413`), and terracotta
  (`#D97757`) saved for two things only: actions and "you are here". Green,
  blue and mauve have fixed meanings (see section 3). Anything else stays neutral.
- **Type.** The sentence and headings are serif (Newsreader), the interface is
  sans (Inter), code is monospace (Source Code Pro). Georgia and the system fonts
  are the fallbacks.
- **Two boxes.** Same height, same 2px border, and a 64px bar across the top of
  each so their first lines line up. Inside a box, sections are separated by a
  single hairline rather than each being wrapped in its own frame.
- **The left box is dark** and the right is light. They share the same set of color
  variables, and the left one just swaps the neutral ones. So the same components
  work on both.
- **The background** is a faint grid of dots with a few of them twinkling. The
  grid is plain CSS. A canvas on top only draws the twinkling ones, at 30 frames a
  second, and never blocks clicks. If your system asks for reduced motion, the
  twinkling stops and the static grid stays.
- **The mascot** is a tiny pixel character defined once as a 12×12 grid in
  `src/mascot.js`. The header draws it (the eyes blink now and then), and
  `npm run favicon` writes the same grid out as the favicon.

---

## Glossary

Plain-language meanings for terms used above.

**Variable.** A labeled box that holds a value so the program can use it later.
`let age = 30` makes a box called `age` with 30 inside.

**Value.** A piece of data: a number, some text, `true`/`false`, a list, and so on.

**Array (or list).** An ordered row of values: `[12, 40, 7]`.

**Object.** A group of named values: `{ name: "Ada", score: 91 }`.

**Function.** A reusable block of code with a name. You *call* it, it does its
work, and it can *return* an answer.

**Call stack.** The program's memory of "which functions am I in the middle of".
When a function calls another, the new one goes on top. When it finishes, it's
removed and the program resumes in the one underneath.

**Recursion.** A function that calls itself, usually on a smaller version of the
problem, and stops at a simple case (the *base case*).

**Loop.** Code that repeats until a condition stops being true. Each repeat is
called an iteration or a round.

**Condition.** A question with a yes/no answer, like `i % 3 === 0`. An `if`
statement uses one to decide which path to take.

**Callback.** A function you hand to another function to be called later, often
once per item. In `prices.map(p => p * 2)`, `p => p * 2` is the callback.

**Closure.** A function that remembers the variables from where it was created,
even after that place has finished running.

**Syntax error.** Code that isn't valid JavaScript (a missing bracket, say), so
it can't even be read, let alone run.

**Syntax tree (AST).** A tree that describes the structure of code: what's a
loop, what's a call, what belongs inside what. Programs that read code, like
compilers, linters and FlowJS, work with this instead of raw text.

**Instrumenting.** Adding extra code to a program so that it reports on itself
while running.

**Frame** *(in FlowJS)*. One recorded moment in the replay: a line number, a
sentence, and a full copy of the variables and call stack at that moment. Don't
confuse it with a call-stack "frame", which is one open function call.

**Trace.** The full list of frames from one run, plus the console output.

**Snapshot.** A frozen copy of a value taken at one instant, so it can't change
afterwards.

---

Made by Aditya Dave ([@adityadave89](https://x.com/adityadave89)).
