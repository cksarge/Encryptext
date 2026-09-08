import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * Catches render-time crashes so the user sees the error text instead of a
 * blank page. Without this, one thrown error unmounts the whole React tree.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Encryptext] render error:', error, info)
    this.setState({ info })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0d0f17',
          color: '#e6e9f5',
          fontFamily: 'ui-monospace, Menlo, monospace',
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <h1 style={{ fontSize: '1.1rem', color: '#ff7a7a' }}>
          Encryptext hit a runtime error
        </h1>
        <p style={{ opacity: 0.8, fontSize: '0.85rem' }}>
          Copy this and send it over. Then check the browser console for the full
          stack.
        </p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#161925',
            border: '1px solid #2a2f42',
            borderRadius: 8,
            padding: '1rem',
            fontSize: '0.8rem',
          }}
        >
          {error.name}: {error.message}
          {'\n\n'}
          {error.stack}
          {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ''}
        </pre>
      </div>
    )
  }
}
