// Unsplash documents auto=format and width variants. Other providers and
// signed user uploads must retain their exact URL, including query strings.
export function responsiveImage(source) {
  let url;
  try { url = new URL(source); } catch { return { src: source }; }
  if (url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com') return { src: source };
  const variant = width => {
    const next = new URL(url);
    next.searchParams.set('auto', 'format');
    next.searchParams.delete('fm');
    next.searchParams.set('w', String(width));
    return next.href;
  };
  return {
    src: variant(960),
    srcSet: [480, 960, 1440].map(width => `${variant(width)} ${width}w`).join(', '),
    sizes: '(max-width: 700px) 100vw, 60vw',
  };
}
