// Browser alerts for match events. Sounds use Web Audio (no asset files).
// System notifications + tab title are the reliable path when the tab is hidden:
// browsers pause polling by default and often block starting audio in the background.

let audioCtx: AudioContext | null = null;
let titleRestore: string | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

export function tabIsForeground(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

/** Create/resume AudioContext during a user gesture so later turns can beep. */
export function unlockAudio() {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
}

export function armAlerts() {
  if (typeof window === "undefined") return;
  unlockAudio();
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function tone(ac: AudioContext, frequency: number, duration: number, when = 0, type: OscillatorType = "sine", gain = 0.15) {
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

async function withRunningAudio(play: (ac: AudioContext) => void) {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") {
    try {
      await ac.resume();
    } catch {
      return;
    }
  }
  if (ac.state !== "running") return;
  play(ac);
}

export function playChatSound() {
  void withRunningAudio((ac) => {
    tone(ac, 880, 0.12, 0, "triangle", 0.12);
    tone(ac, 1320, 0.14, 0.08, "triangle", 0.1);
  });
}

export function playTurnSound() {
  void withRunningAudio((ac) => {
    tone(ac, 660, 0.18, 0, "sine", 0.18);
    tone(ac, 990, 0.22, 0.12, "sine", 0.16);
    tone(ac, 1320, 0.26, 0.24, "sine", 0.14);
  });
}

export function flashTabTitle(message: string) {
  if (typeof document === "undefined") return;
  if (tabIsForeground()) return;
  if (titleRestore == null) titleRestore = document.title;
  document.title = message;
}

export function restoreTabTitle() {
  if (typeof document === "undefined") return;
  if (titleRestore == null) return;
  document.title = titleRestore;
  titleRestore = null;
}

export function showNotification(title: string, body: string, tag?: string) {
  if (typeof window === "undefined") return;
  if (tabIsForeground()) return;
  flashTabTitle(title);
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const opts: NotificationOptions = { body, tag, silent: false };
  const native = () => {
    try {
      const n = new Notification(title, opts);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* ignore */
    }
  };
  const sw = navigator.serviceWorker;
  if (sw?.getRegistration) {
    sw.getRegistration()
      .then((reg) => {
        if (reg?.showNotification) return reg.showNotification(title, opts);
        native();
      })
      .catch(native);
    return;
  }
  native();
}
