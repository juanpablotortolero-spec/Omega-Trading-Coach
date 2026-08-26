import { Component, type ErrorInfo, type ReactNode } from 'react';
import OmegaMark from './OmegaMark';

type Props = { children: ReactNode };
type State = { hasError: boolean };

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary capturó un error de render:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-shell">
          <div className="panel error-boundary-panel">
            <OmegaMark size={40} />
            <h2>Error en la interfaz</h2>
            <p className="hint-text">Por favor recarga la página. Tus datos ya guardados no se ven afectados.</p>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
