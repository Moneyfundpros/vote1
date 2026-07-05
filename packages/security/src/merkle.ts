import { createHash } from 'node:crypto';

/**
 * Merkle tree over per-vote commitments (ADR-0003). Leaves are opaque hashes that reveal nothing
 * about (voter, option) without the preimage; the published artifact is only the root. An inclusion
 * proof returns sibling hashes (never raw tuples), so a voter can verify their vote is in the tree
 * while ballot secrecy holds.
 */

const sha256 = (b: Buffer): Buffer => createHash('sha256').update(b).digest();

/** Commitment for one vote row. Preimage known only to the voter; the leaf is a one-way hash. */
export function leafCommitment(pollId: number, voterId: string, optionId: number, voteId: number): Buffer {
  return sha256(Buffer.from(`${pollId}|${voterId}|${optionId}|${voteId}`, 'utf8'));
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  return sha256(Buffer.concat([a, b]));
}

export interface MerkleTree {
  root: Buffer;
  layers: Buffer[][]; // layers[0] = leaves, last = [root]
}

export function buildMerkle(leaves: Buffer[]): MerkleTree {
  if (leaves.length === 0) {
    const empty = sha256(Buffer.from('empty'));
    return { root: empty, layers: [[empty]] };
  }
  const layers: Buffer[][] = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // duplicate last node on odd count
      next.push(hashPair(left, right));
    }
    layers.push(next);
    level = next;
  }
  return { root: layers[layers.length - 1]![0]!, layers };
}

/** Sibling path for the leaf at `index`. */
export function merkleProof(tree: MerkleTree, index: number): { sibling: string; right: boolean }[] {
  const proof: { sibling: string; right: boolean }[] = [];
  let idx = index;
  for (let l = 0; l < tree.layers.length - 1; l++) {
    const level = tree.layers[l]!;
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = level[sibIdx] ?? level[idx]!; // duplicated last node
    proof.push({ sibling: sibling.toString('hex'), right: !isRight });
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf: Buffer, proof: { sibling: string; right: boolean }[], root: Buffer): boolean {
  let acc = leaf;
  for (const step of proof) {
    const sib = Buffer.from(step.sibling, 'hex');
    acc = step.right ? hashPair(acc, sib) : hashPair(sib, acc);
  }
  return acc.equals(root);
}
