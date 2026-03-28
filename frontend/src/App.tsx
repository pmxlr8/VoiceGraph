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
  const isPanelOpen = useVoiceStore((s) => s.isPanelOpen);
  const setPanelOpen = useVoiceStore((s) => s.setPanelOpen);
  const isRecording = useVoiceStore((s) => s.isRecording);
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
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: '#050507' }}>
      {/* Top bar */}
      <TopBar
        currentView={currentView}
        onViewChange={setCurrentView}
        onIngest={() => setShowIngest(true)}
      />

      {/* Main content area — below top bar */}
      <div className="absolute top-[56px] left-0 right-0 bottom-0">
        {/* Activity panel — left side */}
        <ActivityPanel />

        {/* Activity panel toggle */}
        {!isPanelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all hover:bg-white/[0.06]"
            style={{
              background: 'rgba(20,20,26,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg className="h-3.5 w-3.5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-text-muted">Chat</span>
            {isRecording && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
          </button>
        )}

        {/* Views */}
        {currentView === 'graph' && <GraphView />}
        {currentView === 'query' && <QueryView sendEvent={sendEvent} />}
        {currentView === 'ontology' && <OntologyView />}

        {/* Right sidebar — node details (only on graph view) */}
        {currentView === 'graph' && selectedNodeId && (
          <div className="absolute top-0 right-0 w-[340px] h-full z-10">
            <InfoSidebar />
          </div>
        )}

        {/* ThoughtStream — top right */}
        <div className="absolute top-4 right-4 z-10">
          <ThoughtStream />
        </div>

        {/* Bottom bar — centered chat input with voice on the right */}
        {currentView === 'graph' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-4">
            {/* Thinking spinner only — no lingering agent response bubble */}
            {isThinking && (
              <div
                className="mb-2 rounded-xl px-4 py-2.5 text-[12px] text-accent flex items-center gap-2"
                style={{
                  background: 'rgba(20,20,26,0.95)',
                  border: '1px solid rgba(245,158,11,0.15)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Searching the graph...
              </div>
            )}
            {/* Input row */}
            <div
              className="flex items-center gap-2 rounded-2xl px-3 py-2"
              style={{
                background: 'rgba(20,20,26,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChatSubmit(); }}
                placeholder="Ask about the graph..."
                disabled={isThinking}
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-muted/50 focus:outline-none disabled:opacity-40 py-1"
              />
              <button
                onClick={handleChatSubmit}
                disabled={isThinking || !chatText.trim()}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-accent text-bg-primary disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition-all"
              >
                Ask
              </button>
              {/* Mic button inline */}
              <VoicePanel sendEvent={sendEvent} />
            </div>
          </div>
        )}

        {/* Voice-only bar for non-graph views */}
        {currentView !== 'graph' && (
          <div className="absolute bottom-4 left-4 z-10">
            <VoicePanel sendEvent={sendEvent} />
          </div>
        )}
      </div>

      {/* Ingest panel */}
      {showIngest && <IngestModal onClose={() => setShowIngest(false)} />}
    </div>
  );
}

export default App;
