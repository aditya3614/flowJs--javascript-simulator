/**
 * A thin layer over the browser's speech engine (Web Speech API).
 *
 * This is the only file that touches `speechSynthesis`. Swapping in a cloud
 * voice later means replacing `say` and `stopSpeech` — the script that decides
 * *what* to say, and the hook that keeps it in step with playback, stay as is.
 */

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';

/*
 * macOS ships a set of novelty voices (Zarvox, Bubbles, Bad News…). They are
 * listed as English voices and would be a dreadful thing to explain code with.
 */
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Princess|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/;

/** Higher is better. Prefers the neural / enhanced voices when the system has them. */
function score(v) {
  let n = 0;
  if (/premium|enhanced|natural|neural/i.test(v.name)) n += 4;
  if (/google/i.test(v.name)) n += 2;
  if (/samantha|ava|allison|serena|daniel|karen|moira|tessa|zoe|aaron/i.test(v.name)) n += 1;
  if (/^en[-_]US/i.test(v.lang)) n += 1;
  return n;
}

/** English voices only, best first. */
export function listVoices() {
  if (!supported) return [];
  return synth.getVoices()
    .filter((v) => /^en/i.test(v.lang) && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/** Subscribe to the voice list, which browsers populate asynchronously. */
export function onVoicesChanged(fn) {
  if (!supported) return () => {};
  synth.addEventListener('voiceschanged', fn);
  return () => synth.removeEventListener('voiceschanged', fn);
}

let current = null; // held so the utterance is not garbage-collected before it ends

export function stopSpeech() {
  current = null;
  if (supported) synth.cancel();
}

/**
 * Speak `text`. `onEnd` fires when it finishes; `onError` if the engine
 * refuses (for example, before the page has had a user gesture).
 */
export function say(text, { voice, rate = 1, onEnd, onError }) {
  if (!supported) { if (onError) onError(); return; }

  const u = new window.SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  u.rate = rate;
  u.pitch = 1;
  u.volume = 1;
  u.onend = () => { if (current === u) current = null; if (onEnd) onEnd(); };
  u.onerror = (e) => {
    // Cancelling our own speech raises "interrupted"/"canceled"; that is not a failure.
    if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
    if (current === u) current = null;
    if (onError) onError(e);
  };

  stopSpeech();
  current = u;
  // Chrome can silently drop a speak() issued in the same tick as a cancel().
  setTimeout(() => {
    if (current !== u) return;
    synth.resume();
    synth.speak(u);
  }, 30);
}
