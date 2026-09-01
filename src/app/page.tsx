import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Lands the signed-in user in their personal (or first) workspace. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, is_personal")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const target =
    workspaces?.find((w) => w.is_personal) ?? workspaces?.at(0) ?? null;

  if (!target) {
    // The sign-up trigger creates the personal workspace, so this state
    // means the trigger failed — surface it rather than looping.
    throw new Error(
      "No workspace found for this account. Please contact support.",
    );
  }

  redirect(`/w/${target.id}`);
}
