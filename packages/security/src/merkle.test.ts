import { describe, expect, it } from 'vitest';
import { buildMerkle, leafCommitment, merkleProof, verifyMerkleProof } from './merkle';

describe('merkle', () => {
  const leaves = Array.from({ length: 7 }, (_, i) => leafCommitment(1, `voter-${i}`, 10 + (i % 3), i + 1));

  it('every leaf has a valid inclusion proof against the root (odd count)', () => {
    const tree = buildMerkle(leaves);
    leaves.forEach((leaf, i) => {
      const proof = merkleProof(tree, i);
      expect(verifyMerkleProof(leaf, proof, tree.root)).toBe(true);
    });
  });

  it('a tampered leaf fails verification', () => {
    const tree = buildMerkle(leaves);
    const wrong = leafCommitment(1, 'attacker', 99, 999);
    expect(verifyMerkleProof(wrong, merkleProof(tree, 0), tree.root)).toBe(false);
  });

  it('is deterministic and order-sensitive', () => {
    expect(buildMerkle(leaves).root.equals(buildMerkle(leaves).root)).toBe(true);
    const swapped = [leaves[1]!, leaves[0]!, ...leaves.slice(2)];
    expect(buildMerkle(leaves).root.equals(buildMerkle(swapped).root)).toBe(false);
  });

  it('handles a single leaf', () => {
    const tree = buildMerkle([leaves[0]!]);
    expect(verifyMerkleProof(leaves[0]!, merkleProof(tree, 0), tree.root)).toBe(true);
  });
});
