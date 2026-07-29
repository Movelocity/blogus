import type { BlogPost } from "@blogus/shared";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { postDateEvents } from "../db/schema.js";
import type { PostsDatabase } from "./posts.js";

export interface CalendarPostSummary {
  id: string;
  title: string;
  slug: string;
  publishedAt: string;
}

export interface CalendarMonthIndex {
  index: Record<string, CalendarPostSummary[]>;
}

function toCalendarPostSummary(row: {
  id: string;
  title: string;
  slug: string;
  publishedAt: Date;
}): CalendarPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    publishedAt: row.publishedAt.toISOString()
  };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEventDate(post: BlogPost): Date {
  const source = post.publishedAt ?? post.createdAt;
  return new Date(source);
}

export class PostDateEventsRepository {
  constructor(private readonly db: PostsDatabase) {}

  async syncPostDateEvent(post: BlogPost) {
    if (post.status !== "published") {
      await this.deletePostDateEventByPostId(post.id);
      return;
    }

    const eventDate = getEventDate(post);
    const existing = await this.db
      .select({ id: postDateEvents.id })
      .from(postDateEvents)
      .where(eq(postDateEvents.postId, post.id))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(postDateEvents)
        .set({
          eventDate,
          title: post.title,
          slug: post.slug,
          publishedAt: new Date(post.publishedAt ?? post.createdAt)
        })
        .where(eq(postDateEvents.postId, post.id));
    } else {
      await this.db.insert(postDateEvents).values({
        postId: post.id,
        eventDate,
        title: post.title,
        slug: post.slug,
        publishedAt: new Date(post.publishedAt ?? post.createdAt)
      });
    }
  }

  async deletePostDateEventByPostId(postId: string) {
    await this.db.delete(postDateEvents).where(eq(postDateEvents.postId, postId));
  }

  async listDateEventsByMonth(year: number, month: number): Promise<CalendarMonthIndex> {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    const rows = await this.db
      .select({
        id: postDateEvents.postId,
        title: postDateEvents.title,
        slug: postDateEvents.slug,
        publishedAt: postDateEvents.publishedAt,
        eventDate: postDateEvents.eventDate
      })
      .from(postDateEvents)
      .where(and(gte(postDateEvents.eventDate, start), lt(postDateEvents.eventDate, end)))
      .orderBy(asc(postDateEvents.eventDate), desc(postDateEvents.publishedAt));

    const index: Record<string, CalendarPostSummary[]> = {};

    for (const row of rows) {
      const key = formatDateKey(row.eventDate);
      const summary = toCalendarPostSummary(row);
      index[key] = [...(index[key] ?? []), summary];
    }

    return { index };
  }
}
