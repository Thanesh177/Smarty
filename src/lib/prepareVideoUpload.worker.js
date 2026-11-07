import { BlobSource, BufferSource, BufferTarget, Conversion, Input, MP4, Mp4OutputFormat, Output, QTFF, Quality } from 'mediabunny';
import { isWorthKeeping } from './videoUploadPolicy.js';

async function inspectTracks(input) {
  const tracks = await input.getTracks();
  const video = tracks.find(track => track.type === 'video');
  const audio = tracks.find(track => track.type === 'audio');
  if (!video || tracks.length !== (audio ? 2 : 1)) return null;
  const [codec, width, height, hdr, rotation, flip, duration, audioCodec, audioDuration] = await Promise.all([
    video.getCodec(), video.getDisplayWidth(), video.getDisplayHeight(), video.hasHighDynamicRange(),
    video.getRotation(), video.getFlip(), video.computeDuration(), audio?.getCodec(), audio?.computeDuration(),
  ]);
  return { codec, width, height, hdr, rotation, flip, duration, audioCodec, audioDuration };
}

self.onmessage = async ({ data: file }) => {
  let input, verified;
  try {
    input = new Input({ source: new BlobSource(file), formats: [MP4, QTFF] });
    const source = await inspectTracks(input);
    // Leave HDR, uncommon codecs, extra tracks and long/high-resolution clips alone.
    // AAC is copied without re-encoding. Never resize, crop, trim or set an output frame rate.
    if (!source || source.codec !== 'avc' || source.hdr || !Number.isFinite(source.duration) || source.duration <= 0 || source.duration > 120
      || Math.max(source.width, source.height) > 1920 || source.width * source.height > 1920 * 1080
      || (source.audioDuration !== undefined && source.audioCodec !== 'aac')) {
      self.postMessage({ type: 'original' }); return;
    }
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const conversion = await Conversion.init({
      input, output,
      video: { codec: 'avc', quality: new Quality('very-high'), keyFrameInterval: 2 },
      audio: { codec: 'aac' },
    });
    if (!conversion.isValid || conversion.discardedTracks.length) {
      self.postMessage({ type: 'original' }); return;
    }
    let previousProgress = -5;
    conversion.onProgress = fraction => {
      const value = Math.min(99, Math.floor(fraction * 100));
      if (value - previousProgress >= 5) {
        previousProgress = value;
        self.postMessage({ type: 'progress', value });
      }
    };
    await conversion.execute();
    const buffer = target.buffer;
    if (!isWorthKeeping(file.size, buffer?.byteLength || 0)) {
      self.postMessage({ type: 'original' }); return;
    }
    verified = new Input({ source: new BufferSource(buffer), formats: [MP4] });
    const result = await inspectTracks(verified);
    if (!result || result.codec !== source.codec || !Number.isFinite(result.duration)
      || result.width !== source.width || result.height !== source.height || result.hdr !== source.hdr
      || result.rotation !== source.rotation || result.flip !== source.flip || result.audioCodec !== source.audioCodec
      || Math.abs(result.duration - source.duration) > .12 || Math.abs(result.audioDuration - source.audioDuration) > .12) {
      self.postMessage({ type: 'original' }); return;
    }
    self.postMessage({ type: 'prepared', buffer }, [buffer]);
  } catch {
    self.postMessage({ type: 'original' });
  } finally {
    verified?.dispose();
    input?.dispose();
  }
};
