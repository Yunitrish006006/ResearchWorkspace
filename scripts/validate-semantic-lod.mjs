import assert from "node:assert/strict";
import fs from "node:fs";
const html=fs.readFileSync(new URL("../site/index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../site/research-graph-v2.js",import.meta.url),"utf8");
for(const token of ["graph3d","expandAll3d","edgeFilters"])assert.ok(html.includes(token),token);
for(const token of ["topic","claim","study","evidence","review","expanded","clusterRadius","scatter","project"])assert.ok(js.includes(token),token);
console.log("Progressive Semantic LOD / 3D viewer parity contract OK");
