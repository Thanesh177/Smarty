// Visual viewport bounds change when a phone's keyboard opens.
export function topicPickerPosition(trigger, viewport) {
  const inset = 12;
  const leftEdge = (viewport.left || 0) + inset;
  const topEdge = (viewport.top || 0) + inset;
  const rightEdge = (viewport.left || 0) + viewport.width - inset;
  const bottomEdge = (viewport.top || 0) + viewport.height - inset;
  const width = Math.min(320, Math.max(0, viewport.width - inset * 2));
  const below = bottomEdge - trigger.bottom - 8;
  const above = trigger.top - 8 - topEdge;
  const upward = below < Math.min(240, above) && above > below;
  const available = Math.max(0, Math.min(440, viewport.height - inset * 2));
  const space = upward ? above : below;
  const maxHeight = Math.min(available, space > 0 ? space : available);
  const desiredTop = upward ? trigger.top - 8 - maxHeight : trigger.bottom + 8;
  return {
    width,
    left: Math.max(leftEdge, Math.min(trigger.left, rightEdge - width)),
    top: Math.max(topEdge, Math.min(desiredTop, bottomEdge - maxHeight)),
    maxHeight,
  };
}
