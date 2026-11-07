export const VIDEO_CONTROLS_IDLE_MS = 3500;

export function hasPlaybackHeadroom(video) {
  if (video.paused || video.readyState < 3 || video.currentTime < .75) return false;
  const ahead = Math.min(Number.isFinite(video.duration) ? video.duration : Infinity, video.currentTime + 4);
  for (let index = 0; index < video.buffered.length; index++) {
    if (video.buffered.start(index) <= video.currentTime && video.buffered.end(index) >= ahead - .05) return true;
  }
  return false;
}

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
