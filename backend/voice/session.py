"""VoiceSession — manages a Gemini Live API session for real-time voice.

Handles bidirectional audio streaming, transcript extraction, and
function-call execution against VoiceGraph tools.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any, Callable, Coroutine

from google import genai
from google.genai import types

from voice.tool_declarations import VOICE_TOOLS
from voice.tool_executor import execute_tool

logger = logging.getLogger(__name__)

# Model that supports Live/bidi with audio + tools
LIVE_MODEL = "gemini-2.5-flash-native-audio-latest"

SYSTEM_INSTRUCTION = """You are VoiceGraph, a voice-first AI assistant that helps NYC residents understand how energy infrastructure, data centers, and policy decisions affect their neighborhoods. You speak to regular people — not lawyers or consultants. Be warm, clear, and direct.

You are grounded in a knowledge graph of 569 nodes and 882 edges covering:
- NYC communities (South Bronx CD1/CD2, Mott Haven, Hunts Point, Long Island City, Astoria, Sunset Park, East New York, Washington Heights)
- Grid infrastructure (NYISO Zone J, Con Edison, Indian Point Energy Center, Astoria Generating Station, BQDM Program)
- Data centers (111 8th Avenue/Google NYC, 60 Hudson Street, Equinix NY4/NY5, CyrusOne, EdgeConneX)
- Regulations (S9144 DC moratorium, LL97 carbon penalties, CLCPA, UTENJA, IRA Section 48, Justice40)
- Thermal energy networks (Chelsea UTEN, South Bronx UTEN, Hudson Yards UTEN, Ravenswood UTEN, Columbia UTEN, Gowanus UTEN)
- Anchor institutions (Lincoln Hospital, Jacobi, Montefiore, NYCHA Ravenswood Houses, NYC DOE buildings)
- Financial mechanisms (NY Green Bank, PACE Financing, EmPower+ Program, NYC Accelerator, LL97 Fine Structure)
- NYC datasets (311 heat complaints, LL84 energy disclosure, LL97 emissions benchmarking, NYCHA heat outage data)
- Market signals, companies, energy experts, commodities

RULES:
- Call tools IMMEDIATELY. Don't narrate what you plan to do — just do it and then speak about results.
- After EVERY search/explore/path query, ALWAYS call highlight_nodes with ALL relevant entity NAMES.
- For simple commands (add, delete, stats): brief, 1-2 sentences.
- For questions about communities, energy, data centers, or policy: give RICH, DETAILED answers. 4-6 sentences. Explain the connections in plain language. Name specific entities, numbers, and relationships.
- Speak as if explaining to a concerned resident, not a technical audience.
- When you find a causal chain (A causes B causes C), narrate it step by step so the listener follows the logic.

TOOLS:
- search_concepts: broad topic search → then highlight results
- explore_entity: specific entity lookup → then highlight results
- find_path: how two things connect → then highlight the path
- get_graph_stats: graph size overview
- add_node / add_relationship / remove_node: graph mutations
- highlight_nodes: light up nodes on the graph. Pass entity NAMES like ["South Bronx CD1", "NYISO Zone J"]. ALWAYS call this after search/explore results.

CRITICAL DOMAIN KNOWLEDGE (use this to enrich your answers):

SOUTH BRONX & ENERGY BURDEN:
- South Bronx CD1 (Mott Haven, Port Morris) has the highest energy burden in NYC — residents spend up to 34% of income on utilities
- Hunts Point (CD2) is an industrial corridor adjacent to data center growth zones
- These are federally designated Disadvantaged Communities under CLCPA and Justice40
- NYC311 heat complaint data shows South Bronx CD1 has 3.2x the citywide average of heat complaints
- Energy burden correlates with mortgage denial rates (HMDA data)

DATA CENTER → GRID → RATE CONNECTION:
- NYISO Zone J (NYC's load zone) has 1,400+ MW of pending data center interconnection requests — that's 12% of peak load
- Long Island City hosts NYC's largest DC cluster with 400+ MW pending
- Con Edison socializes infrastructure costs across ALL ratepayers — so South Bronx families pay higher rates for infrastructure serving data centers in LIC
- Indian Point nuclear plant retired April 2021, removing 2,069 MW of carbon-free baseload. Data centers filled that demand gap faster than renewables could. Grid emissions rose 15% after closure.
- This chain: Indian Point retirement → capacity gap → DC load growth → grid strain → S9144 moratorium

S9144 & LEGISLATIVE RESPONSE:
- Senator Krueger introduced S9144 to impose a moratorium on new data center construction in NYC
- The moratorium includes an exception for DCs that participate in thermal energy networks
- UTENJA (Utility Thermal Energy Network Act) provides the enabling framework
- S9144's regulatory offramp via thermal networks means DCs can still be built IF they recover waste heat

CHELSEA UTEN & THE SOLUTION:
- Chelsea UTEN is a pilot project recovering waste heat from data center operations at 85 Tenth Avenue
- The heat is piped underground to heat NYCHA apartments — essentially free heating from DC waste
- 111 8th Avenue (Google's 2.9M sq ft NYC HQ) is IN Chelsea — a hyperscaler literally next door to the solution
- This is not theoretical — it's operating now

LL97 & BUILDING PENALTIES:
- LL97 imposes $268 per metric ton of CO2 above building-specific caps
- Lincoln Hospital faces an estimated $2.1M annual penalty by 2030
- Montefiore Medical Center faces $4.5M/year
- NYC DOE's 1,800+ school buildings collectively face $50M+ in annual penalties
- Thermal energy networks offer a compliance pathway — connecting to waste heat reduces building emissions

PROGRAMS RESIDENTS QUALIFY FOR:
- EmPower+ Program: no-cost energy upgrades for income-eligible households
- NYC Accelerator: free building decarbonization advisory
- PACE Financing: zero-upfront-cost thermal network connections via property tax assessment
- Justice40: 40% of federal climate investment must flow to Disadvantaged Communities
- NYSERDA Heat Recovery Program: up to $1M per project for heat recovery equipment

EXAMPLE DEMO CONVERSATIONS:

Q: "I live in the South Bronx. My electricity bill keeps going up and I keep hearing about data centers nearby. Is there a connection?"
→ Use search_concepts("South Bronx data center") and explore_entity("South Bronx CD1")
→ Then highlight_nodes(["South Bronx CD1", "Mott Haven", "NYISO Zone J", "Long Island City", "Con Edison Service Territory"])
→ Answer should cover: YES there's a direct connection. South Bronx CD1 has the highest energy burden in NYC. NYISO Zone J, which serves all of NYC, has over 1,400 megawatts of data center interconnection requests pending — that's 12% of peak load. Most of that is concentrated in Long Island City. Con Edison socializes infrastructure costs across all ratepayers, so the Johnsons in Mott Haven are paying higher rates to fund grid upgrades serving data centers they've never heard of. Indian Point's retirement in 2021 made this worse — it removed 2,069 megawatts of clean power, and data centers filled that gap with gas-backed demand. Your bill increase is directly connected to decisions made about infrastructure you were never consulted on.

Q: "Is anyone actually doing something about this?" or "What solutions exist?"
→ Use search_concepts("thermal energy network solution Chelsea") and explore_entity("Chelsea UTEN")
→ Then highlight_nodes(["Chelsea UTEN", "85 Tenth Avenue", "111 8th Avenue", "S9144", "UTENJA", "NYCHA Ravenswood Houses"])
→ Answer should cover: Yes — and one solution is literally four miles from the South Bronx. The Chelsea UTEN pilot is recovering waste heat from a data center at 85 Tenth Avenue and piping it underground to heat NYCHA apartments. That's heat that would normally just get vented into the air — now it's heating homes for free. And here's what's remarkable: Google's NYC headquarters at 111 8th Avenue is in the same neighborhood — a hyperscaler right next door to the solution. Senator Krueger's S9144 moratorium bill actually includes an exception for data centers that participate in these thermal networks. The UTENJA act provides the legal framework. There are six pilot projects across the city, and your neighborhood qualifies for federal Justice40 funding to bring one to the South Bronx.

Q: "What programs do I qualify for?" or "What can I actually do?"
→ Use search_concepts("program qualify low income energy")
→ Then highlight_nodes(["EmPower+ Program", "NYC Accelerator", "Justice40 Initiative", "PACE Financing", "LL97 Fine Structure"])
→ Answer should cover: Several programs you may qualify for RIGHT NOW. EmPower+ through NYSERDA provides no-cost energy upgrades if you're income-eligible. NYC Accelerator is a free advisory program for building decarbonization. PACE Financing lets building owners connect to thermal networks with zero upfront cost. And because the South Bronx is a designated Disadvantaged Community, the federal Justice40 initiative mandates that 40% of climate investment flows to your community. There are also public comment periods on data center permits that residents can attend — agencies are legally required to respond. Under LL97, your landlord now faces real carbon penalties, which gives tenants leverage they've never had before.

Q: "How does Indian Point connect to my electricity bill?"
→ Use find_path("Indian Point Energy Center", "South Bronx CD1")
→ Then highlight_nodes(["Indian Point Energy Center", "NYISO Zone G", "NYISO Zone J", "Con Edison Service Territory", "South Bronx CD1"])
→ Narrate the chain step by step.

Q: "Tell me about data centers in New York"
→ Use search_concepts("data center New York")
→ Then highlight_nodes(["111 8th Avenue", "60 Hudson Street", "Equinix NY4", "Equinix NY5", "CyrusOne NYC", "EdgeConneX NYC", "Long Island City", "Sunset Park"])
→ Rich detail about the scale of DC growth in NYC.

NEVER SAY things like "I've determined that..." or "My plan is to..." or "Let me search for..." — just DO IT and then speak about what you found."""


class VoiceSession:
    """Manages a single Gemini Live session for one WebSocket client."""

    def __init__(
        self,
        send_event: Callable[[dict[str, Any]], Coroutine[Any, Any, None]],
    ) -> None:
        self._send_event = send_event
        self._session: Any = None
        self._client: genai.Client | None = None
        self._receive_task: asyncio.Task | None = None
        self._active = False
        self._session_context: Any = None
        self._tool_in_progress = False
        # Conversation memory — survives reconnects
        self._conversation_history: list[str] = []
        # Transcript buffering — accumulate words before sending
        self._user_transcript_buf = ""
        self._agent_transcript_buf = ""
        self._user_flush_task: asyncio.Task | None = None
        self._agent_flush_task: asyncio.Task | None = None

    @property
    def active(self) -> bool:
        return self._active

    async def start(self) -> None:
        """Open a Gemini Live connection and start the receive loop."""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GOOGLE_API_KEY not set")
            await self._send_event({
                "type": "error",
                "message": "GOOGLE_API_KEY not set. Voice features are unavailable.",
            })
            return

        try:
            self._client = genai.Client(api_key=api_key)

            config = types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                tools=[types.Tool(function_declarations=VOICE_TOOLS)],
                system_instruction=SYSTEM_INSTRUCTION,
                input_audio_transcription=types.AudioTranscriptionConfig(),
                output_audio_transcription=types.AudioTranscriptionConfig(),
            )

            logger.info("Connecting to Gemini Live model: %s", LIVE_MODEL)
            self._session_context = self._client.aio.live.connect(
                model=LIVE_MODEL,
                config=config,
            )
            self._session = await self._session_context.__aenter__()
            self._active = True

            self._receive_task = asyncio.create_task(
                self._receive_loop(),
                name="voice-receive-loop",
            )

            await self._send_event({
                "type": "voice_ready",
                "message": "Voice session started. Listening...",
            })
            logger.info("Gemini Live session started successfully")

        except Exception as exc:
            logger.exception("Failed to start Gemini Live session")
            await self._send_event({
                "type": "error",
                "message": f"Failed to start voice session: {exc}",
            })

    async def send_audio(self, base64_audio: str) -> None:
        """Send a base64-encoded PCM16 audio chunk to Gemini."""
        if not self._active or self._session is None:
            return

        try:
            audio_bytes = base64.b64decode(base64_audio)
            await self._session.send_realtime_input(
                audio=types.Blob(
                    data=audio_bytes,
                    mime_type="audio/pcm;rate=16000",
                )
            )
        except Exception:
            # Connection closed — don't spam logs for every audio chunk
            pass

    async def send_text(self, text: str) -> None:
        """Send a text message to the Gemini Live session."""
        if not self._active or self._session is None:
            return

        self._add_history("user", text)
        try:
            await self._session.send_client_content(
                turns=[types.Content(
                    parts=[types.Part(text=text)],
                    role="user",
                )],
                turn_complete=True,
            )
        except Exception:
            logger.exception("Failed to send text to Gemini")

    async def close(self) -> None:
        """Close the Gemini Live session and clean up."""
        self._active = False

        if self._receive_task is not None:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._session_context is not None:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception:
                logger.exception("Error closing Gemini Live session")
            self._session = None
            self._session_context = None

        self._client = None
        logger.info("Gemini Live session closed")

    # ------------------------------------------------------------------
    # Background receive loop
    # ------------------------------------------------------------------

    async def _receive_loop(self) -> None:
        """Continuously receive responses from Gemini Live and forward them.
        Auto-reconnects up to 3 times if the session drops."""
        max_retries = 3

        for attempt in range(max_retries + 1):
            if self._session is None:
                return

            try:
                async for response in self._session.receive():
                    if not self._active:
                        return
                    try:
                        await self._handle_response(response)
                    except Exception:
                        logger.exception("Error handling Gemini response (continuing)")
                # Stream ended normally (Gemini closed it)
                if not self._active:
                    return

                # If a tool is in progress, wait for it to finish before reconnecting
                if self._tool_in_progress:
                    logger.warning("Stream ended while tool in progress — waiting...")
                    for _ in range(150):  # Wait up to 15 seconds
                        if not self._tool_in_progress:
                            break
                        await asyncio.sleep(0.1)

                logger.warning("Gemini Live stream ended (attempt %d/%d)", attempt + 1, max_retries)

            except asyncio.CancelledError:
                logger.info("Receive loop cancelled")
                return
            except Exception:
                logger.exception("Gemini Live receive error (attempt %d/%d)", attempt + 1, max_retries)

            # Try to reconnect
            if attempt < max_retries and self._active:
                await self._send_event({
                    "type": "voice_ready",
                    "message": "Reconnecting voice...",
                })
                try:
                    await self._reconnect()
                    logger.info("Reconnected to Gemini Live successfully")
                    continue
                except Exception:
                    logger.exception("Reconnect failed")

        # All retries exhausted
        if self._active:
            await self._send_event({
                "type": "error",
                "message": "Voice session disconnected. Click mic to restart.",
            })
            self._active = False

    async def _flush_transcript(self, role: str, delay: float) -> None:
        """Wait for a pause in streaming, then flush the buffered transcript."""
        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            return  # New text arrived, timer reset

        if role == "user":
            text = self._user_transcript_buf.strip()
            self._user_transcript_buf = ""
        else:
            text = self._agent_transcript_buf.strip()
            self._agent_transcript_buf = ""

        if text:
            self._add_history(role if role == "user" else "assistant", text)
            await self._send_event({
                "type": "transcript",
                "role": role,
                "text": text,
            })

    @staticmethod
    def _trim_tool_result(tool_name: str, result: dict) -> dict:
        """Trim tool results to avoid overflowing Gemini's context.
        Large results (many nodes/edges) cause Gemini 1011 internal errors."""
        import json
        raw = json.dumps(result, default=str)
        if len(raw) < 4000:
            return result

        # Build a compact summary instead
        trimmed: dict = {}
        for key, val in result.items():
            if isinstance(val, list) and len(val) > 5:
                # Keep first 5 items + count
                trimmed[key] = val[:5]
                trimmed[f"{key}_total"] = len(val)
            elif isinstance(val, dict) and len(json.dumps(val, default=str)) > 1000:
                # Summarize large dicts
                trimmed[key] = {k: v for i, (k, v) in enumerate(val.items()) if i < 10}
            else:
                trimmed[key] = val

        trimmed["_note"] = "Results trimmed for brevity. Use highlight_nodes to show them on the graph."
        return trimmed

    def _add_history(self, role: str, text: str) -> None:
        """Add to conversation history (keeps last 20 entries)."""
        self._conversation_history.append(f"{role}: {text}")
        if len(self._conversation_history) > 20:
            self._conversation_history = self._conversation_history[-20:]

    async def _reconnect(self) -> None:
        """Re-establish the Gemini Live session with conversation context."""
        # Close old session
        if self._session_context is not None:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception:
                pass

        # Build system instruction with conversation history
        history_context = ""
        if self._conversation_history:
            history_text = "\n".join(self._conversation_history[-10:])
            history_context = (
                f"\n\nCONVERSATION HISTORY (continue from here, don't repeat):\n"
                f"{history_text}\n\n"
                f"Continue the conversation naturally. The user may refer to "
                f"things discussed above. Do NOT re-introduce yourself."
            )

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            tools=[types.Tool(function_declarations=VOICE_TOOLS)],
            system_instruction=SYSTEM_INSTRUCTION + history_context,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )

        self._session_context = self._client.aio.live.connect(
            model=LIVE_MODEL,
            config=config,
        )
        self._session = await self._session_context.__aenter__()

    async def _handle_response(self, response: Any) -> None:
        """Process a single response from Gemini Live."""
        # Handle function calls
        if response.tool_call is not None:
            await self._handle_tool_call(response.tool_call)
            return

        # Handle server content (audio + text + transcriptions)
        server_content = response.server_content
        if server_content is None:
            return

        # Input transcription — what the user said (accumulate, flush on pause)
        if server_content.input_transcription and server_content.input_transcription.text:
            self._user_transcript_buf += server_content.input_transcription.text
            # Cancel previous flush timer and set a new one
            if self._user_flush_task and not self._user_flush_task.done():
                self._user_flush_task.cancel()
            self._user_flush_task = asyncio.create_task(
                self._flush_transcript("user", 0.8)
            )

        # Output transcription — what the agent said (accumulate, flush on pause)
        if server_content.output_transcription and server_content.output_transcription.text:
            self._agent_transcript_buf += server_content.output_transcription.text
            if self._agent_flush_task and not self._agent_flush_task.done():
                self._agent_flush_task.cancel()
            self._agent_flush_task = asyncio.create_task(
                self._flush_transcript("agent", 1.0)
            )

        # Check for turn completion
        if server_content.turn_complete:
            await self._send_event({"type": "turn_complete"})
            return

        # Process content parts
        if server_content.model_turn and server_content.model_turn.parts:
            for part in server_content.model_turn.parts:
                # Audio response
                if part.inline_data is not None:
                    audio_b64 = base64.b64encode(
                        part.inline_data.data
                    ).decode("ascii")
                    await self._send_event({
                        "type": "audio_chunk",
                        "data": audio_b64,
                        "mime_type": part.inline_data.mime_type or "audio/pcm;rate=24000",
                    })

                # Text thinking (model's internal text, NOT spoken output)
                if part.text is not None and part.text.strip():
                    await self._send_event({
                        "type": "thinking_step",
                        "step": part.text.strip()[:200],
                        "icon": "💭",
                    })

    async def _handle_tool_call(self, tool_call: Any) -> None:
        """Handle tool calls from Gemini. Must respond before Gemini continues."""
        self._tool_in_progress = True
        responses = []

        for fc in tool_call.function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}
            # Capture the function call ID — required for send_tool_response
            fc_id = getattr(fc, 'id', None)

            logger.info("Gemini requested tool: %s(%s) id=%s", tool_name, tool_args, fc_id)
            self._add_history("tool_call", f"{tool_name}({tool_args})")

            await self._send_event({
                "type": "tool_call_start",
                "tool_name": tool_name,
                "args": tool_args,
            })

            await self._send_event({
                "type": "thinking_start",
                "query": f"Using {tool_name}...",
            })

            await self._send_event({
                "type": "thinking_step",
                "step": f"Calling {tool_name} with {tool_args}",
                "icon": "🔍",
            })

            try:
                result = await asyncio.wait_for(
                    execute_tool(tool_name, tool_args),
                    timeout=15.0,
                )
            except asyncio.TimeoutError:
                logger.warning("Tool %s timed out after 15s", tool_name)
                result = {"error": f"Tool {tool_name} timed out", "partial": True}
            except Exception as exc:
                logger.exception("Tool %s failed", tool_name)
                result = {"error": str(exc)}

            await self._send_event({
                "type": "tool_call_result",
                "tool_name": tool_name,
                "summary": f"{tool_name} returned {len(result) if isinstance(result, dict) else 0} fields",
            })

            await self._send_event({
                "type": "thinking_complete",
                "resultNodeIds": [],
                "resultEdgeIds": [],
            })

            # Trim result to avoid overflowing Gemini's context
            trimmed = self._trim_tool_result(tool_name, result)

            fr = types.FunctionResponse(
                name=tool_name,
                response=trimmed,
            )
            # Attach the ID from the original function call
            if fc_id:
                fr.id = fc_id
            responses.append(fr)

        # Send tool results back to Gemini
        self._tool_in_progress = False
        if responses and self._session is not None:
            try:
                logger.info("Sending %d tool response(s) back to Gemini", len(responses))
                await self._session.send_tool_response(
                    function_responses=responses,
                )
                logger.info("Tool responses sent successfully")
            except Exception:
                logger.exception("Failed to send tool responses to Gemini")
