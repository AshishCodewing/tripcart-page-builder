// Compute `publishedAt` for a page/post save. On the DRAFT→PUBLISHED
// transition, stamp now; otherwise preserve the existing value (so re-saving a
// published record doesn't bump its publish date, and unpublishing keeps it).
export function computePublishTimestamp(
  wasPublished: boolean,
  willBePublished: boolean,
  existingPublishedAt: Date | null
): Date | null {
  return willBePublished && !wasPublished ? new Date() : existingPublishedAt
}
