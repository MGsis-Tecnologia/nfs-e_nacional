import React from 'react';
import { AlertCircle } from 'lucide-react';

// Captura erros de render de qualquer componente filho e mostra a mensagem
// na tela, em vez de desmontar a aplicação inteira (tela "sumindo").
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Erro de render capturado:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ maxWidth: '900px', margin: '0 auto', borderColor: 'var(--color-error)' }}>
          <h3 style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} /> Ocorreu um erro ao exibir esta tela
          </h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={this.reset}>
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
