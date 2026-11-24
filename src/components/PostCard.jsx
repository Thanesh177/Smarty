import { motion } from 'framer-motion';
import PostAuthor from './PostAuthor';
import PostVocabulary from './PostVocabulary';
import usePostVocabulary from '../hooks/usePostVocabulary';

export default function PostCard({ post, onLike, onSave }) {
  const vocabulary = usePostVocabulary(post);
  return (
    <motion.article
      className="post-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="tag">{post.topic}</span>
      <h2><PostVocabulary text={post.title} terms={vocabulary}/></h2>
      <p><PostVocabulary text={post.body} terms={vocabulary}/></p>
      <div className="post-footer">
        <span>By <PostAuthor post={post} /></span>
        <div className="actions">
          <button onClick={() => onLike(post.id)}>❤️ {post.likes}</button>
          <button onClick={() => onSave(post.id)}>{post.saved ? '★ Saved' : '☆ Save'}</button>
        </div>
      </div>
    </motion.article>
  );
}
