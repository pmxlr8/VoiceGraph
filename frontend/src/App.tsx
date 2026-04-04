import { useState, useEffect, useCallback, useRef } from 'react';
import GraphView from './components/Graph/GraphView';
import QueryView from './components/QueryView/QueryView';
import OntologyView from './components/OntologyView/OntologyView';
import InfoSidebar from './components/InfoSidebar/InfoSidebar';
import TopBar from './components/TopBar/TopBar';
import BottomSheet from './components/BottomSheet/BottomSheet';
import Onboarding from './components/Onboarding/Onboarding';
import YourMind from './components/YourMind/YourMind';
import TimeSlider from './components/TimeSlider/TimeSlider';
import BlindSpotBanner from './components/BlindSpot/BlindSpotBanner';
import VoicePanel from './components/VoicePanel/VoicePanel';
import ThoughtStream from './components/ThoughtStream/ThoughtStream';
import ActivityPanel from './components/ActivityPanel/ActivityPanel';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useGraphStore } from './stores/graphStore';
import { useVoiceStore } from './stores/voiceStore';


export type View = 'graph' | 'query' | 'ontology' | 'mind';

/** Parse raw API graph response into store-compatible format */
function parseGraphResponse(data: any) {
  const nodes = (data.nodes || []).map((n: any) => ({
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
  return { nodes, edges };
}

/** Fetch top-50 summary (default) or full graph. */
async function fetchAndLoadGraph(full = false): Promise<{ nodeCount: number; totalNodes: number }> {
  const url = full ? '/api/graph' : '/api/graph/summary';
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.nodes?.length) return { nodeCount: 0, totalNodes: data.total_nodes || 0 };

  const { nodes, edges } = parseGraphResponse(data);
  useGraphStore.getState().setGraph(nodes, edges);
  return { nodeCount: nodes.length, totalNodes: data.total_nodes || nodes.length };
}

function App() {
  const { playChunk, stopPlayback } = useAudioPlayback();
  const { sendEvent } = useWebSocket(playChunk);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const isThinking = useGraphStore((s) => s.isThinking);

  // Onboarding gate
  const [onboarded, setOnboarded] = useState(() =>
    localStorage.getItem('voicegraph_onboarded') === 'true'
  );

  const [currentView, setCurrentView] = useState<View>('graph');
  const [showIngest, setShowIngest] = useState(false);
  const [chatText, setChatText] = useState('');
  const [showingFull, setShowingFull] = useState(false);
  const [totalNodes, setTotalNodes] = useState(0);

  const handleChatSubmit = useCallback(() => {
    const trimmed = chatText.trim();
    if (!trimmed || isThinking) return;
    sendEvent({ type: 'text_input', text: trimmed });
    setChatText('');
  }, [chatText, isThinking, sendEvent]);

  const interruptCooldownRef = useRef(false);
  const handleInterrupt = useCallback(() => {
    if (interruptCooldownRef.current) return;
    interruptCooldownRef.current = true;
    setTimeout(() => { interruptCooldownRef.current = false; }, 2000);
    stopPlayback();
    sendEvent({ type: 'interrupt_voice' });
    useGraphStore.getState().thinkingClear();
  }, [stopPlayback, sendEvent]);

  // Fetch graph on mount (summary = top 50 by default)
  useEffect(() => {
    if (onboarded) {
      fetchAndLoadGraph(false).then(({ totalNodes: t }) => setTotalNodes(t)).catch(() => {});
    }
  }, [onboarded]);

  const handleToggleFullGraph = useCallback(() => {
    const next = !showingFull;
    setShowingFull(next);
    fetchAndLoadGraph(next).then(({ totalNodes: t }) => setTotalNodes(t)).catch(() => {});
  }, [showingFull]);

  const handleOnboardingComplete = useCallback((_role: string, _domain: string) => {
    setOnboarded(true);
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

  // Show onboarding if not completed
  if (!onboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

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
          onViewChange={setCurrentView as (v: string) => void}
          onIngest={() => setShowIngest(true)}
        />
      </div>

      {/* Left panel — Activity / Agent Trace */}
      <div style={{ gridArea: 'left', overflow: 'hidden' }} className="flex flex-col gap-2">
        <ActivityPanel />
        <YourMind />
      </div>

      {/* Main content — Graph / Query / Ontology / Mind */}
      <div style={{ gridArea: 'main', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
        {currentView === 'graph' && (
          <GraphView
            showingFull={showingFull}
            totalNodes={totalNodes}
            onToggleFull={handleToggleFullGraph}
          />
        )}
        {currentView === 'query' && <QueryView sendEvent={sendEvent} />}
        {currentView === 'ontology' && <OntologyView />}

        {/* ThoughtStream overlay — top right of graph */}
        <div className="absolute top-4 right-4 z-10">
          <ThoughtStream />
        </div>

        {/* Blind spot banner — top center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[500px] max-w-[80%]">
          <BlindSpotBanner />
        </div>

        {/* Time slider — bottom center of graph */}
        {currentView === 'graph' && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 w-[400px] max-w-[60%]">
            <TimeSlider />
          </div>
        )}
      </div>

      {/* Right panel — Node detail (only when node selected on graph view) */}
      {currentView === 'graph' && selectedNodeId && (
        <div style={{ gridArea: 'right', overflow: 'hidden' }}>
          <InfoSidebar />
        </div>
      )}

      {/* Voice bar — Row 3 */}
      <div style={{ gridArea: 'bar' }} className="glass-1 flex items-center px-4 gap-3">
        {/* + button for bottom sheet */}
        <button
          onClick={() => setShowIngest(true)}
          className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-lg text-text-secondary hover:text-text-primary glass-3 transition-colors"
        >
          +
        </button>

        {/* Recent queries */}
        <div className="flex gap-1.5 flex-shrink-0 overflow-x-auto max-w-[180px]" style={{ scrollbarWidth: 'none' }}>
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
            placeholder="Ask anything about your knowledge graph..."
            disabled={isThinking}
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-40"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          <button
            onClick={handleChatSubmit}
            disabled={isThinking || !chatText.trim()}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            style={{ background: 'hsla(45, 80%, 65%, 0.85)', color: '#09090b' }}
          >
            Ask
          </button>
          <VoicePanel sendEvent={sendEvent} />
          {/* Interrupt button — stops agent mid-speech */}
          <button
            onClick={handleInterrupt}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-all"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
            }}
            title="Interrupt agent"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Agent status */}
        <div className="glass-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: isThinking ? 'hsla(210, 40%, 78%, 0.90)' : 'hsla(150, 35%, 74%, 0.90)',
              boxShadow: isThinking ? '0 0 6px hsla(210, 40%, 78%, 0.6)' : '0 0 6px hsla(150, 35%, 74%, 0.6)',
              animation: isThinking ? 'blink 0.8s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[11px] font-medium text-text-secondary" style={{ letterSpacing: '0.01em' }}>
            {isThinking ? 'Thinking...' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Bottom sheet ingestion */}
      <BottomSheet open={showIngest} onClose={() => setShowIngest(false)} />
    </div>
  );
}

export default App;
