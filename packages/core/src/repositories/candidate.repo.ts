import { and, desc, eq, getDb, getReplicaDb, lt, sql } from '@voter/db';
import {
  campaignPromises,
  candidateMedia,
  candidatePositions,
  candidateProfiles,
  candidates,
} from '@voter/db';
import type { CandidateCreateInput, CandidateUpdateInput } from '../validation/candidate';

export interface CandidateListItem {
  id: string;
  fullName: string;
  partyCode: string | null;
  office: string | null;
  status: string;
}

/** Candidate Information Hub repository. Reads on the replica; admin writes on the pooled primary. */
export class CandidateRepoDrizzle {
  async list(filter: {
    office?: string;
    party?: string;
    q?: string;
    cursor?: string;
    limit: number;
  }): Promise<CandidateListItem[]> {
    const conds = [eq(candidates.status, 'active')];
    if (filter.office) conds.push(eq(candidates.office, filter.office));
    if (filter.party) conds.push(eq(candidates.partyCode, filter.party));
    if (filter.q) conds.push(sql`${candidates.fullName} ilike ${'%' + filter.q + '%'}`);
    if (filter.cursor) conds.push(lt(candidates.id, filter.cursor));
    return getReplicaDb()
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        partyCode: candidates.partyCode,
        office: candidates.office,
        status: candidates.status,
      })
      .from(candidates)
      .where(and(...conds))
      .orderBy(desc(candidates.id))
      .limit(filter.limit);
  }

  async get(id: string): Promise<Record<string, unknown> | null> {
    const db = getReplicaDb();
    const [c] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
    if (!c) return null;
    const [profile] = await db.select().from(candidateProfiles).where(eq(candidateProfiles.candidateId, id)).limit(1);
    const positions = await db.select().from(candidatePositions).where(eq(candidatePositions.candidateId, id));
    const promises = await db.select().from(campaignPromises).where(eq(campaignPromises.candidateId, id));
    // Only clean (scanned) media is exposed publicly.
    const media = await db
      .select()
      .from(candidateMedia)
      .where(and(eq(candidateMedia.candidateId, id), eq(candidateMedia.scanStatus, 'clean')));
    return { ...c, profile: profile ?? null, positions, promises, media };
  }

  async create(input: CandidateCreateInput): Promise<{ id: string }> {
    const db = getDb();
    const [c] = await db
      .insert(candidates)
      .values({ fullName: input.fullName, partyCode: input.partyCode ?? null, office: input.office ?? null })
      .returning({ id: candidates.id });
    await db.insert(candidateProfiles).values({
      candidateId: c!.id,
      bio: input.bio ?? null,
      manifesto: input.manifesto ?? null,
      homeStateCode: input.homeStateCode ?? null,
    });
    return { id: c!.id };
  }

  async update(id: string, patch: CandidateUpdateInput): Promise<void> {
    const db = getDb();
    if (patch.fullName || patch.partyCode || patch.office || patch.status) {
      await db
        .update(candidates)
        .set({
          ...(patch.fullName ? { fullName: patch.fullName } : {}),
          ...(patch.partyCode !== undefined ? { partyCode: patch.partyCode } : {}),
          ...(patch.office !== undefined ? { office: patch.office } : {}),
          ...(patch.status ? { status: patch.status } : {}),
        })
        .where(eq(candidates.id, id));
    }
    if (patch.bio !== undefined || patch.manifesto || patch.homeStateCode || patch.verifiedBadge !== undefined) {
      await db
        .update(candidateProfiles)
        .set({
          ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
          ...(patch.manifesto ? { manifesto: patch.manifesto } : {}),
          ...(patch.homeStateCode ? { homeStateCode: patch.homeStateCode } : {}),
          ...(patch.verifiedBadge !== undefined ? { verifiedBadge: patch.verifiedBadge } : {}),
        })
        .where(eq(candidateProfiles.candidateId, id));
    }
  }

  /** Register an uploaded media object (pending scan; promoted to 'clean' by the media-process job). */
  async addMedia(params: { candidateId: string; objectKey: string; mediaType: string; contentType: string }): Promise<void> {
    await getDb().insert(candidateMedia).values({
      candidateId: params.candidateId,
      objectKey: params.objectKey,
      mediaType: params.mediaType,
      contentType: params.contentType,
      scanStatus: 'pending',
    });
  }
}
