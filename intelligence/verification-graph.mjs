import { loadKnowledge } from "./research-knowledge.mjs";

export function buildVerificationGraph(knowledge = loadKnowledge()) {
  const edges = [];
  for (const review of knowledge.reviews) {
    edges.push({ id:`validated-by:${review.claimId}:${review.id}`, from:review.claimId, to:review.id, type:"validated-by", status:review.status });
  }
  for (const evidence of knowledge.evidence) {
    edges.push({ id:`supported-by:${evidence.claimId}:${evidence.id}`, from:evidence.claimId, to:evidence.id, type:"supported-by", evidenceClass:evidence.evidenceClass });
  }
  const coverage = knowledge.claims.map((claim) => {
    const evidence = knowledge.evidence.filter((x) => x.claimId === claim.id);
    const reviews = knowledge.reviews.filter((x) => x.claimId === claim.id);
    return {
      claimId:claim.id,
      claimStatus:claim.status,
      evidenceIds:evidence.map((x) => x.id),
      reviewIds:reviews.map((x) => x.id),
      structurallyCovered:evidence.length > 0 || reviews.length > 0
    };
  });
  return Object.freeze({ nodes:[...knowledge.claims, ...knowledge.evidence, ...knowledge.reviews], edges, coverage });
}
