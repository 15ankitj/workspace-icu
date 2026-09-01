/**
 * Hand-maintained database types for the tables Phase 1 touches. Once the
 * hosted Supabase projects exist and the Supabase MCP server is connected,
 * regenerate this file from the live schema (`generate_typescript_types`)
 * and keep the same export names.
 */

export type WorkspaceRole = "owner" | "editor" | "commenter" | "viewer";
export type OrganisationRole = "admin" | "member";
export type OrganisationType = "nhs_trust" | "deanery" | "other";

export type UserRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  gmc_number: string | null;
  accepted_terms_at: string | null;
  accepted_aup_version: string | null;
  created_at: string;
};

export type OrganisationRow = {
  id: string;
  name: string;
  slug: string;
  type: OrganisationType;
  created_at: string;
};

export type WorkspaceRow = {
  id: string;
  name: string;
  icon: string | null;
  organisation_id: string | null;
  is_personal: boolean;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
};

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  joined_at: string;
};

export type PageRow = {
  id: string;
  workspace_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  cover_url: string | null;
  position: string;
  is_private: boolean;
  full_width: boolean;
  small_text: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  template_id: string | null;
  template_version: number | null;
};

export type FavouriteRow = {
  user_id: string;
  page_id: string;
  position: string;
};

export type RecentPageRow = {
  user_id: string;
  page_id: string;
  viewed_at: string;
};

export type AuditEventRow = {
  id: string;
  actor_id: string | null;
  workspace_id: string | null;
  event_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow> & Pick<UserRow, "id" | "email">;
        Update: Partial<UserRow>;
        Relationships: [];
      };
      organisations: {
        Row: OrganisationRow;
        Insert: Partial<OrganisationRow> &
          Pick<OrganisationRow, "name" | "slug">;
        Update: Partial<OrganisationRow>;
        Relationships: [];
      };
      workspaces: {
        Row: WorkspaceRow;
        Insert: Partial<WorkspaceRow> &
          Pick<WorkspaceRow, "name" | "created_by">;
        Update: Partial<WorkspaceRow>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMemberRow;
        Insert: Partial<WorkspaceMemberRow> &
          Pick<WorkspaceMemberRow, "workspace_id" | "user_id" | "role">;
        Update: Partial<WorkspaceMemberRow>;
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: PageRow;
        Insert: Partial<PageRow> &
          Pick<PageRow, "workspace_id" | "title" | "position" | "created_by">;
        Update: Partial<PageRow>;
        Relationships: [];
      };
      favourites: {
        Row: FavouriteRow;
        Insert: FavouriteRow;
        Update: Partial<FavouriteRow>;
        Relationships: [];
      };
      recent_pages: {
        Row: RecentPageRow;
        Insert: Partial<RecentPageRow> &
          Pick<RecentPageRow, "user_id" | "page_id">;
        Update: Partial<RecentPageRow>;
        Relationships: [];
      };
      audit_events: {
        Row: AuditEventRow;
        Insert: Partial<AuditEventRow> &
          Pick<AuditEventRow, "event_type" | "target_type">;
        // Append-only in the database (no UPDATE grant or policy); the type
        // stays permissive because supabase-js rejects `never` members.
        Update: Partial<AuditEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      workspace_role: WorkspaceRole;
      organisation_role: OrganisationRole;
      organisation_type: OrganisationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
