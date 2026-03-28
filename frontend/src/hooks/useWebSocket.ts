import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '../stores/voiceStore';
import { useGraphStore } from '../stores/graphStore';
import { useIngestionStore } from '../stores/ingestionStore';
import type { ClientEvent, ServerEvent } from '../types/events';

const WS_URL = `ws://${window.location.host}/ws/voice`;
const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(onAudioChunk?: (base64Data: string) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAudioChunkRef = useRef(onAudioChunk);
  onAudioChunkRef.current = onAudioChunk;

  const setConnected = useVoiceStore((s) => s.setConnected);
  const addTranscript = useVoiceStore((s) => s.addTranscript);

  const graphStore = useGraphStore;
  const ingestionStore = useIngestionStore;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: ServerEvent = JSON.parse(event.data);
        const state = graphStore.getState();

        switch (data.type) {
          // ---- Transcript ----
          case 'transcript':
            addTranscript(data.role, data.text);
            break;

          // ---- Graph mutations ----
          case 'graph_update':
            state.setGraph(data.nodes, data.edges);
            break;

          case 'node_added':
            state.addNode(data.node);
            break;

          case 'edge_added':
            state.addEdge(data.edge);
            break;

          case 'node_removed':
            state.removeNode(data.nodeId);
            break;

          // ---- Highlight ----
          // (custom highlight event from backend, not in the ServerEvent union
          //  but handled gracefully)

          // ---- Thinking animations ----
          case 'thinking_start':
            state.thinkingStart(data.query);
            break;

          case 'thinking_step':
            state.thinkingAddStep(data.step, data.icon, data.nodeId);
            break;

          case 'thinking_traverse':
            state.thinkingTraverse(data.fromId, data.toId, data.edgeId);
            break;

          case 'thinking_ripple':
            state.thinkingRipple(data.centerId, data.rings);
            break;

          case 'thinking_complete':
            state.thinkingComplete(data.resultNodeIds, data.resultEdgeIds);
            break;

          case 'thinking_clear':
            state.thinkingClear();
            break;

          // ---- Audio ----
          case 'audio_chunk':
            onAudioChunkRef.current?.(data.data);
            break;

          // ---- Status events ----
          case 'ingestion_status': {
            const ingState = ingestionStore.getState();
            const phaseMap: Record<string, string> = { A: 'Discovery', B: 'Ontology', C: 'Extraction', done: 'Complete' };
            const phaseName = phaseMap[data.phase] ?? data.phase;
            if (data.phase === 'done') {
              ingState.setComplete();
            } else {
              ingState.updateProgress(
                phaseName,
                data.progress,
                data.entities_found ?? ingState.entitiesFound,
                data.relationships_found ?? ingState.relationshipsFound,
              );
            }
            break;
          }
          case 'ontology_changed':
          case 'csv_analysis':
            // TODO: handle in respective stores
            break;

          case 'error':
            console.error('[WS] Server error:', data.message);
            break;

          default: {
            // Handle events not in the strict ServerEvent union (e.g. highlight)
            const untyped = data as Record<string, unknown>;
            if (untyped.type === 'highlight') {
              const nodeIds = (untyped.nodeIds as string[]) || [];
              const edgeIds = (untyped.edgeIds as string[]) || [];
              state.setHighlight(nodeIds, edgeIds);
            } else {
              console.warn('[WS] Unknown event type:', untyped.type);
            }
          }
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    },
    [addTranscript, graphStore, ingestionStore],
  );

  const sendEvent = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      wsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts.current);
        console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current + 1})`);
        reconnectTimer.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      } else {
        console.error('[WS] Max reconnect attempts reached');
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

    wsRef.current = ws;
  }, [handleMessage, setConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    connect();

    // Expose sendEvent globally for console testing
    // Usage: window.sendEvent({type:'text_input', text:'hello'})
    (window as unknown as Record<string, unknown>).sendEvent = sendEvent;

    return () => {
      disconnect();
      delete (window as unknown as Record<string, unknown>).sendEvent;
    };
  }, [connect, disconnect, sendEvent]);

  return { sendEvent, connect, disconnect };
}
