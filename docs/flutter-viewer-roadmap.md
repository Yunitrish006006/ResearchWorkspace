# Flutter Viewer parity

ResearchWorkspace Flutter is the production GitHub Pages root. Legacy JavaScript remains a rollback
and debug surface.

Both consume the same graph model and are regression-checked for:

- Topic → Claim → Study/Evidence/Verification Semantic LOD;
- typed research relations;
- Change Intelligence;
- impacted Topic highlighting;
- verification pass/run/fail state;
- Agent Activity focus;
- Research Replay historical entity filtering;
- Local Bridge status and Prompt;
- artifact-drift status.

CI uses Flutter 3.47.0 and runs `flutter analyze`, `flutter test`, and WebAssembly build.

The visual implementations need not be pixel-identical. Behavioral and semantic parity is the
contract.
