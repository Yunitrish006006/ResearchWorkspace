import { loadKnowledge } from "./research-knowledge.mjs";

export function buildClaimEvidenceMatrix(knowledge = loadKnowledge()) {
  const rows = knowledge.claims.map((claim) => {
    const evidence = knowledge.evidence.filter((x) => x.claimId === claim.id);
    const reviews = knowledge.reviews.filter((x) => x.claimId === claim.id);
    const studies = knowledge.studies.filter((x) => x.claimId === claim.id);
    const verificationChecks = knowledge.verificationChecks.filter((x) => x.claimIds.includes(claim.id));
    return {
      topicId:claim.ownerId,
      claimId:claim.id,
      claim:claim.title,
      status:claim.status,
      studies:studies.map((x) => ({ id:x.id, kind:x.kind, title:x.title })),
      evidence:evidence.map((x) => ({ id:x.id, evidenceClass:x.evidenceClass, path:x.path, title:x.title })),
      reviews:reviews.map((x) => ({ id:x.id, status:x.status, title:x.title })),
      verificationChecks:verificationChecks.map((x) => ({ id:x.id, status:x.status, evidenceClass:x.evidenceClass })),
      sources:claim.sources ?? [],
      structurallyCovered:evidence.length > 0 || reviews.length > 0,
      unresolved:claim.status === "PARTIAL" || claim.status === "NOT_SUPPORTED"
    };
  });
  return {
    generatedAt:new Date().toISOString(),
    rows,
    totals:{
      claims:rows.length,
      structurallyCovered:rows.filter((x) => x.structurallyCovered).length,
      unresolved:rows.filter((x) => x.unresolved).length
    }
  };
}
