"""
nba_guard.py: shared throttle, proxy and circuit breaker for every nba_api call.

Put this file in the server's python/ folder, then add ONE line near the top of
every script that uses nba_api (before its first NBA request):

    import nba_guard  # noqa: F401

From then on, every stats.nba.com request made by nba_api automatically:

  1. Waits its turn. At most one request every NBA_MIN_GAP seconds (default 2.5),
     plus a little random jitter, shared across ALL scripts running at once on
     this machine, so parallel requests can't turn into a burst.
  2. Goes through NBA_PROXY when that environment variable is set
     (e.g. the laptop relay: http://100.x.y.z:8899), unless a call passes its own.
  3. Stops immediately while the NBA is blocking us. On an "Access Denied" page it
     pauses ALL NBA requests for 15 minutes, then 30, 60, ... up to 6 hours if the
     blocks keep coming, and resets after the next successful request.

Settings (environment variables, all optional):
  NBA_MIN_GAP    seconds between requests          (default 2.5)
  NBA_JITTER     extra random seconds, 0..JITTER   (default 1.0)
  NBA_PROXY      proxy URL for stats.nba.com        (default none)
  NBA_GUARD_DIR  where shared state is kept         (default /tmp/nba_guard)
"""
import json
import os
import random
import time

try:
    import fcntl  # Linux / Docker: cross-process locking
except ImportError:  # Windows: throttle still works, but only within one process
    fcntl = None

from nba_api.stats.library.http import NBAStatsHTTP

MIN_GAP = float(os.environ.get("NBA_MIN_GAP", "2.5"))
JITTER = float(os.environ.get("NBA_JITTER", "1.0"))
PROXY = os.environ.get("NBA_PROXY") or None
STATE_DIR = os.environ.get("NBA_GUARD_DIR", "/tmp/nba_guard")

BASE_BACKOFF = 15 * 60       # first block: pause 15 minutes
MAX_BACKOFF = 6 * 60 * 60    # never pause longer than 6 hours

os.makedirs(STATE_DIR, exist_ok=True)
STATE_FILE = os.path.join(STATE_DIR, "state.json")
LOCK_FILE = os.path.join(STATE_DIR, "lock")


class NBABlockedError(RuntimeError):
    """Raised instead of calling the NBA while it is blocking us."""


class _Lock:
    """Exclusive lock shared by every process on this machine."""

    def __enter__(self):
        self._f = open(LOCK_FILE, "a+")
        if fcntl:
            fcntl.flock(self._f, fcntl.LOCK_EX)
        return self

    def __exit__(self, *exc):
        if fcntl:
            fcntl.flock(self._f, fcntl.LOCK_UN)
        self._f.close()


def _read_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _write_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_FILE)


def _wait_turn():
    """Block until it's this request's turn, or raise if the NBA is blocking us."""
    with _Lock():
        state = _read_state()
        now = time.time()

        blocked_until = state.get("blocked_until", 0)
        if now < blocked_until:
            mins = int((blocked_until - now) / 60) + 1
            raise NBABlockedError(f"NBA requests paused for ~{mins} more min after a block")

        gap = MIN_GAP + random.uniform(0, JITTER)
        wait = state.get("last_request", 0) + gap - now
        if wait > 0:
            time.sleep(wait)  # holding the lock, so other scripts queue behind us

        state["last_request"] = time.time()
        _write_state(state)


def _record_block():
    with _Lock():
        state = _read_state()
        blocks = state.get("blocks", 0) + 1
        pause = min(BASE_BACKOFF * 2 ** (blocks - 1), MAX_BACKOFF)
        state["blocks"] = blocks
        state["blocked_until"] = time.time() + pause
        _write_state(state)
    return pause


def _record_success():
    with _Lock():
        state = _read_state()
        if state.get("blocks"):
            state["blocks"] = 0
            state["blocked_until"] = 0
            _write_state(state)


def _looks_blocked(resp):
    try:
        text = resp.get_response() or ""
    except Exception:  # noqa: BLE001
        return False
    head = text[:500]
    return "Access Denied" in head or "<HTML><HEAD>" in head


_original_send = NBAStatsHTTP.send_api_request


def _guarded_send(self, *args, **kwargs):
    if PROXY and not kwargs.get("proxy"):
        kwargs["proxy"] = PROXY

    _wait_turn()
    resp = _original_send(self, *args, **kwargs)

    if _looks_blocked(resp):
        pause = _record_block()
        raise NBABlockedError(
            f"NBA returned Access Denied; pausing NBA requests for {pause // 60} min"
        )

    _record_success()
    return resp


if not getattr(NBAStatsHTTP, "_nba_guard_installed", False):
    NBAStatsHTTP.send_api_request = _guarded_send
    NBAStatsHTTP._nba_guard_installed = True