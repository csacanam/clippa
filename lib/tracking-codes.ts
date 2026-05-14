/**
 * Tracking codes types.
 * Data access lives in lib/actions/tracking-codes.ts.
 *
 * Codes are `CLIPPA-XXXX` (4 chars from an unambiguous alphabet of 30 chars
 * — no 0/O/1/I/L confusion). 30^4 ≈ 810k codes per campaign.
 *
 * One code per (creator, campaign). Generated on first visit. Used to
 * verify authorship: the post's caption must contain this code.
 */

export const CODE_PREFIX = "CLIPPA-";
