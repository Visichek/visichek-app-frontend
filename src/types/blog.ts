/**
 * Blog and media types — mirror the backend schema described in the blog
 * router documentation.
 *
 * Blocks follow the BlockNote shape: `{ id, type, props, content[], children[] }`.
 * The backend stores `currentPageBody` as an array of these blocks, or
 * `pages[]` for paginated articles (the editor currently uses
 * `currentPageBody`).
 */

export type BlogState = "draft" | "published";

export type BlogType =
  | "editors pick"
  | "featured story"
  | "hero section"
  | "normal";

export type MediaType = "image" | "video";

/**
 * Category catalog from the backend. Names and slugs are both enums on the
 * server side — keep these arrays in sync with `blog/schemas/imports.py`.
 */
export interface CategoryEntry {
  name: string;
  slug: string;
}

export const BLOG_CATEGORIES: CategoryEntry[] = [
  { name: "Physical Security", slug: "physical-security" },
  { name: "Access Control", slug: "access-control" },
  { name: "Data Privacy & Compliance", slug: "data-privacy-and-compliance" },
  { name: "Workplace Management", slug: "workplace-management" },
  { name: "Front Desk Operations", slug: "front-desk-operations" },
];

export const BLOG_TYPES: { value: BlogType; label: string; description: string }[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Standard article that appears in the main feed",
  },
  {
    value: "featured story",
    label: "Featured Story",
    description: "Highlighted on the homepage as a featured story tile",
  },
  {
    value: "editors pick",
    label: "Editor's Pick",
    description: "Curated by editors — surfaces in the editor's-picks row",
  },
  {
    value: "hero section",
    label: "Hero",
    description: "Takes the hero slot at the top of the public blog page",
  },
];

export interface Author {
  name: string;
  avatarUrl?: string | null;
}

export interface MediaAsset {
  url: string;
  altText: string;
}

/** A styled run of text inside a block's `content` array. */
export interface InlineText {
  type: "text";
  text: string;
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
    textColor?: string;
    backgroundColor?: string;
  };
}

/** Discriminator for the block types this editor understands. */
export type BlockType =
  | "paragraph"
  | "heading"
  | "bulletListItem"
  | "numberedListItem"
  | "quote"
  | "codeBlock"
  | "divider"
  | "image"
  | "video";

export interface BlockProps {
  level?: 1 | 2 | 3;
  textAlignment?: "left" | "center" | "right";
  /** Media block props. */
  url?: string;
  caption?: string;
  alt?: string;
  language?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  props?: BlockProps;
  content?: InlineText[];
  children?: Block[];
}

export interface Page {
  pageNumber: number;
  pageBody: Block[];
}

export interface Blog {
  id: string;
  title: string;
  author: Author;
  category: CategoryEntry;
  blogType: BlogType;
  state: BlogState;
  slug?: string;
  excerpt?: string;
  featureImage?: MediaAsset | null;
  publishDate?: number | null;
  dateCreated?: number;
  lastUpdated?: number;
  pages?: Page[] | null;
  currentPageBody?: Block[] | null;
}

export interface BlogListItem {
  id: string;
  title: string;
  author: Author;
  category: CategoryEntry;
  blogType: BlogType;
  state: BlogState;
  slug?: string;
  excerpt?: string;
  featureImage?: MediaAsset | null;
  publishDate?: number | null;
  dateCreated?: number;
  lastUpdated?: number;
}

export interface CreateBlogPayload {
  title: string;
  author: Author;
  category: CategoryEntry;
  blogType?: BlogType;
  featureImage?: MediaAsset | null;
  currentPageBody?: Block[] | null;
  pages?: Page[] | null;
}

export interface UpdateBlogPayload {
  state?: BlogState;
  title?: string;
  author?: Author;
  publishDate?: number;
  category?: CategoryEntry;
  featureImage?: MediaAsset | null;
  excerpt?: string;
  pages?: Page[];
  currentPageBody?: Block[];
  blogType?: BlogType;
  slug?: string;
}

export interface MediaItem {
  id: string;
  mediaType: MediaType;
  category: string;
  url: string;
  name: string;
  dateCreated?: number;
  lastUpdated?: number;
}

export interface MediaUploadResult {
  id?: string;
  url: string;
  mediaType?: MediaType;
  category?: string;
}
