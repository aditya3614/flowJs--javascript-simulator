import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildScript } from './script.js';
import { supported, listVoices, onVoicesChanged, say, stopSpeech } from './synth.js';

/*
 * Keyed by the playback delays in Transport's SPEEDS. Speech is slowed a touch
 * at 0.5× and sped up at the faster settings, but never past 1.5×: beyond that
 * a synthetic voice stops being intelligible, which defeats the point.
 */
const RATE = new Map([[1600, 0.88], [850, 1], [420, 1.2], [190, 1.5]]);
/** Breath between one sentence ending and the next step starting. */
const GAP = new Map([[1600, 900], [850, 500], [420, 260], [190, 120]]);

const rateFor = (ms) => RATE.get(ms) ?? 1;
const gapFor = (ms) => GAP.get(ms) ?? 400;

const PREF = 'flowjs.voice';
const OLD_PREF = 'flowscope.voice';  // the product was renamed; keep anyone's saved voice
const readPref = () => {
  try { return window.localStorage.getItem(PREF) || window.localStorage.getItem(OLD_PREF) || ''; } catch { return ''; }
};
const writePref = (v) => { try { window.localStorage.setItem(PREF, v); } catch { /* private mode */ } };

function useVoices() {
  const [voices, setVoices] = useState(listVoices);
  useEffect(() => {
    const update = () => setVoices(listVoices());
    update();
    return onVoicesChanged(update);
  }, []);
  return voices;
}

/**
 * Reads each step aloud and tells playback when the sentence is finished, so
 * the timeline waits for the voice instead of racing ahead of it.
 *
 * Rules, in the order they matter:
 *  - Off by default, and never remembered as "on": audio that starts by itself
 *    is rude, and browsers block it without a user gesture anyway.
 *  - Playing: each step is spoken, and `ready` goes true when it ends.
 *  - Paused mid-sentence: the speech is cut, and resumes from the start of
 *    that sentence.
 *  - Stepping by hand (even while paused): the new step is spoken.
 *  - If the engine fails or stalls, `ready` still goes true — silence must
 *    never freeze the replay.
 */
export function useNarrator({ trace, frames, index, playing, speed }) {
  const voices = useVoices();
  const [on, setOn] = useState(false);
  const [voiceName, setVoiceNameState] = useState(readPref);
  const [speaking, setSpeaking] = useState(false);
  const [doneKey, setDoneKey] = useState(null);

  const tokenRef = useRef(0);          // identifies the utterance we still care about
  const spokenRef = useRef(null);      // the step we have spoken, or are speaking
  const speakingRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const script = useMemo(() => (supported ? buildScript(trace) : []), [trace]);
  const voice = useMemo(
    () => voices.find((v) => v.name === voiceName) || voices[0] || null,
    [voices, voiceName],
  );
  const voiceKey = voice ? voice.name : '';
  const key = frames.length ? `${trace.runId}:${index}` : null;

  const stop = useCallback(() => {
    tokenRef.current += 1;
    speakingRef.current = false;
    setSpeaking(false);
    stopSpeech();
  }, []);

  // A different voice restarts the current sentence in it.
  useEffect(() => { spokenRef.current = null; }, [voiceKey]);

  useEffect(() => {
    if (!supported) return;

    if (!on || !key) { stop(); spokenRef.current = null; return; }

    if (spokenRef.current === key) {
      // Already handled. The only thing left to do is honour a pause.
      if (!playing && speakingRef.current) { stop(); spokenRef.current = null; }
      return;
    }

    const token = ++tokenRef.current;
    const text = script[index] || '';
    const rate = rateFor(speedRef.current);
    spokenRef.current = key;
    speakingRef.current = true;
    setSpeaking(true);
    setDoneKey(null);

    let watchdog = null;
    const finish = () => {
      if (tokenRef.current !== token) return; // superseded or cancelled
      clearTimeout(watchdog);
      speakingRef.current = false;
      setSpeaking(false);
      setDoneKey(key);
    };
    // Some engines never fire `end`. Bound the wait by how long the text should take.
    watchdog = setTimeout(finish, Math.max(4000, (text.length * 110) / rate) + 2500);

    if (!text) { finish(); return; }
    say(text, { voice, rate, onEnd: finish, onError: finish });
  }, [on, key, index, playing, script, voiceKey, voice, stop]);

  const toggle = useCallback(() => setOn((v) => !v), []);
  const setVoiceName = useCallback((name) => { setVoiceNameState(name); writePref(name); }, []);

  return {
    supported,
    on,
    toggle,
    voices,
    voiceName: voiceKey,
    setVoiceName,
    speaking,
    /** True when nothing is left to say for the current step. */
    ready: !on || doneKey === key,
    /** How long to pause after a sentence before moving to the next step. */
    gap: gapFor(speed),
  };
}
