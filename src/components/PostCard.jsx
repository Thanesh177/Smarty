import { motion } from 'framer-motion';

export default function PostCard({ post, onLike, onSave }) {
  return (
    <motion.article
      className="post-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="tag">{post.topic}</span>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
      <div className="post-footer">
        <span>By {post.author}</span>
        <div className="actions">
          <button onClick={() => onLike(post.id)}>❤️ {post.likes}</button>
          <button onClick={() => onSave(post.id)}>{post.saved ? '★ Saved' : '☆ Save'}</button>
        </div>
      </div>
    </motion.article>
  );
}
