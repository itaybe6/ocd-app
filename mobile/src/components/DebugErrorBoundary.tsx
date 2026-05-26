import React from 'react';
import { ScrollView, Text, View, Platform } from 'react-native';

type Props = { children: React.ReactNode };
type State = {
  error: Error | null;
  info: string | null;
  logs: string[];
};

let originalError: typeof console.error | null = null;
let originalWarn: typeof console.warn | null = null;
const inMemoryLogs: string[] = [];
const listeners = new Set<(logs: string[]) => void>();

function pushLog(prefix: string, args: unknown[]) {
  const text = args
    .map((a) => {
      try {
        if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ''}`;
        if (typeof a === 'string') return a;
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
  const line = `[${prefix}] ${text}`;
  inMemoryLogs.push(line);
  if (inMemoryLogs.length > 200) inMemoryLogs.shift();
  listeners.forEach((l) => l([...inMemoryLogs]));
}

if (!originalError) {
  originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushLog('ERROR', args);
    originalError?.(...args);
  };
}
if (!originalWarn) {
  originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    pushLog('WARN', args);
    originalWarn?.(...args);
  };
}

const previousGlobalHandler =
  typeof ErrorUtils !== 'undefined' ? ErrorUtils.getGlobalHandler?.() : undefined;
if (typeof ErrorUtils !== 'undefined') {
  ErrorUtils.setGlobalHandler?.((err: Error, isFatal?: boolean) => {
    pushLog(isFatal ? 'FATAL' : 'GLOBAL', [err]);
    previousGlobalHandler?.(err, isFatal);
  });
}

export class DebugErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null, logs: [...inMemoryLogs] };
  private unsubscribe: (() => void) | null = null;

  componentDidMount() {
    const listener = (logs: string[]) => this.setState({ logs });
    listeners.add(listener);
    this.unsubscribe = () => listeners.delete(listener);
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    pushLog('REACT', [error, info.componentStack]);
    this.setState({ error, info: info.componentStack });
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#1a0000', paddingTop: Platform.OS === 'ios' ? 60 : 30 }}
          contentContainerStyle={{ padding: 16 }}
        >
          <Text style={{ color: '#ff6b6b', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            App crashed
          </Text>
          <Text selectable style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>
            {this.state.error.name}: {this.state.error.message}
          </Text>
          <Text selectable style={{ color: '#fbbf24', fontSize: 11, fontFamily: 'Menlo', marginBottom: 16 }}>
            {this.state.error.stack}
          </Text>
          {this.state.info ? (
            <>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
                Component stack:
              </Text>
              <Text selectable style={{ color: '#a5b4fc', fontSize: 11, fontFamily: 'Menlo', marginBottom: 16 }}>
                {this.state.info}
              </Text>
            </>
          ) : null}
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
            Logs ({this.state.logs.length}):
          </Text>
          {this.state.logs.map((l, i) => (
            <Text key={i} selectable style={{ color: '#86efac', fontSize: 10, fontFamily: 'Menlo', marginBottom: 4 }}>
              {l}
            </Text>
          ))}
        </ScrollView>
      );
    }
    return <>{this.props.children}</>;
  }
}

/** Floating overlay that shows recent warn/error logs on top of any screen. Useful for debugging blank/white-screen issues. */
export function DebugLogOverlay() {
  const [logs, setLogs] = React.useState<string[]>([...inMemoryLogs]);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    const listener = (l: string[]) => setLogs(l);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  if (logs.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 8,
        right: 8,
        maxHeight: expanded ? '80%' : 120,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 6,
        padding: 8,
        zIndex: 9999,
      }}
    >
      <Text
        onPress={() => setExpanded((e) => !e)}
        style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}
      >
        {expanded ? 'tap to collapse' : `tap to expand (${logs.length} logs)`}
      </Text>
      <ScrollView>
        {logs.slice(-30).map((l, i) => (
          <Text key={i} selectable style={{ color: '#86efac', fontSize: 9, fontFamily: 'Menlo', marginBottom: 2 }}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
