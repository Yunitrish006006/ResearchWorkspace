import assert from "node:assert/strict";
import { replayFrame, replayTimeline } from "../intelligence/research-replay.mjs";
const t=replayTimeline();
assert.ok(t.latestSequence>=t.earliestSequence);
const f=replayFrame(t.latestSequence);
assert.equal(f.live,true);
console.log("Research Replay OK");
