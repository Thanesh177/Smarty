import "./FeedSkeleton.css";

export default function FeedSkeleton() {
  return (
    <div className="feed-skeleton-wrap">
      {[1, 2, 3].map((item) => (
        <div className="feed-skeleton-card" key={item}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-pill" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-actions" />
        </div>
      ))}
    </div>
  );
}