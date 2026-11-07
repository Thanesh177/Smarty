const MIB = 1024 * 1024;

export function canPrepareVideo(file, platform = globalThis) {
  return /^(?:video\/(?:mp4|quicktime|x-m4v))$/i.test(file?.type || '')
    && file.size >= 8 * MIB && file.size <= 128 * MIB
    && typeof platform.Worker === 'function' && typeof platform.VideoEncoder === 'function'
    && typeof platform.VideoDecoder === 'function' && typeof platform.BigInt === 'function';
}

export function isWorthKeeping(originalBytes, preparedBytes) {
  return preparedBytes > 0 && originalBytes - preparedBytes >= Math.max(.5 * MIB, originalBytes * .12);
}
