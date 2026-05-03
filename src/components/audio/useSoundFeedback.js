export default function useSoundFeedback() {
  const playTone = (frequency, duration = 120) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);
  };

  return {
    correct: () => playTone(740, 120),
    wrong: () => playTone(180, 180),
    levelUp: () => playTone(980, 260),
    click: () => playTone(420, 80),
  };
}