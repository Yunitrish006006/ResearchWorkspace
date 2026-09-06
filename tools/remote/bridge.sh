#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRIDGE_ENV_FILE="${RESEARCH_BRIDGE_ENV_FILE:-$ROOT/.research-index/bridge.env}"
if [[ -r "$BRIDGE_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BRIDGE_ENV_FILE"
  set +a
fi

SESSION="${RESEARCH_BRIDGE_SESSION:-research-workspace-bridge}"
HOST="127.0.0.1"
PORT="${RESEARCH_BRIDGE_PORT:-18775}"
BACKEND="${RESEARCH_BRIDGE_BACKEND:-auto}"
LOG="${RESEARCH_BRIDGE_LOG:-$ROOT/.research-index/remote-bridge.log}"
PID_FILE="${RESEARCH_BRIDGE_PID_FILE:-$ROOT/.research-index/remote-bridge.pid}"
FLUTTER_STAMP="${RESEARCH_FLUTTER_STAMP:-$ROOT/.research-index/flutter-build.sha256}"
FLUTTER_BUILD_MODE="${RESEARCH_FLUTTER_BUILD_MODE:-auto}"
FLUTTER_VERSION="${RESEARCH_FLUTTER_VERSION:-3.47.0}"
FLUTTER_HOME="${RESEARCH_FLUTTER_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/research-workspace/flutter/$FLUTTER_VERSION}"
FLUTTER_BOOTSTRAP="${RESEARCH_FLUTTER_BOOTSTRAP:-auto}"
FORCE="${RESEARCH_BRIDGE_FORCE:-0}"
ACTION="${1:-status}"

usage(){
cat <<'EOF'
ResearchWorkspace remote bridge controller

Usage:
  bash tools/remote/bridge.sh start
  bash tools/remote/bridge.sh stop
  bash tools/remote/bridge.sh restart
  bash tools/remote/bridge.sh status
  bash tools/remote/bridge.sh logs
  bash tools/remote/bridge.sh follow
  bash tools/remote/bridge.sh attach
  bash tools/remote/bridge.sh doctor

Environment:
  RESEARCH_BRIDGE_PORT=18775
  RESEARCH_BRIDGE_BACKEND=auto|tmux|nohup
  RESEARCH_BRIDGE_SESSION=research-workspace-bridge
  RESEARCH_BRIDGE_ENV_FILE=.research-index/bridge.env
  RESEARCH_FLUTTER_BUILD_MODE=auto|always|never
  RESEARCH_FLUTTER_BOOTSTRAP=auto|never
  RESEARCH_AGENT_ADAPTER=off|codex
  RESEARCH_CODEX_BIN=codex
  RESEARCH_CODEX_CWD=<ResearchWorkspace or thesis repo>
  RESEARCH_CODEX_SANDBOX=workspace-write|read-only
  RESEARCH_CODEX_MODEL=<optional>
  RESEARCH_CONVERSATION_SYNC_TOKEN=<at least 16 random chars>
  RESEARCH_BRIDGE_FORCE=1
EOF
}
require_command(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2;return 1;}; }
tmux_running(){ command -v tmux >/dev/null 2>&1 && tmux has-session -t "$SESSION" 2>/dev/null; }
pid_running(){ [[ -f "$PID_FILE" ]] || return 1;pid="$(cat "$PID_FILE" 2>/dev/null||true)";[[ "$pid" =~ ^[0-9]+$ ]]||return 1;kill -0 "$pid" 2>/dev/null; }
health_ok(){ curl -fsS --max-time 1 "http://$HOST:$PORT/api/health" 2>/dev/null | grep -q '"mode"[[:space:]]*:[[:space:]]*"local"'; }
agent_busy(){ curl -fsS --max-time 1 "http://$HOST:$PORT/api/agent-adapter" 2>/dev/null | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{try{process.exit(JSON.parse(s).busy===true?0:1)}catch{process.exit(1)}})'; }
guard_agent_idle(){
  action="$1"
  [[ "$FORCE" == "1" ]] && { echo "Active-task guard bypassed for $action.";return 0; }
  if health_ok && agent_busy;then
    echo "Refusing Bridge $action: Codex has an active task." >&2
    echo "Emergency override: RESEARCH_BRIDGE_FORCE=1 bash tools/remote/bridge.sh $action" >&2
    return 7
  fi
}
port_in_use(){
  if command -v ss >/dev/null 2>&1;then ss -H -ltn "sport = :$PORT" 2>/dev/null|grep -q .;return;fi
  if command -v lsof >/dev/null 2>&1;then lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1;return;fi
  return 1
}
selected_backend(){
  case "$BACKEND" in
    auto) command -v tmux >/dev/null 2>&1&&echo tmux||echo nohup ;;
    tmux) require_command tmux >/dev/null;echo tmux ;;
    nohup) echo nohup ;;
    *) echo "Invalid RESEARCH_BRIDGE_BACKEND: $BACKEND" >&2;exit 2 ;;
  esac
}
render_flutter_graph_asset(){ node "$ROOT/scripts/render-flutter-graph.mjs" >/dev/null; }
flutter_fingerprint(){ node "$ROOT/scripts/flutter-local-build-fingerprint.mjs"; }
flutter_command(){
  if command -v flutter >/dev/null 2>&1;then command -v flutter;return 0;fi
  if [[ -x "$FLUTTER_HOME/bin/flutter" ]];then printf '%s/bin/flutter\n' "$FLUTTER_HOME";return 0;fi
  return 1
}
ensure_flutter_toolchain(){
  if command_path="$(flutter_command)";then printf '%s\n' "$command_path";return 0;fi
  case "$FLUTTER_BOOTSTRAP" in
    auto)
      echo "Flutter SDK missing; bootstrapping pinned Flutter $FLUTTER_VERSION..." >&2
      RESEARCH_FLUTTER_VERSION="$FLUTTER_VERSION" RESEARCH_FLUTTER_HOME="$FLUTTER_HOME" bash "$ROOT/tools/remote/bootstrap-flutter.sh" install >&2
      flutter_command ;;
    never) echo "Flutter SDK missing and RESEARCH_FLUTTER_BOOTSTRAP=never." >&2;return 1 ;;
    *) echo "Invalid RESEARCH_FLUTTER_BOOTSTRAP: $FLUTTER_BOOTSTRAP" >&2;return 1 ;;
  esac
}
flutter_build_ready(){
  [[ -f "$ROOT/viewer_flutter/build/web/index.html" ]]||return 1
  [[ -f "$FLUTTER_STAMP" ]]||return 1
  [[ "$(flutter_fingerprint)" == "$(cat "$FLUTTER_STAMP" 2>/dev/null||true)" ]]
}
ensure_flutter_build(){
  require_command node;mkdir -p "$(dirname "$FLUTTER_STAMP")";render_flutter_graph_asset
  case "$FLUTTER_BUILD_MODE" in
    auto) flutter_build_ready&&{ echo "Flutter viewer: READY (cached build)";return 0;} ;;
    always) ;;
    never) [[ -f "$ROOT/viewer_flutter/build/web/index.html" ]]&&{ echo "Flutter viewer: using existing build";return 0;};echo "Flutter build missing." >&2;exit 6 ;;
    *) echo "Invalid RESEARCH_FLUTTER_BUILD_MODE: $FLUTTER_BUILD_MODE" >&2;exit 2 ;;
  esac
  flutter_cmd="$(ensure_flutter_toolchain)"||{ echo "No usable Flutter SDK." >&2;exit 6; }
  echo "Flutter viewer: building local Wasm root..."
  (cd "$ROOT/viewer_flutter";"$flutter_cmd" pub get;"$flutter_cmd" build web --wasm --base-href /)
  flutter_fingerprint>"$FLUTTER_STAMP";echo "Flutter viewer: BUILT"
}
show_agent_status(){
  adapter_json="$(curl -fsS --max-time 1 "http://$HOST:$PORT/api/agent-adapter" 2>/dev/null||true)"
  [[ -z "$adapter_json" ]]&&{ echo "agent: UNKNOWN";return 0; }
  node - "$adapter_json" <<'NODE'
const a=JSON.parse(process.argv[2]||"{}"),current=a.currentTask,last=a.lastTask;
if(a.busy&&current)console.log("agent: RUNNING "+current.id+(current.summary?" · "+current.summary:""));
else if(last)console.log("agent: "+String(last.state||"unknown").toUpperCase()+" "+last.id);
else console.log(a.available?"agent: READY · no recorded task":"agent: "+(a.configured?"UNAVAILABLE":"OFF"));
NODE
}
show_status(){
  owner=none
  tmux_running&&owner="tmux:$SESSION"
  if [[ "$owner" == none ]]&&pid_running;then owner="nohup:$(cat "$PID_FILE")";fi
  echo "process: $owner"
  if health_ok;then echo "bridge: HEALTHY http://$HOST:$PORT";show_agent_status;return 0
  elif port_in_use;then echo "bridge: PORT $PORT IN USE but health failed";return 2
  else echo "bridge: NOT LISTENING on $HOST:$PORT";return 1;fi
}
start_bridge(){
  require_command node;require_command curl;ensure_flutter_build
  mkdir -p "$(dirname "$LOG")" "$(dirname "$PID_FILE")"
  if tmux_running||pid_running;then echo "Research Bridge background process already running.";show_status||true;return 0;fi
  if port_in_use;then health_ok&&{ echo "Research Bridge already healthy but unowned.";return 0;};echo "Port $PORT is occupied." >&2;exit 3;fi
  :>"$LOG";rm -f "$PID_FILE";backend="$(selected_backend)"
  if [[ "$backend" == tmux ]];then tmux new-session -d -s "$SESSION" -c "$ROOT" "exec node scripts/serve-local-viewer.mjs --port '$PORT' >> '$LOG' 2>&1"
  else (cd "$ROOT";nohup node scripts/serve-local-viewer.mjs --port "$PORT" >>"$LOG" 2>&1 </dev/null & echo "$!">"$PID_FILE");fi
  for _ in $(seq 1 24);do
    if health_ok;then echo "Research Bridge started with backend: $backend";echo "Remote bridge: http://$HOST:$PORT";echo "Log: $LOG";return 0;fi
    [[ "$backend" == tmux ]]&&! tmux_running&&{ tail -n 80 "$LOG" >&2||true;exit 4; }
    [[ "$backend" == nohup ]]&&! pid_running&&{ tail -n 80 "$LOG" >&2||true;exit 4; }
    sleep .25
  done
  echo "Research Bridge did not become healthy in time." >&2;tail -n 80 "$LOG" >&2||true;exit 5
}
stop_bridge(){
  stopped=0
  if tmux_running;then tmux kill-session -t "$SESSION";echo "Stopped tmux session: $SESSION";stopped=1;fi
  if pid_running;then pid="$(cat "$PID_FILE")";kill "$pid" 2>/dev/null||true;for _ in $(seq 1 20);do kill -0 "$pid" 2>/dev/null||break;sleep .1;done;kill -0 "$pid" 2>/dev/null&&kill -9 "$pid" 2>/dev/null||true;rm -f "$PID_FILE";echo "Stopped nohup process: $pid";stopped=1
  elif [[ -f "$PID_FILE" ]];then rm -f "$PID_FILE";fi
  [[ "$stopped" -eq 0 ]]&&echo "Research Bridge controller has no running background process."
}
doctor(){
  failed=0
  for cmd in node curl;do if command -v "$cmd" >/dev/null 2>&1;then echo "$cmd: OK ($(command -v "$cmd"))";else echo "$cmd: MISSING";failed=1;fi;done
  if command -v tmux >/dev/null 2>&1;then echo "tmux: OK";else echo "tmux: MISSING (nohup fallback available)";fi
  echo "workspace: $ROOT";echo "session: $SESSION";echo "port: $PORT";echo "log: $LOG";echo "flutter build mode: $FLUTTER_BUILD_MODE";echo "agent adapter: ${RESEARCH_AGENT_ADAPTER:-off}"
  if [[ "${RESEARCH_AGENT_ADAPTER:-off}" == codex ]];then codex_bin="${RESEARCH_CODEX_BIN:-codex}";if command -v "$codex_bin" >/dev/null 2>&1||[[ -x "$codex_bin" ]];then echo "codex: OK ($codex_bin)";"$codex_bin" --version 2>/dev/null|head -n 1||true;else echo "codex: MISSING";failed=1;fi;fi
  if flutter_build_ready;then echo "flutter viewer: READY";elif flutter_command >/dev/null 2>&1;then echo "flutter viewer: MISSING/STALE (will build)";elif [[ "$FLUTTER_BOOTSTRAP" == auto ]];then echo "flutter viewer: MISSING (will bootstrap)";else echo "flutter viewer: MISSING";failed=1;fi
  if port_in_use;then health_ok&&echo "port check: Research Bridge is already listening"||{ echo "port check: $PORT occupied by another service";failed=1;};else echo "port check: $PORT available";fi
  return "$failed"
}
case "$ACTION" in
  start) start_bridge ;;
  stop) guard_agent_idle stop;stop_bridge ;;
  restart) guard_agent_idle restart;stop_bridge;start_bridge ;;
  status) require_command curl;show_status ;;
  logs) [[ -f "$LOG" ]]&&tail -n 120 "$LOG"||echo "No bridge log yet: $LOG" ;;
  follow) mkdir -p "$(dirname "$LOG")";touch "$LOG";tail -f "$LOG" ;;
  attach) tmux_running&&exec tmux attach-session -t "$SESSION";echo "No tmux Bridge session is running." >&2;exit 1 ;;
  doctor) doctor ;;
  -h|--help|help) usage ;;
  *) echo "Unknown action: $ACTION" >&2;usage >&2;exit 2 ;;
esac
