import './NewsLoading.css';

const COPY = {
  briefing: ['Opening your daily briefing', 'The day’s reporting, brought into focus.'],
  reports: ['Opening the newsroom', 'Making room for the stories that matter.'],
  story: ['Opening the story', 'Bringing its reporting into view.'],
};

export default function NewsLoading({ kind = 'reports', inline = false, standalone = false }) {
  const [title, detail] = COPY[kind] || COPY.reports;
  return <div className={`news-loading${inline ? ' news-loading--inline' : ''}${standalone ? ' news-loading--standalone' : ''}`} role="status" aria-live="polite">
    <div className="news-loading-heading">
      <span className="news-loading-paper" aria-hidden="true"><i /><i /><i /><i /></span>
      <div><span className="news-loading-label">Smarty / news</span>
        <strong>{inline ? 'Preparing today’s briefing' : title}</strong>
        <p>{inline ? 'Reports are ready below. You can keep reading.' : detail}</p>
      </div>
    </div>
    {!inline && <div className="news-loading-preview" aria-hidden="true">
      {[0, 1, 2].map(index => <div className="news-loading-story" key={index}>
        <span /><i /><i /><i />
      </div>)}
    </div>}
  </div>;
}
