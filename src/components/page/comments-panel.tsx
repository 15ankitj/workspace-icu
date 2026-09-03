"use client";

import { useId, useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import {
  addComment,
  deleteComment,
  setCommentResolved,
} from "@/app/actions/comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/ui/page-shell";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
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
  const textareaId = useId();

  const visible = comments.filter((c) => showResolved || !c.resolved);
  const resolvedCount = comments.filter((c) => c.resolved).length;

  function run(label: string, action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        toast({
          variant: "destructive",
          title: `Couldn't ${label}`,
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    });
  }

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading>
          <MessageSquare className="size-4" aria-hidden /> Comments
        </SectionHeading>
        {resolvedCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Hide" : "Show"} {resolvedCount} resolved
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState compact>
          {comments.length === 0
            ? "No comments yet."
            : "Every comment here is resolved."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((comment) => (
            <li
              key={comment.id}
              className={cn(
                "rounded-md border p-3 text-sm",
                comment.resolved && "border-dashed",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{comment.authorName}</span>
                  {comment.resolved && (
                    <Badge variant="outline">Resolved</Badge>
                  )}
                </span>
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
              <div className="mt-2 flex gap-1">
                {canComment && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    disabled={isPending}
                    onClick={() =>
                      run(comment.resolved ? "reopen" : "resolve", () =>
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
                  </Button>
                )}
                {(comment.authorId === currentUserId || isOwner) && (
                  <ConfirmButton
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                    title="Delete this comment?"
                    description="It is removed for everyone and cannot be recovered."
                    confirmLabel="Delete comment"
                    onConfirm={() =>
                      run("delete the comment", () =>
                        deleteComment(workspaceId, pageId, comment.id),
                      )
                    }
                  >
                    Delete
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            if (!value) return;
            // The draft is cleared only once the comment is saved.
            startTransition(async () => {
              try {
                await addComment(workspaceId, pageId, value);
                setText("");
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: "Couldn't post your comment",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Your text is still in the box. Try again.",
                });
              }
            });
          }}
        >
          <Label htmlFor={textareaId} className="sr-only">
            Add a comment
          </Label>
          <Textarea
            id={textareaId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            required
            placeholder="Add a comment for your collaborators…"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !text.trim()}
            >
              {isPending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
