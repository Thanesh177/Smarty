export const VIDEO_TOPICS = [
  { id: 'how-it-works', label: 'How things work', detail: 'Machines, everyday objects and the ideas behind them.' },
  { id: 'science', label: 'Science & experiments', detail: 'Physics, chemistry, demonstrations and discoveries.' },
  { id: 'space', label: 'Space & astronomy', detail: 'The night sky, planets and the wider universe.' },
  { id: 'technology', label: 'Tech & AI', detail: 'Computing, engineering, AI and digital tools.' },
  { id: 'nature', label: 'Nature & wildlife', detail: 'Animals, plants, oceans and ecosystems.' },
  { id: 'mind-body', label: 'Mind & body', detail: 'Psychology, the senses and human biology.' },
  { id: 'history-culture', label: 'History & culture', detail: 'Real events, places, people and traditions.' },
  { id: 'art-design', label: 'Art & design', detail: 'Creative processes, visual ideas and techniques.' },
  { id: 'study-skills', label: 'Study & practical skills', detail: 'A useful method, a worked example or a skill to try.' },
];

export const getVideoTopic = id => VIDEO_TOPICS.find(topic => topic.id === id) || null;
export const videoTopicLabel = topic => `Video: ${topic.label}`;
export const getPublishedVideoTopic = value => typeof value === 'string'
  ? VIDEO_TOPICS.find(topic => videoTopicLabel(topic).toLowerCase() === value.trim().toLowerCase()) || null
  : null;

export const videoFeedPath = category => category
  ? '/feed?topic=Video&category=' + encodeURIComponent(category)
  : '/feed?topic=Video';
export const videoUploadPath = category => category
  ? '/create/video?category=' + encodeURIComponent(category)
  : '/create/video';

export function matchesVideoTopic(post, category) {
  if (!category) return true;
  return [post?.topic, post?.category, post?.topics, post?.categories].flat()
    .some(value => typeof value === 'string' && value.split(',')
      .some(label => getPublishedVideoTopic(label)?.id === category));
}
