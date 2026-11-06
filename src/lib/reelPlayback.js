export const VIDEO_CONTROLS_IDLE_MS = 3500;

// Start inside the gesture when one exists. Outside a gesture, Safari and
// other browsers may allow inline playback only with sound off.
export async function startReelPlayback(video, { muted, allowMutedFallback, isCurrent }) {
  if (!isCurrent()) return false;
  video.muted = muted;
  try {
    await video.play();
  } catch (error) {
    if (!allowMutedFallback || muted || error?.name !== 'NotAllowedError' || !isCurrent()) return false;
    video.muted = true;
    try { await video.play(); } catch { return false; }
  }
  return isCurrent();
}
