"use client";

import { useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import {
  addComment,
  deleteComment,
  setCommentResolved,
} from "@/app/actions/comments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  resolved: boolean;
  createdAt: string;
}

/** Page-level discussion thread (brief §5). */
export function CommentsPanel({
  workspaceId,
  pageId,
  comments,
  currentUserId,
  canComment,
  isOwner,
}: {
  workspaceId: string;
  pageId: string;
  comments: PageComment[];
  currentUserId: string;
  canComment: boolean;
  isOwner: boolean;
}) {
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visible = comments.filter((c) => showResolved || !c.resolved);
  const resolvedCount = comments.filter((c) => c.resolved).length;

  return (
    <section className="mt-10 space-y-3 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquare className="size-4" /> Comments
        </h2>
        {resolvedCount > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {visible.map((comment) => (
          <li
            key={comment.id}
            className={cn(
              "rounded-md border p-3 text-sm",
              comment.resolved && "opacity-60",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{comment.authorName}</span>
              <time
                className="text-xs text-muted-foreground"
                dateTime={comment.createdAt}
              >
                {new Date(comment.createdAt).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{comment.text}</p>
            <div className="mt-2 flex gap-3 text-xs">
              {canComment && (
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      setCommentResolved(
                        workspaceId,
                        pageId,
                        comment.id,
                        !comment.resolved,
                      ),
                    )
                  }
                >
                  {comment.resolved ? "Reopen" : "Resolve"}
                </button>
              )}
              {(comment.authorId === currentUserId || isOwner) && (
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      deleteComment(workspaceId, pageId, comment.id),
                    )
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="text-xs text-muted-foreground">No comments yet.</li>
        )}
      </ul>

      {canComment && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text;
            setText("");
            startTransition(() => addComment(workspaceId, pageId, value));
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            required
            placeholder="Add a comment for your collaborators…"
            className="w-full rounded-md border border-input bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              Comment
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
