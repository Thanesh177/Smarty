import { Component, Fragment } from 'react';
import { Link } from 'react-router-dom';
import './AppResilience.css';

export default class RouteErrorBoundary extends Component {
  state = { hasError: false, attempt: 0 };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error, errorInfo) {
    console.error('Route failed to render:', error, errorInfo);
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState(state => ({ hasError: false, attempt: state.attempt + 1 }));
    }
  }

  render() {
    if (this.state.hasError) return <section className="app-recovery-state" role="alert">
      <span className="app-recovery-kicker">A small interruption</span>
      <h1>This page couldn’t open.</h1>
      <p>Try opening it again, or return to your feed. Retrying won’t sign you out.</p>
      <div className="app-recovery-actions">
        <button type="button" onClick={() => this.setState(state => ({ hasError: false, attempt: state.attempt + 1 }))}>Try again</button>
        <Link to="/feed?topic=All">Go to feed</Link>
      </div>
    </section>;
    // A retry remounts only this page, never the authentication provider.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
