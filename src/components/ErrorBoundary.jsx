import React from 'react';

/** Keeps a rendering fault in one panel instead of blanking the whole page. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="boundary">
        <p className="boundary__title">{this.props.label || 'This panel'} could not be drawn.</p>
        <p className="boundary__msg mono">{String(this.state.error.message || this.state.error)}</p>
        <button className="boundary__btn" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
