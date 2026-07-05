import { and, asc, desc, eq, getReplicaDb, gt, lte } from '@voter/db';
import { auditAnchors, certifiedResults, resultExports, votes } from '@voter/db';
import { buildMerkle, leafCommitment, merkleProof, verifyMerkleProof } from '@voter/security';

export interface InclusionProof {
  found: boolean;
  root?: string;
  anchorId?: number;
  proof?: { sibling: string; right: boolean }[];
}

/**
 * Transparency/audit reads (replica-only, ADR-0003). Inclusion proofs recompute a batch's leaves
 * server-side to locate a commitment, returning ONLY sibling hashes + the anchored root — never raw
 * (voter, option) tuples. A voter who knows their own preimage can verify their vote is in the tree.
 */
export class AuditRepoDrizzle {
  private readonly maxAnchorsScanned = Number(process.env.AUDIT_MAX_ANCHORS ?? '500');

  async summary(pollId: number): Promise<Record<string, unknown> | null> {
    const [cert] = await getReplicaDb()
      .select({
        totalVotes: certifiedResults.totalVotes,
        checksum: certifiedResults.checksum,
        certifiedAt: certifiedResults.certifiedAt,
        exportObjectKey: certifiedResults.exportObjectKey,
      })
      .from(certifiedResults)
      .where(eq(certifiedResults.pollId, pollId))
      .limit(1);
    if (!cert) return null;
    return {
      pollId,
      totalVotes: cert.totalVotes,
      checksum: cert.checksum.toString('hex'),
      certifiedAt: cert.certifiedAt,
      exportObjectKey: cert.exportObjectKey,
      methodology: 'one-verified-human-one-vote; Merkle-anchored audit log; results recomputable from the signed export.',
    };
  }

  async listExports(pollId?: number): Promise<{ id: string; kind: string; objectKey: string; checksum: string; createdAt: Date }[]> {
    const rows = await getReplicaDb()
      .select({
        id: resultExports.id,
        kind: resultExports.kind,
        objectKey: resultExports.objectKey,
        checksum: resultExports.checksum,
        createdAt: resultExports.createdAt,
      })
      .from(resultExports)
      .where(pollId ? eq(resultExports.pollId, pollId) : undefined)
      .orderBy(desc(resultExports.createdAt))
      .limit(100);
    return rows.map((r) => ({ ...r, checksum: r.checksum.toString('hex') }));
  }

  async verifyChecksum(checksumHex: string): Promise<{ valid: boolean; pollId?: number }> {
    const buf = Buffer.from(checksumHex, 'hex');
    const [row] = await getReplicaDb()
      .select({ pollId: certifiedResults.pollId })
      .from(certifiedResults)
      .where(eq(certifiedResults.checksum, buf))
      .limit(1);
    return row ? { valid: true, pollId: row.pollId } : { valid: false };
  }

  async inclusionProof(pollId: number, commitmentHex: string): Promise<InclusionProof> {
    const target = Buffer.from(commitmentHex, 'hex');
    const db = getReplicaDb();
    const anchors = await db
      .select({ id: auditAnchors.id, from: auditAnchors.batchFromId, to: auditAnchors.batchToId, root: auditAnchors.merkleRoot })
      .from(auditAnchors)
      .where(eq(auditAnchors.pollId, pollId))
      .orderBy(asc(auditAnchors.id))
      .limit(this.maxAnchorsScanned);

    for (const anchor of anchors) {
      const rows = await db
        .select({ id: votes.id, voterId: votes.voterId, optionId: votes.optionId })
        .from(votes)
        .where(and(eq(votes.pollId, pollId), gt(votes.id, anchor.from - 1), lte(votes.id, anchor.to)))
        .orderBy(asc(votes.id));
      const leaves = rows.map((r) => leafCommitment(pollId, r.voterId, r.optionId, r.id));
      const index = leaves.findIndex((l) => l.equals(target));
      if (index === -1) continue;
      const tree = buildMerkle(leaves);
      const proof = merkleProof(tree, index);
      // Sanity: the recomputed root must match the anchored root.
      if (!tree.root.equals(anchor.root) || !verifyMerkleProof(leaves[index]!, proof, anchor.root)) continue;
      return { found: true, root: anchor.root.toString('hex'), anchorId: anchor.id, proof };
    }
    return { found: false };
  }
}
