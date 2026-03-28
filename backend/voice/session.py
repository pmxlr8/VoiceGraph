"""VoiceSession — manages a Gemini Live API session for real-time voice.

Handles bidirectional audio streaming, transcript extraction, and
function-call execution against VoiceGraph tools.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any, Callable, Coroutine

from google import genai
from google.genai import types

from voice.tool_declarations import VOICE_TOOLS
from voice.tool_executor import execute_tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System instruction for Gemini Live
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = """You are VoiceGraph, an AI assistant that helps users explore their knowledge graph through voice conversation.

BEHAVIORS:
- Keep responses SHORT and conversational -- you are speaking aloud, not writing essays
- Use the tools to search, explore, and highlight the graph as the user asks questions
- Narrate what you are doing as you search: "Let me search for that..." or "I found 5 entities..."
- When highlighting nodes, briefly explain why those nodes are relevant
- If a search returns no results, suggest alternative queries or offer to add new entities
- Be enthusiastic but concise about discoveries in the graph
- When exploring connections, describe the path in plain language
- Offer follow-up suggestions: "Would you like me to explore any of these further?"

TOOL USAGE:
- After any search or exploration, call highlight_nodes to visually show results
- Use search_concepts for broad topic queries
- Use explore_entity when the user names a specific entity
- Use find_path when the user asks how two things connect
- Use get_graph_stats when asked about graph size or overview
- Use add_node when the user wants to create new entities

VOICE STYLE:
- Speak naturally, as if in conversation
- Avoid bullet points or formatted text -- you are being heard, not read
- Use short sentences
- Pause naturally between ideas"""


class VoiceSession:
    """Manages a single Gemini Live session for one WebSocket client.

    Lifecycle:
        1. Create with VoiceSession(send_event)
        2. Call start() to open the Gemini Live connection
        3. Feed audio with send_audio(base64_pcm16)
        4. Feed text with send_text(text)
        5. Call close() when done

    The session runs a background receive loop that:
        - Streams audio responses back via send_event
        - Streams transcript text back via send_event
        - Handles function calls by executing tools and returning results
    """

    def __init__(
        self,
        send_event: Callable[[dict[str, Any]], Coroutine[Any, Any, None]],
    ) -> None:
        """Initialize the voice session.

        Args:
            send_event: Async callable that sends a JSON event dict to the
                        WebSocket client.
        """
        self._send_event = send_event
        self._session: Any = None
        self._client: genai.Client | None = None
        self._receive_task: asyncio.Task | None = None
        self._active = False
        self._session_context: Any = None  # the async context manager

    @property
    def active(self) -> bool:
        """Whether the session is currently connected and running."""
        return self._active

    async def start(self) -> None:
        """Open a Gemini Live connection and start the receive loop."""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
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
            )

            # Enter the async context manager manually so we can keep
            # the session open across multiple send/receive cycles.
            self._session_context = self._client.aio.live.connect(
                model="gemini-3.1-flash-live-preview",
                config=config,
            )
            self._session = await self._session_context.__aenter__()
            self._active = True

            # Start the background receive loop
            self._receive_task = asyncio.create_task(
                self._receive_loop(),
                name="voice-receive-loop",
            )

            await self._send_event({
                "type": "voice_ready",
                "message": "Voice session started. Listening...",
            })
            logger.info("Gemini Live session started")

        except Exception as exc:
            logger.exception("Failed to start Gemini Live session")
            await self._send_event({
                "type": "error",
                "message": f"Failed to start voice session: {exc}",
            })

    async def send_audio(self, base64_audio: str) -> None:
        """Send a base64-encoded PCM16 audio chunk to Gemini.

        Args:
            base64_audio: Base64-encoded PCM16 audio at 16kHz.
        """
        if not self._active or self._session is None:
            return

        try:
            audio_bytes = base64.b64decode(base64_audio)
            await self._session.send(
                input=types.LiveClientRealtimeInput(
                    media_chunks=[
                        types.Blob(
                            data=audio_bytes,
                            mime_type="audio/pcm;rate=16000",
                        )
                    ]
                )
            )
        except Exception:
            logger.exception("Failed to send audio to Gemini")

    async def send_text(self, text: str) -> None:
        """Send a text message to the Gemini Live session.

        Args:
            text: The text message to send.
        """
        if not self._active or self._session is None:
            return

        try:
            await self._session.send(
                input=text,
                end_of_turn=True,
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
        """Continuously receive responses from Gemini Live and forward them."""
        if self._session is None:
            return

        try:
            async for response in self._session.receive():
                if not self._active:
                    break
                await self._handle_response(response)
        except asyncio.CancelledError:
            logger.info("Receive loop cancelled")
        except Exception:
            logger.exception("Error in Gemini Live receive loop")
            if self._active:
                await self._send_event({
                    "type": "error",
                    "message": "Voice session disconnected unexpectedly.",
                })
                self._active = False

    async def _handle_response(self, response: Any) -> None:
        """Process a single response from Gemini Live.

        Responses can contain:
        - server_content: audio data and/or text
        - tool_call: function call requests
        """
        # Handle function calls
        if response.tool_call is not None:
            await self._handle_tool_call(response.tool_call)
            return

        # Handle server content (audio + text)
        server_content = response.server_content
        if server_content is None:
            return

        # Check for turn completion
        if server_content.turn_complete:
            await self._send_event({
                "type": "turn_complete",
            })
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

                # Text response
                if part.text is not None and part.text.strip():
                    await self._send_event({
                        "type": "transcript",
                        "role": "agent",
                        "text": part.text,
                    })

    async def _handle_tool_call(self, tool_call: Any) -> None:
        """Handle a function call request from Gemini.

        Executes the requested tool, sends thinking events to the frontend,
        and returns the result to Gemini so it can continue its response.
        """
        responses = []

        for fc in tool_call.function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}

            logger.info("Gemini requested tool: %s(%s)", tool_name, tool_args)

            # Send thinking events to frontend
            await self._send_event({
                "type": "thinking_start",
                "query": f"Using {tool_name}...",
            })

            await self._send_event({
                "type": "thinking_step",
                "step": f"Calling {tool_name} with {tool_args}",
                "icon": "🔍",
            })

            # Execute the tool
            result = execute_tool(tool_name, tool_args)

            await self._send_event({
                "type": "thinking_complete",
                "resultNodeIds": [],
                "resultEdgeIds": [],
            })

            # Build function response
            responses.append(
                types.FunctionResponse(
                    name=tool_name,
                    response=result,
                )
            )

        # Send tool results back to Gemini so it can incorporate them
        if responses and self._session is not None:
            try:
                await self._session.send(
                    input=types.LiveClientToolResponse(
                        function_responses=responses,
                    )
                )
            except Exception:
                logger.exception("Failed to send tool responses to Gemini")
