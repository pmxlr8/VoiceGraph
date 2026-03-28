import GraphView from './components/Graph/GraphView';
import InfoSidebar from './components/InfoSidebar/InfoSidebar';
import LeftPanel from './components/LeftPanel/LeftPanel';
import VoicePanel from './components/VoicePanel/VoicePanel';
import ThoughtStream from './components/ThoughtStream/ThoughtStream';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { useGraphStore } from './stores/graphStore';

function App() {
  const { playChunk } = useAudioPlayback();
  const { sendEvent } = useWebSocket(playChunk);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-bg-primary">
      {/* Graph fills full viewport */}
      <div className="absolute inset-0">
        <GraphView />
      </div>

      {/* Floating left panel */}
      <div className="absolute top-4 left-4 w-[280px] max-h-[calc(100vh-5rem)] z-10">
        <LeftPanel />
      </div>

      {/* Floating right panel — only when node selected */}
      {selectedNodeId && (
        <div className="absolute top-4 right-4 w-[300px] max-h-[calc(100vh-5rem)] z-10">
          <InfoSidebar />
        </div>
      )}

      {/* ThoughtStream — bottom right, above voice bar */}
      <div className="absolute bottom-20 right-4 z-10">
        <ThoughtStream />
      </div>

      {/* Voice pill — bottom center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10">
        <VoicePanel sendEvent={sendEvent} />
      </div>
    </div>
  );
}

export default App;
