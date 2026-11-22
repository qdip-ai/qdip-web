"""Developer-owned worker process; sends data, never source code to the server."""

from __future__ import annotations

import argparse
import asyncio
import importlib
import json
import logging
import os
import random
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

logger = logging.getLogger(__name__)
PROTOCOL = "0.1"
MAX_MESSAGE_BYTES = 65536
Handler = Callable[[dict[str, Any], str], dict[str, Any]]
RECONNECT_MAX_SECONDS = 30
STABLE_SESSION_SECONDS = 60
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})


def _validate_server_url(url: str) -> None:
    """Host-level check; a prefix match allowed ws://localhost:@remote-host."""
    try:
        parts = urlsplit(url)
        parts.port  # noqa: B018 - raises ValueError on a malformed port
    except ValueError:
        raise ValueError("Invalid remote server URL") from None
    if parts.username is not None or parts.password is not None or not parts.hostname:
        raise ValueError("Remote server URL must not contain credentials")
    if parts.scheme == "wss":
        return
    if parts.scheme == "ws" and parts.hostname in LOOPBACK_HOSTS:
        return
    raise ValueError("Remote server must use WSS (localhost WS permitted for tests)")


class WorkerAuthenticationError(RuntimeError):
    """Permanent Gateway authentication denial requiring credential intervention."""


def _authentication_rejected(exc: Exception) -> bool:
    """Distinguish a revoked/mis-scoped key from a temporary network outage."""
    if isinstance(exc, InvalidStatus):
        return getattr(exc.response, "status_code", None) in (401, 403)
    if isinstance(exc, ConnectionClosed):
        return any(
            getattr(close, "code", None) in (4401, 4403)
            for close in (exc.rcvd, exc.sent)
        )
    return False



@dataclass(frozen=True)
class AdditionalCapability:
    """An additional versioned DecisionSpec capability on the same SDK Worker connection."""
    capability_id: str
    capability_version: str = "1"
    input_schema: dict[str, Any] | None = None
    required_scopes: tuple[str, ...] = ()


@dataclass(frozen=True)
class WorkerConfig:
    server_url: str
    api_key: str
    plugin_id: str
    plugin_version: str
    capability_id: str
    capability_version: str = "1"
    display_name: str | None = None
    description: str = ""
    category: str = "Other"
    input_schema: dict[str, Any] | None = None
    required_scopes: tuple[str, ...] = ()
    # Optional compatibility field. This claim is not runtime attestation.
    artifact_sha256: str | None = None
    additional_capabilities: tuple[AdditionalCapability, ...] = ()


class Worker:
    def __init__(
        self, config: WorkerConfig, handler: Handler,
        additional_handlers: dict[str, Handler] | None = None,
    ) -> None:
        _validate_server_url(config.server_url)
        if config.display_name is not None and not 2 <= len(config.display_name.strip()) <= 120:
            raise ValueError("display_name must contain 2-120 characters")
        if (len(config.description) > 2000 or
                not re.fullmatch(r"[A-Za-z0-9 _.-]{1,64}", config.category)):
            raise ValueError("Invalid catalog metadata")
        if config.artifact_sha256 is not None and (
            not isinstance(config.artifact_sha256, str)
            or re.fullmatch(r"[a-f0-9]{64}", config.artifact_sha256) is None
        ):
            raise ValueError("Invalid declared artifact digest")
        extra = {cap.capability_id: cap for cap in config.additional_capabilities}
        if (len(extra) != len(config.additional_capabilities)
                or len(extra) > 15 or config.capability_id in extra
                or any(not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", cap.capability_id)
                       or not 1 <= len(cap.capability_version) <= 32 for cap in extra.values())
                or set(extra) != set(additional_handlers or {})):
            raise ValueError("Invalid multi-capability SDK registration")
        self.config = config
        self.handler = handler
        self._handlers = {config.capability_id: handler, **(additional_handlers or {})}
        self._versions = {config.capability_id: config.capability_version,
                          **{key: cap.capability_version for key, cap in extra.items()}}
        self.completed: list[dict[str, Any]] = []
        self._send_lock = asyncio.Lock()

    async def run_once(self) -> None:
        """Keep one authenticated outbound socket open until disconnect."""
        async with connect(
            self.config.server_url,
            additional_headers={"x-api-key": self.config.api_key},
            max_size=MAX_MESSAGE_BYTES,
            open_timeout=10,
        ) as socket:
            await socket.send(json.dumps({
                "catalog": {
                    "display_name": self.config.display_name or self.config.plugin_id,
                    "description": self.config.description,
                    "category": self.config.category,
                },
                "type": "REGISTER",
                "protocol_version": PROTOCOL,
                "manifest_version": "1.0.0",
                "plugin_id": self.config.plugin_id,
                "plugin_version": self.config.plugin_version,
                **({"artifact_sha256": self.config.artifact_sha256}
                   if self.config.artifact_sha256 is not None else {}),
                "capabilities": [{
                    "id": self.config.capability_id,
                    "version": self.config.capability_version,
                    "output_type": "decision_spec",
                    "schema_version": "1.0.0",
                    **({"input_schema": self.config.input_schema}
                       if self.config.input_schema is not None else {}),
                    **({"required_scopes": list(self.config.required_scopes)}
                       if self.config.required_scopes else {}),
                }, *[{
                    "id": cap.capability_id,
                    "version": cap.capability_version,
                    "output_type": "decision_spec",
                    "schema_version": "1.0.0",
                    **({"input_schema": cap.input_schema}
                       if cap.input_schema is not None else {}),
                    **({"required_scopes": list(cap.required_scopes)}
                       if cap.required_scopes else {}),
                } for cap in self.config.additional_capabilities]],
            }))
            answer = json.loads(await socket.recv())
            if answer.get("type") != "REGISTERED":
                raise RuntimeError("Remote registration failed")
            logger.info("Remote capability registered: %s", self.config.capability_id)
            heartbeat = asyncio.create_task(self._heartbeat(socket))
            invocations: set[asyncio.Task[None]] = set()
            try:
                async for raw in socket:
                    if not isinstance(raw, str):
                        raise RuntimeError("Unexpected binary server message")
                    if len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                        raise RuntimeError("Server message too large")
                    frame = json.loads(raw)
                    if frame.get("type") == "INVOKE":
                        # Never block the receive loop on a handler: CANCEL,
                        # results and other INVOKEs must keep flowing.
                        task = asyncio.create_task(self._handle(socket, frame))
                        invocations.add(task)
                        task.add_done_callback(invocations.discard)
                    elif frame.get("type") == "DECISION_RESULT":
                        self.completed.append(frame)
                        if len(self.completed) > 100:
                            del self.completed[:-100]
                    elif frame.get("type") == "CANCEL":
                        # Cooperative best-effort: the server has already fenced
                        # the expired attempt and will reject stale results.
                        logger.info("Server cancelled execution %s", frame.get("execution_id"))
                    else:
                        raise RuntimeError("Unexpected server message")
            finally:
                heartbeat.cancel()
                for task in invocations:
                    task.cancel()
                await asyncio.gather(heartbeat, *invocations, return_exceptions=True)

    async def _heartbeat(self, socket: Any) -> None:
        while True:
            await asyncio.sleep(8)
            await self._send(socket, json.dumps({"type": "HEARTBEAT"}))

    async def _send(self, socket: Any, encoded: str) -> None:
        async with self._send_lock:
            await socket.send(encoded)

    async def _run_handler(
        self, incoming: dict[str, Any], decision_id: str, remaining: float,
        handler: Handler | None = None,
    ) -> dict[str, Any]:
        thread = asyncio.ensure_future(
            asyncio.to_thread(handler or self.handler, incoming, decision_id)
        )
        return await asyncio.wait_for(asyncio.shield(thread), timeout=remaining)

    async def _handle(self, socket: Any, frame: dict[str, Any]) -> None:
        execution_id = frame.get("execution_id")
        attempt_id = frame.get("attempt_id")
        try:
            capability_id = frame.get("capability_id")
            if (not isinstance(capability_id, str)
                    or capability_id not in self._handlers
                    or frame.get("capability_version") != self._versions[capability_id]):
                raise ValueError("Capability ID/version not supported")
            deadline = datetime.fromisoformat(frame["deadline"].replace("Z", "+00:00"))
            remaining = (deadline - datetime.now(UTC)).total_seconds()
            if remaining <= 0:
                raise TimeoutError("Invocation expired before processing")
            incoming = frame.get("input")
            decision_id = frame.get("decision_id")
            if not isinstance(incoming, dict) or not isinstance(decision_id, str):
                raise ValueError("Invalid invocation input")
            output = await self._run_handler(
                incoming, decision_id, remaining,
                self.handler if capability_id == self.config.capability_id
                else self._handlers[capability_id])
            response = {
                "type": "RESULT",
                "execution_id": execution_id,
                "attempt_id": attempt_id,
                "decision_spec": output,
            }
        except Exception:
            # Handler errors may include user inputs and third-party secrets.
            # Only expose the generic failure; never log exception text/trace.
            logger.warning("Remote adapter failed")
            response = {"type": "ERROR", "execution_id": execution_id, "attempt_id": attempt_id}
        encoded = json.dumps(response, allow_nan=False)
        if len(encoded.encode("utf-8")) > MAX_MESSAGE_BYTES:
            encoded = json.dumps({
                "type": "ERROR", "execution_id": execution_id, "attempt_id": attempt_id,
            })
        await self._send(socket, encoded)

    async def run_forever(self) -> None:
        delay = 1
        loop = asyncio.get_running_loop()
        while True:
            started = loop.time()
            try:
                await self.run_once()
            except Exception as exc:
                # Revoked or mis-scoped keys will not recover by reconnecting.
                # Do not print connection or handshake data.
                if _authentication_rejected(exc):
                    logger.error(
                        "QDIP Worker authentication rejected; credentials require intervention"
                    )
                    raise WorkerAuthenticationError(
                        "QDIP Worker authentication rejected (401/403/4403)"
                    ) from None
                # Socket closures/network failures are transient. Exception
                # payloads may contain handshake metadata: don't log them.
                logger.warning("Remote connection unavailable; retrying with backoff")
            # Long healthy sessions reset backoff; repeated short successful
            # disconnects must never cause a hot reconnect loop.
            if loop.time() - started >= STABLE_SESSION_SECONDS:
                delay = 1
            wait = min(RECONNECT_MAX_SECONDS, random.uniform(0.8, 1.0) * delay)
            await asyncio.sleep(wait)
            delay = min(delay * 2, RECONNECT_MAX_SECONDS)


def load_handler(reference: str) -> Handler:
    """Explicit developer-owned module:callable. Never sent to QDIP Server."""
    module_name, separator, symbol = reference.partition(":")
    if not separator or not module_name or not symbol:
        raise ValueError("Handler must be a Python import path module:function")
    handler = getattr(importlib.import_module(module_name), symbol)
    if not callable(handler):
        raise TypeError("Configured handler is not callable")
    return handler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an outbound QDIP decision plugin worker")
    parser.add_argument("--handler", required=True, help="Installed module:function")
    parser.add_argument("--plugin-id", required=True)
    parser.add_argument("--capability-id", required=True)
    parser.add_argument("--version", default="0.1.0")
    parser.add_argument("--display-name", default=None)
    parser.add_argument("--description", default="")
    parser.add_argument("--category", default="Other")
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    url = os.environ.get("QDIP_REMOTE_URL", "")
    key = os.environ.get("QDIP_REMOTE_API_KEY", "")
    if not url or not key:
        parser.error("QDIP_REMOTE_URL and QDIP_REMOTE_API_KEY must be configured")
    config = WorkerConfig(
        server_url=url,
        api_key=key,
        plugin_id=arguments.plugin_id,
        plugin_version=arguments.version,
        capability_id=arguments.capability_id,
        display_name=arguments.display_name,
        description=arguments.description,
        category=arguments.category,
    )
    asyncio.run(Worker(config, load_handler(arguments.handler)).run_forever())


if __name__ == "__main__":
    main()
