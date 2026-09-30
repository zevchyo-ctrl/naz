import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    await ensureSeeded();
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));

    return NextResponse.json({ categories: allCategories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
