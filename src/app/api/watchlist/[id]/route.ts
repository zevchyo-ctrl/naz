import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watchlist } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSeeded();
    const { id } = await params;
    const itemId = Number(id);

    await db.delete(watchlist).where(eq(watchlist.id, itemId));
    return NextResponse.json({ deleted: true, id: itemId });
  } catch (error) {
    console.error("Error deleting watchlist item:", error);
    return NextResponse.json(
      { error: "Failed to delete watchlist item" },
      { status: 500 }
    );
  }
}
