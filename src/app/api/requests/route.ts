import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { movieRequests, premiumRequests, users } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { desc, eq, sql } from "drizzle-orm";
import {getAuthenticatedUserId, guardAdmin} from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const allMovieRequests = await db
      .select()
      .from(movieRequests)
      .orderBy(desc(movieRequests.requestCount), desc(movieRequests.createdAt));

    const allPremiumRequests = await db
      .select()
      .from(premiumRequests)
      .orderBy(desc(premiumRequests.createdAt));

    return NextResponse.json({
      movieRequests: allMovieRequests,
      premiumRequests: allPremiumRequests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();
    const body = await request.json();
    body.userId = getAuthenticatedUserId(request); // never trust client-sent ids
    const requestKind = body.kind || "movie_request"; // 'movie_request' | 'premium_upgrade'

    if (requestKind === "premium_upgrade") {
      const [createdPremium] = await db
        .insert(premiumRequests)
        .values({
          userId: body.userId ? Number(body.userId) : null,
          name: body.name || "مشترك ناز",
          email: (body.email || "").toLowerCase().trim(),
          username: body.username || "naz_member",
          currentPlan: body.currentPlan || "Free",
          requestedPlan: body.requestedPlan || "Premium Ad-Free",
          message: body.message || "يرجى ترقية حسابي إلى الباقة الخالية من الإعلانات.",
          status: "Pending",
        })
        .returning();

      return NextResponse.json(
        { premiumRequest: createdPremium },
        { status: 201 }
      );
    }

    // Movie / Series Request with duplicate grouping
    const title = (body.title || "").trim();
    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const normalizedTitle = title.toLowerCase();
    const existing = await db
      .select()
      .from(movieRequests)
      .where(eq(movieRequests.normalizedTitle, normalizedTitle));

    if (existing.length > 0) {
      const [updated] = await db
        .update(movieRequests)
        .set({
          requestCount: sql`${movieRequests.requestCount} + 1`,
          updatedAt: new Date(),
          message: body.message || existing[0].message,
        })
        .where(eq(movieRequests.id, existing[0].id))
        .returning();

      return NextResponse.json({
        movieRequest: updated,
        grouped: true,
      });
    }

    const [created] = await db
      .insert(movieRequests)
      .values({
        title,
        normalizedTitle,
        year: Number(body.year) || 2026,
        mediaType: body.mediaType || "movie",
        referenceUrl: body.referenceUrl || "",
        message: body.message || "",
        requesterName: body.requesterName || "زائر",
        requesterEmail: body.requesterEmail || "",
        userId: body.userId ? Number(body.userId) : null,
        requestCount: 1,
        status: "Pending",
      })
      .returning();

    return NextResponse.json({ movieRequest: created }, { status: 201 });
  } catch (error) {
    console.error("Error submitting request:", error);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const gate = guardAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    await ensureSeeded();
    const body = await request.json();
    const kind = body.kind || "movie_request";
    const id = Number(body.id);
    const status = body.status;

    if (kind === "premium_upgrade") {
      const [updated] = await db
        .update(premiumRequests)
        .set({ status })
        .where(eq(premiumRequests.id, id))
        .returning();

      if (updated) {
        const isApproved = status === "Approved";
        if (updated.userId) {
          await db
            .update(users)
            .set({
              isPremium: isApproved,
              plan: isApproved ? "premium" : "free",
            })
            .where(eq(users.id, updated.userId));
        } else if (updated.email) {
          await db
            .update(users)
            .set({
              isPremium: isApproved,
              plan: isApproved ? "premium" : "free",
            })
            .where(eq(users.email, updated.email.toLowerCase().trim()));
        }
      }

      return NextResponse.json({ premiumRequest: updated });
    }

    const [updatedMovieReq] = await db
      .update(movieRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(movieRequests.id, id))
      .returning();

    return NextResponse.json({ movieRequest: updatedMovieReq });
  } catch (error) {
    console.error("Error updating request status:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
