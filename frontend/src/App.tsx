import { useState, useEffect, useCallback } from 'react';
import GraphView from './components/Graph/GraphView';
import QueryView from './components/QueryView/QueryView';
import OntologyView from './components/OntologyView/OntologyView';
import InfoSidebar from './components/InfoSidebar/InfoSidebar';
import TopBar from './components/TopBar/TopBar';
import IngestModal from './components/IngestModal/IngestModal';
import VoicePanel from './components/VoicePanel/VoicePanel';
import ThoughtStream from './components/ThoughtStream/ThoughtStream';
import ActivityPanel from './components/ActivityPanel/ActivityPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useGraphStore } from './stores/graphStore';
import { useVoiceStore } from './stores/voiceStore';


export type View = 'graph' | 'query' | 'ontology';

/** Fetch graph from API and load into store. Returns node count. */
async function fetchAndLoadGraph(): Promise<number> {
  const resp = await fetch('/api/graph');
  const data = await resp.json();
  if (!data.nodes?.length) return 0;

  const nodes = data.nodes.map((n: any) => ({
    id: n.id,
    label: n.properties?.name || n.label || n.id,
    type: n.labels?.[0] || n.properties?.entity_type || n.type || 'Entity',
    properties: n.properties || {},
  }));
  const edges = (data.edges || []).map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.type || e.label || '',
    properties: e.properties || {},
  }));
  useGraphStore.getState().setGraph(nodes, edges);
  return nodes.length;
}

function App() {
  const { playChunk } = useAudioPlayback();
  const { sendEvent } = useWebSocket(playChunk);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const isThinking = useGraphStore((s) => s.isThinking);
  const [currentView, setCurrentView] = useState<View>('graph');
  const [showIngest, setShowIngest] = useState(false);
  const [chatText, setChatText] = useState('');

  const handleChatSubmit = useCallback(() => {
    const trimmed = chatText.trim();
    if (!trimmed || isThinking) return;
    sendEvent({ type: 'text_input', text: trimmed });
    setChatText('');
  }, [chatText, isThinking, sendEvent]);

  // Fetch graph on mount
  useEffect(() => {
    fetchAndLoadGraph().catch(() => {});
  }, []);

  // Keyboard shortcut: Ctrl+Shift+T to load test graph
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const count = prompt('How many test nodes?', '1000');
        if (!count) return;
        fetch(`/api/test/generate?n=${count}`)
          .then((r) => r.json())
          .then((data) => {
            useGraphStore.getState().setGraph(data.nodes, data.edges);
          })
          .catch((err) => alert('Failed: ' + err.message));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: '52px 1fr 64px',
        gridTemplateColumns: selectedNodeId && currentView === 'graph' ? '280px 1fr 320px' : '280px 1fr',
        gridTemplateAreas: selectedNodeId && currentView === 'graph'
          ? `"nav nav nav" "left main right" "bar bar bar"`
          : `"nav nav" "left main" "bar bar"`,
        gap: '8px',
        padding: '10px',
        zIndex: 1,
      }}
    >
      {/* Nav — Row 1 */}
      <div style={{ gridArea: 'nav' }}>
        <TopBar
          currentView={currentView}
          onViewChange={setCurrentView}
          onIngest={() => setShowIngest(true)}
        />
      </div>

      {/* Left panel — Activity / Agent Trace */}
      <div style={{ gridArea: 'left', overflow: 'hidden' }}>
        <ActivityPanel />
      </div>

      {/* Main content — Graph / Query / Ontology */}
      <div style={{ gridArea: 'main', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
        {currentView === 'graph' && <GraphView />}
        {currentView === 'query' && <QueryView sendEvent={sendEvent} />}
        {currentView === 'ontology' && <OntologyView />}

        {/* ThoughtStream overlay — top right of graph */}
        <div className="absolute top-4 right-4 z-10">
          <ThoughtStream />
        </div>
      </div>

      {/* Right panel — Node detail (only when node selected on graph view) */}
      {currentView === 'graph' && selectedNodeId && (
        <div style={{ gridArea: 'right', overflow: 'hidden' }}>
          <InfoSidebar />
        </div>
      )}

      {/* Voice bar — Row 3 */}
      <div style={{ gridArea: 'bar' }} className="glass-1 flex items-center px-4 gap-3">
        {/* Recent queries */}
        <div className="flex gap-1.5 flex-shrink-0 overflow-x-auto max-w-[220px]" style={{ scrollbarWidth: 'none' }}>
          {useVoiceStore.getState().transcript.slice(-3).filter(t => t.role === 'user').map((t, i) => (
            <button
              key={i}
              onClick={() => { setChatText(t.text); }}
              className="glass-3 whitespace-nowrap text-[11px] font-normal px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              style={{ letterSpacing: '-0.01em' }}
            >
              {t.text.length > 20 ? t.text.slice(0, 20) + '...' : t.text}
            </button>
          ))}
        </div>

        {/* Voice input wrap */}
        <div className="flex-1 flex items-center gap-2.5 glass-2 h-10 px-3.5 rounded-xl">
          <input
            type="text"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
            placeholder="Ask anything about the knowledge graph..."
            disabled={isThinking}
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-40"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          {/* Send button */}
          <button
            onClick={handleChatSubmit}
            disabled={isThinking || !chatText.trim()}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{
              background: 'linear-gradient(135deg, #6b8dd6, #9b6bd6)',
              color: '#fff',
            }}
          >
            Ask
          </button>
          {/* Mic button */}
          <VoicePanel sendEvent={sendEvent} />
        </div>

        {/* Agent status */}
        <div className="glass-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: isThinking ? '#96b8f0' : '#96e0b8',
              boxShadow: isThinking ? '0 0 6px rgba(150,184,240,0.6)' : '0 0 6px rgba(150,224,184,0.6)',
              animation: isThinking ? 'blink 0.8s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[11px] font-medium text-text-secondary" style={{ letterSpacing: '0.01em' }}>
            {isThinking ? 'Thinking...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Ingest modal */}
      {showIngest && <IngestModal onClose={() => setShowIngest(false)} />}
    </div>
  );
}

export default App;
