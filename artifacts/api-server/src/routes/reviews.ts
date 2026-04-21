import { Router, type IRouter } from "express";
import { eq, and, avg } from "drizzle-orm";
import { db, reviewsTable, bookingsTable, courtsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/courts/:id/reviews", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) {
    res.status(400).json({ error: "Invalid court id" });
    return;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.courtId, courtId))
    .orderBy(reviewsTable.createdAt);

  res.json(reviews.map(r => ({
    ...r,
    reviewText: r.reviewText ?? undefined,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/courts/:id/reviews", async (req, res): Promise<void> => {
  const courtId = parseInt(req.params.id, 10);
  if (isNaN(courtId)) {
    res.status(400).json({ error: "Invalid court id" });
    return;
  }

  const { bookingId, rating, reviewText, reviewerName, photos } = req.body;

  if (!bookingId || !rating || !reviewerName) {
    res.status(400).json({ error: "bookingId, rating, and reviewerName are required" });
    return;
  }

  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be a number between 1 and 5" });
    return;
  }

  // Verify booking exists and belongs to this court
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.courtId, courtId)));

  if (!booking) {
    res.status(404).json({ error: "Booking not found or does not belong to this court" });
    return;
  }

  if (booking.status !== "confirmed") {
    res.status(400).json({ error: "Only confirmed bookings can be reviewed" });
    return;
  }

  // Check if this booking already has a review
  const [existing] = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.bookingId, bookingId));

  if (existing) {
    res.status(400).json({ error: "This booking has already been reviewed" });
    return;
  }

  // Validate and serialize photos
  const photoUrls: string[] = Array.isArray(photos) ? photos.slice(0, 3) : [];

  // Insert review
  const [review] = await db
    .insert(reviewsTable)
    .values({
      courtId,
      bookingId,
      rating,
      reviewText: reviewText || null,
      reviewerName,
      photos: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
    })
    .returning();

  // Update court's average rating
  const result = await db
    .select({ avg: avg(reviewsTable.rating) })
    .from(reviewsTable)
    .where(eq(reviewsTable.courtId, courtId));

  const avgRating = result[0]?.avg ? parseFloat(result[0].avg) : null;

  if (avgRating !== null) {
    await db
      .update(courtsTable)
      .set({ rating: avgRating })
      .where(eq(courtsTable.id, courtId));
  }

  res.status(201).json({
    ...review,
    reviewText: review.reviewText ?? undefined,
    createdAt: review.createdAt.toISOString(),
  });
});

export default router;
