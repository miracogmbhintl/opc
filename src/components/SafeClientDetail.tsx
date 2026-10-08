import { Component, type ErrorInfo, type ReactNode } from 'react';
import ClientDetail from './ClientDetail';

type Props = { clientId: string; baseUrl?: string };
type State = { crashed: boolean };

export default class SafeClientDetail extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State { return { crashed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OPC ClientDetail recovery]', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.crashed) return <ClientDetail {...this.props} />;
    return (
      <main role="alert" style={{ padding: 32, maxWidth: 720, margin: '32px auto', color: '#111827' }}>
        <h2>Kundenansicht konnte nicht angezeigt werden.</h2>
        <p>Die Kundendaten wurden nicht gelöscht. Bitte die Seite neu laden.</p>
        <button type="button" onClick={() => this.setState({ crashed: false })}>Erneut versuchen</button>
        {' '}
        <a href="/kunden">Zurück zur Kundenübersicht</a>
      </main>
    );
  }
}
