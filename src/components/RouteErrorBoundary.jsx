import { Component, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { isChunkLoadFailure } from '../lib/chunkRecovery.js';
import './AppResilience.css';

export default class RouteErrorBoundary extends Component {
  state = { hasError: false, needsReload: false, offline: false, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { hasError: true, needsReload: isChunkLoadFailure(error), offline: false };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Route failed to render:', error, errorInfo);
  }

  componentDidUpdate(previous) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.resetPage();
    }
  }

  resetPage = () => {
    this.setState(state => ({ hasError: false, needsReload: false, offline: false, attempt: state.attempt + 1 }));
  };

  retry = () => {
    if (!this.state.needsReload) return this.resetPage();
    // React.lazy remembers a rejected import. Remounting this screen cannot
    // load a replaced release asset, but refreshing the document can.
    if (navigator.onLine === false) return this.setState({ offline: true });
    window.location.reload();
  };

  render() {
    const { hasError, needsReload, offline, attempt } = this.state;
    if (hasError && this.props.silent) return null;
    if (hasError) return <section className="app-recovery-state" role="alert">
      <span className="app-recovery-kicker">A small interruption</span>
      <h1>This page couldn’t open.</h1>
      <p>{offline ? 'Reconnect to the internet, then reload Smarty.' : needsReload
        ? 'Part of the app didn’t load. Reload Smarty to try again. You’ll stay signed in.'
        : 'Try opening it again, or return to your feed. Retrying won’t sign you out.'}</p>
      <div className="app-recovery-actions">
        <button type="button" onClick={this.retry}>{needsReload ? 'Reload Smarty' : 'Try again'}</button>
        <Link to="/feed?topic=All">Go to feed</Link>
      </div>
    </section>;
    // A retry remounts only this page, never the authentication provider.
    return <Fragment key={attempt}>{this.props.children}</Fragment>;
  }
}
