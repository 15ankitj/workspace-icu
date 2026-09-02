/**
 * Hand-maintained database types for the tables Phase 1 touches. Once the
 * hosted Supabase projects exist and the Supabase MCP server is connected,
 * regenerate this file from the live schema (`generate_typescript_types`)
 * and keep the same export names.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
  search_text: string | null;
  template_page_key: string | null;
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

export type PhiScanStatus = "not_scanned" | "clear" | "flagged" | "overridden";

export type FileRow = {
  id: string;
  workspace_id: string;
  page_id: string;
  uploader_id: string;
  storage_path: string;
  filename: string;
  mime: string;
  size_bytes: number;
  phi_scan_status: PhiScanStatus;
  phi_scan_findings: unknown[];
  aup_acknowledged: boolean;
  created_at: string;
  deleted_at: string | null;
};

export type ContentReportRow = {
  id: string;
  reporter_id: string;
  page_id: string | null;
  file_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

export type WorkspaceInviteRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

export type PageShareRow = {
  page_id: string;
  public_token: string;
  public_enabled: boolean;
  created_by: string;
  created_at: string;
};

export type CommentRow = {
  id: string;
  page_id: string;
  block_id: string | null;
  author_id: string;
  body: { text: string };
  resolved: boolean;
  created_at: string;
};

export type PageLinkRow = {
  source_page_id: string;
  target_page_id: string;
};

export type TemplateScope = "platform" | "workspace";
export type TemplateKind = "page" | "tree" | "workspace";

export type TemplateRow = {
  id: string;
  owner_scope: TemplateScope;
  workspace_id: string | null;
  source_page_id: string | null;
  name: string;
  description: string;
  purpose: string;
  category: string;
  audience: string;
  kind: TemplateKind;
  current_version_id: string | null;
  is_published: boolean;
  created_by: string;
  created_at: string;
};

export type TemplateVersionRow = {
  id: string;
  template_id: string;
  version: number;
  snapshot: Json;
  changelog: string;
  created_by: string | null;
  created_at: string;
};

export type GalleryEntryRow = {
  template_id: string;
  category: string;
  sort_order: number;
  hero_image_url: string | null;
  organisation_id: string | null;
  published_at: string;
};

export type PlatformOwnerRow = {
  user_id: string;
  created_at: string;
};

export type DbBlockRow = {
  id: string;
  page_id: string;
  parent_block_id: string | null;
  type: string;
  position: string;
  content: { props?: Record<string, unknown>; content?: unknown };
  created_by: string;
  created_at: string;
  updated_at: string;
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
      blocks: {
        Row: DbBlockRow;
        Insert: Partial<DbBlockRow> &
          Pick<DbBlockRow, "id" | "page_id" | "type" | "position">;
        Update: Partial<DbBlockRow>;
        Relationships: [];
      };
      files: {
        Row: FileRow;
        Insert: Partial<FileRow> &
          Pick<
            FileRow,
            | "workspace_id"
            | "page_id"
            | "uploader_id"
            | "storage_path"
            | "filename"
            | "mime"
            | "size_bytes"
          >;
        Update: Partial<FileRow>;
        Relationships: [];
      };
      content_reports: {
        Row: ContentReportRow;
        Insert: Partial<ContentReportRow> &
          Pick<ContentReportRow, "reporter_id" | "reason">;
        Update: Partial<ContentReportRow>;
        Relationships: [];
      };
      workspace_invites: {
        Row: WorkspaceInviteRow;
        Insert: Partial<WorkspaceInviteRow> &
          Pick<WorkspaceInviteRow, "workspace_id" | "email" | "invited_by">;
        Update: Partial<WorkspaceInviteRow>;
        Relationships: [];
      };
      page_shares: {
        Row: PageShareRow;
        Insert: Partial<PageShareRow> &
          Pick<PageShareRow, "page_id" | "created_by">;
        Update: Partial<PageShareRow>;
        Relationships: [];
      };
      comments: {
        Row: CommentRow;
        Insert: Partial<CommentRow> &
          Pick<CommentRow, "page_id" | "author_id" | "body">;
        Update: Partial<CommentRow>;
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      templates: {
        Row: TemplateRow;
        Insert: Partial<TemplateRow> &
          Pick<TemplateRow, "owner_scope" | "name" | "kind" | "created_by">;
        Update: Partial<TemplateRow>;
        Relationships: [
          {
            foreignKeyName: "templates_current_version_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "template_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      template_versions: {
        Row: TemplateVersionRow;
        Insert: Partial<TemplateVersionRow> &
          Pick<TemplateVersionRow, "template_id" | "version" | "snapshot">;
        Update: Partial<TemplateVersionRow>;
        Relationships: [];
      };
      gallery_entries: {
        Row: GalleryEntryRow;
        Insert: Partial<GalleryEntryRow> &
          Pick<GalleryEntryRow, "template_id" | "category">;
        Update: Partial<GalleryEntryRow>;
        Relationships: [];
      };
      platform_owners: {
        Row: PlatformOwnerRow;
        Insert: Pick<PlatformOwnerRow, "user_id">;
        Update: Partial<PlatformOwnerRow>;
        Relationships: [];
      };
      page_links: {
        Row: PageLinkRow;
        Insert: PageLinkRow;
        Update: Partial<PageLinkRow>;
        Relationships: [
          {
            foreignKeyName: "page_links_source_page_id_fkey";
            columns: ["source_page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      replace_page_blocks: {
        Args: { p_page_id: string; p_blocks: Json };
        Returns: undefined;
      };
      save_page_document: {
        Args: { p_page_id: string; p_ydoc_base64: string; p_blocks: Json };
        Returns: undefined;
      };
      load_page_document: {
        Args: { p_page_id: string };
        Returns: string | null;
      };
      can_edit_page: {
        Args: { p_page_id: string };
        Returns: boolean;
      };
      accept_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      get_public_page: {
        Args: { p_token: string };
        Returns: Json;
      };
      set_page_links: {
        Args: { p_source_page_id: string; p_target_page_ids: string[] };
        Returns: undefined;
      };
      is_platform_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      insert_template_pages: {
        Args: { p_pages: Json };
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: { p_action: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      search_pages: {
        Args: { p_query: string };
        Returns: {
          id: string;
          workspace_id: string;
          title: string;
          icon: string | null;
          snippet: string;
          rank: number;
        }[];
      };
    };
    Enums: {
      template_scope: TemplateScope;
      template_kind: TemplateKind;
      phi_scan_status: PhiScanStatus;
      workspace_role: WorkspaceRole;
      organisation_role: OrganisationRole;
      organisation_type: OrganisationType;
    };
    CompositeTypes: Record<string, never>;
  };
};
