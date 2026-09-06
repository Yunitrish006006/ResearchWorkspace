window.__RESEARCH_GRAPH_DATA__ = {
  "snapshot": {
    "date": "2026-09-06",
    "thesisRepo": "Yunitrish006006/Three-Factor-Digital-Twin",
    "thesisCommit": "ea1d9194c8252e81cae2fe6842fa4064bab97397",
    "referenceRepo": "Yunitrish006006/TotemWorkspace",
    "referenceCommit": "74822eb2de6a6bdf31c595b4f148a536a023b105"
  },
  "root": {
    "id": "thesis",
    "name": "Three-Factor Digital Twin",
    "summary": "Single-room sparse-sensing spatial digital twin for temperature, relative humidity and illuminance."
  },
  "topics": [
    {
      "id": "scope",
      "name": "Research Scope",
      "summary": "Single-room, three-factor estimation with explicit scientific boundaries.",
      "rankHint": 1
    },
    {
      "id": "spatial",
      "name": "Spatial Estimation",
      "summary": "Furniture-aware sparse sensing, nominal model, IDW and target-point estimation.",
      "rankHint": 1
    },
    {
      "id": "hybrid",
      "name": "Hybrid Residual",
      "summary": "Data-driven residual correction on top of interpretable nominal prediction.",
      "rankHint": 2
    },
    {
      "id": "evidence",
      "name": "Evaluation & Evidence",
      "summary": "E1–E9 registry, metrics, evidence classes and reproducibility.",
      "rankHint": 1
    },
    {
      "id": "public",
      "name": "Public Benchmarks",
      "summary": "Task-aligned SML2010 and CU-BEMS evaluation with strong baselines.",
      "rankHint": 2
    },
    {
      "id": "action",
      "name": "Action Ranking",
      "summary": "Counterfactual candidate action ranking; causal intervention remains pending.",
      "rankHint": 2
    },
    {
      "id": "governance",
      "name": "Research Governance",
      "summary": "Claim-to-evidence traceability, artifact synchronization and OpenSpec boundaries.",
      "rankHint": 2
    }
  ],
  "claims": [
    {
      "id": "claim-primary",
      "ownerId": "scope",
      "title": "Interpretable primary estimator",
      "summary": "Variable-specific nominal models remain the primary estimator; learned models correct residual error.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-three-factor",
      "ownerId": "scope",
      "title": "Three-factor single-room scope",
      "summary": "Current validated scope is temperature, relative humidity and illuminance in one room.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-free-space",
      "ownerId": "spatial",
      "title": "Furniture-aware target-point estimation",
      "summary": "Sensor placement and evaluation distinguish free space, occupied geometry and explicit target points.",
      "status": "PARTIAL"
    },
    {
      "id": "claim-baseline",
      "ownerId": "spatial",
      "title": "Comparable estimator baselines",
      "summary": "Base physics, corrected model and IDW must use equivalent targets, inputs and metrics.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-hybrid",
      "ownerId": "hybrid",
      "title": "Hybrid residual improves controlled residual fit",
      "summary": "Residual correction is evaluated with held-out and leave-one-scenario-out evidence.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-evidence-boundary",
      "ownerId": "evidence",
      "title": "Evidence classes stay separate",
      "summary": "Synthetic full-field, real target-point, public benchmark and intervention evidence cannot be conflated.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-e7",
      "ownerId": "evidence",
      "title": "Real pillow target-point calibration improvement",
      "summary": "E7 supports one-room, one-held-out pillow point improvement across the observed seven-day snapshot study.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-public",
      "ownerId": "public",
      "title": "Task-aligned public benchmark",
      "summary": "Public datasets support shared temporal tasks, not dense 3-D spatial ground truth.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-persistence",
      "ownerId": "public",
      "title": "Persistence remains a strong baseline",
      "summary": "CU-BEMS results retain cases where persistence outperforms the proposed mapped readout.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-action",
      "ownerId": "action",
      "title": "Recommendation is counterfactual ranking",
      "summary": "Until E8 is completed, recommendations are model-based rankings rather than proven causal control.",
      "status": "SUPPORTED"
    },
    {
      "id": "claim-causal",
      "ownerId": "action",
      "title": "Real causal efficacy",
      "summary": "Before/after intervention evidence is not yet complete.",
      "status": "NOT_SUPPORTED"
    },
    {
      "id": "claim-trace",
      "ownerId": "governance",
      "title": "Claim-to-evidence traceability",
      "summary": "Every core claim should point to an experiment, metric, artifact and bounded interpretation.",
      "status": "PARTIAL"
    },
    {
      "id": "claim-sync",
      "ownerId": "governance",
      "title": "Thesis-facing artifacts stay synchronized",
      "summary": "Chinese thesis, IEEE manuscript, presentation and figures should share the same method status and core results.",
      "status": "PARTIAL"
    }
  ],
  "studies": [
    {
      "id": "study-physics",
      "claimId": "claim-primary",
      "title": "Variable-specific nominal models",
      "kind": "METHOD",
      "summary": "Temperature, humidity and illuminance use separate physics-inspired paths."
    },
    {
      "id": "study-idw",
      "claimId": "claim-baseline",
      "title": "Sensor IDW baseline",
      "kind": "BASELINE",
      "summary": "Shared-target interpolation baseline."
    },
    {
      "id": "study-hybrid",
      "claimId": "claim-hybrid",
      "title": "Hybrid residual model",
      "kind": "METHOD",
      "summary": "Nominal prediction plus learned residual correction."
    },
    {
      "id": "study-e1",
      "claimId": "claim-baseline",
      "title": "E1 / E2 controlled reconstruction",
      "kind": "EXPERIMENT",
      "summary": "Canonical full-field reconstruction and IDW comparison."
    },
    {
      "id": "study-e7",
      "claimId": "claim-e7",
      "title": "E7 seven-day bedroom snapshot",
      "kind": "EXPERIMENT",
      "summary": "28 snapshots with unseen pillow reference point."
    },
    {
      "id": "study-e9",
      "claimId": "claim-public",
      "title": "E9 public task-aligned benchmark",
      "kind": "EXPERIMENT",
      "summary": "SML2010 and CU-BEMS chronological task comparisons."
    },
    {
      "id": "study-e8",
      "claimId": "claim-causal",
      "title": "E8 before/after intervention",
      "kind": "PROTOCOL",
      "summary": "Future causal validation protocol; no completed causal summary yet."
    }
  ],
  "evidence": [
    {
      "id": "ev-validation",
      "claimId": "claim-baseline",
      "title": "validation_summary.json",
      "summary": "Controlled scenario result source.",
      "path": "outputs/data/validation_summary.json",
      "evidenceClass": "controlled simulation"
    },
    {
      "id": "ev-hybrid",
      "claimId": "claim-hybrid",
      "title": "hybrid_residual_summary.json",
      "summary": "576 / 192 default split plus residual metrics.",
      "path": "outputs/data/hybrid_residual_summary.json",
      "evidenceClass": "controlled simulation"
    },
    {
      "id": "ev-loso",
      "claimId": "claim-hybrid",
      "title": "submission_readiness_summary.json",
      "summary": "Eight leave-one-scenario-out folds.",
      "path": "outputs/data/submission_readiness_summary.json",
      "evidenceClass": "robustness"
    },
    {
      "id": "ev-e7",
      "claimId": "claim-e7",
      "title": "weekly_simulation_summary.json",
      "summary": "7 days / 28 snapshots; pillow target-point evidence.",
      "path": "outputs/data/bedroom_01_weekly/weekly_simulation_summary.json",
      "evidenceClass": "real target-point"
    },
    {
      "id": "ev-sml",
      "claimId": "claim-public",
      "title": "SML2010 benchmark outputs",
      "summary": "Task-aligned shared-data comparison.",
      "path": "outputs/data/public_benchmarks/",
      "evidenceClass": "public benchmark"
    },
    {
      "id": "ev-cubems",
      "claimId": "claim-persistence",
      "title": "CU-BEMS benchmark outputs",
      "summary": "Retains persistence wins and mapped-readout limitations.",
      "path": "outputs/data/public_benchmarks/",
      "evidenceClass": "public benchmark"
    },
    {
      "id": "ev-openspec",
      "claimId": "claim-trace",
      "title": "research-first OpenSpec",
      "summary": "Research contract and evidence governance requirements.",
      "path": "openspec/specs/",
      "evidenceClass": "governance"
    },
    {
      "id": "ev-sync",
      "claimId": "claim-sync",
      "title": "thesis_sync_status_zh.md",
      "summary": "Records known synchronization gaps.",
      "path": "docs/thesis/thesis_sync_status_zh.md",
      "evidenceClass": "governance"
    }
  ],
  "reviews": [
    {
      "id": "review-e1",
      "claimId": "claim-baseline",
      "title": "E1/E2 reproducible",
      "status": "PASS",
      "summary": "Controlled reconstruction and IDW comparison have reproducible evidence."
    },
    {
      "id": "review-e6",
      "claimId": "claim-hybrid",
      "title": "E6 reproducible",
      "status": "PASS",
      "summary": "Hybrid residual robustness is currently reproducible."
    },
    {
      "id": "review-e7",
      "claimId": "claim-e7",
      "title": "E7 bounded real evidence",
      "status": "PASS",
      "summary": "Supports pillow target-point improvement only; not dense real-room ground truth."
    },
    {
      "id": "review-e9",
      "claimId": "claim-public",
      "title": "E9 conditional",
      "status": "WARN",
      "summary": "Reproducible when required public evidence JSON/data are present."
    },
    {
      "id": "review-e8",
      "claimId": "claim-causal",
      "title": "E8 pending",
      "status": "FAIL",
      "summary": "No completed before/after intervention evidence; causal efficacy claim remains unsupported."
    },
    {
      "id": "review-sync",
      "claimId": "claim-sync",
      "title": "Artifact sync incomplete",
      "status": "WARN",
      "summary": "Markdown / IEEE / PPT / claim-evidence synchronization has known incomplete items."
    }
  ],
  "relations": [
    {
      "id": "rel-physics-spatial",
      "from": "claim-primary",
      "to": "claim-free-space",
      "type": "uses-method",
      "label": "primary estimator feeds target-point estimation"
    },
    {
      "id": "rel-hybrid-primary",
      "from": "claim-hybrid",
      "to": "claim-primary",
      "type": "grounded-in",
      "label": "residual corrects nominal prediction"
    },
    {
      "id": "rel-public-boundary",
      "from": "claim-public",
      "to": "claim-evidence-boundary",
      "type": "grounded-in",
      "label": "public task ≠ dense 3-D truth"
    },
    {
      "id": "rel-persistence-limit",
      "from": "claim-persistence",
      "to": "claim-public",
      "type": "limits",
      "label": "strong baseline constrains superiority claim"
    },
    {
      "id": "rel-action-limit",
      "from": "claim-causal",
      "to": "claim-action",
      "type": "limits",
      "label": "E8 missing"
    },
    {
      "id": "rel-trace-sync",
      "from": "claim-trace",
      "to": "claim-sync",
      "type": "supports",
      "label": "traceability drives synchronization"
    }
  ]
};