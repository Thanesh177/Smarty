export const VIDEO_CONTROLS_IDLE_MS = 3500;
export const VIDEO_OPENING_BUFFER_SECONDS = 3;

function hasBufferedInterval(video, start, seconds) {
  const end = Math.min(Number.isFinite(video.duration) ? video.duration : Infinity, start + seconds);
  if (end <= start) return false;
  for (let index = 0; index < video.buffered.length; index++) {
    if (video.buffered.start(index) <= start + .05 && video.buffered.end(index) >= end - .05) return true;
  }
  return false;
}

export function hasPlaybackHeadroom(video) {
  return !video.paused && video.readyState >= 3 && hasBufferedInterval(video, video.currentTime, 3);
}

export function hasBufferedOpening(video) {
  return video.readyState >= 2 && hasBufferedInterval(video, 0, VIDEO_OPENING_BUFFER_SECONDS);
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
