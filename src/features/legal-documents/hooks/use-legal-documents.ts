"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/request";
import { apiGetList } from "@/lib/api/list";
import type { ListResponse } from "@/types/list";
import type {
  CreateLegalDocumentPayload,
  ImportLegalDocumentResponse,
  LegalDocument,
  LegalDocumentListRow,
  LegalDocumentSource,
  LegalDocumentVersion,
  LegalDocumentWriteResult,
  PublishLegalDocumentPayload,
  PublishLegalDocumentResult,
  UpdateLegalDocumentPayload,
} from "@/types/legal-document";

const BASE = "/legal-documents";

export interface UseLegalDocumentsParams {
  skip?: number;
  limit?: number;
  sort?: string;
  q?: string;
  status?: string;
  docType?: string;
  facets?: string;
}

/**
 * Paginated admin list. The unfiltered first page is served from the backend
 * precompute cache (fast path).
 */
export function useLegalDocuments(params?: UseLegalDocumentsParams) {
  return useQuery<ListResponse<LegalDocumentListRow>>({
    queryKey: ["legal-documents", params],
    queryFn: () =>
      apiGetList<LegalDocumentListRow>(
        BASE,
        params as Record<string, unknown> | undefined,
      ),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Full head document — includes the editable `body` and live `publishedBody`. */
export function useLegalDocument(documentId: string | undefined) {
  return useQuery<LegalDocument>({
    queryKey: ["legal-documents", documentId],
    queryFn: () => apiGet<LegalDocument>(`${BASE}/${documentId}`),
    enabled: !!documentId,
    staleTime: 30 * 1000,
  });
}

export interface UseVersionsParams {
  skip?: number;
  limit?: number;
}

/** Version history (newest first). */
export function useLegalDocumentVersions(
  documentId: string | undefined,
  params?: UseVersionsParams,
) {
  return useQuery<ListResponse<LegalDocumentVersion>>({
    queryKey: ["legal-documents", documentId, "versions", params],
    queryFn: () =>
      apiGetList<LegalDocumentVersion>(
        `${BASE}/${documentId}/versions`,
        params as Record<string, unknown> | undefined,
      ),
    enabled: !!documentId,
    staleTime: 30 * 1000,
  });
}

/** A single immutable snapshot. */
export function useLegalDocumentVersion(
  documentId: string | undefined,
  version: number | undefined,
) {
  return useQuery<LegalDocumentVersion>({
    queryKey: ["legal-documents", documentId, "versions", version],
    queryFn: () =>
      apiGet<LegalDocumentVersion>(`${BASE}/${documentId}/versions/${version}`),
    enabled: !!documentId && typeof version === "number",
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a fresh presigned download URL for the original imported file. The URL
 * is short-lived, so call this on demand (e.g. on click) rather than caching.
 */
export async function fetchLegalDocumentSource(
  documentId: string,
): Promise<LegalDocumentSource> {
  return apiGet<LegalDocumentSource>(`${BASE}/${documentId}/source`);
}

/**
 * Create a document (always a draft). `request.ts` auto-polls the 202 ack, so
 * this resolves once the worker has committed. The job result carries the
 * pre-generated id, safe to navigate to.
 */
export function useCreateLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation<
    LegalDocumentWriteResult,
    Error,
    CreateLegalDocumentPayload
  >({
    mutationFn: (data) => apiPost<LegalDocumentWriteResult>(BASE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });
}

/** Update the working copy + head metadata. */
export function useUpdateLegalDocument(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateLegalDocumentPayload>({
    mutationFn: (data) => apiPatch(`${BASE}/${documentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["legal-documents", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });
}

/** Publish the working copy as the next immutable version. */
export function usePublishLegalDocument(documentId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    PublishLegalDocumentResult,
    Error,
    PublishLegalDocumentPayload | void
  >({
    mutationFn: (data) =>
      apiPost<PublishLegalDocumentResult>(
        `${BASE}/${documentId}/publish`,
        data ?? {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["legal-documents", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });
}

/** Archive — removes the document from the public site; history is retained. */
export function useArchiveLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (documentId) => apiPost(`${BASE}/${documentId}/archive`, {}),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({
        queryKey: ["legal-documents", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });
}

/** Permanently delete the head document AND its version history. */
export function useDeleteLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (documentId) => apiDelete(`${BASE}/${documentId}`),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({
        queryKey: ["legal-documents", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });
}

interface ImportLegalDocumentInput {
  file: File;
  title: string;
  docType?: string;
}

/**
 * Import a Word/PDF/text file into a new draft. Unlike other mutations, the
 * import endpoint does heavy I/O inline and returns the converted content +
 * warnings in the 202 body (already committed), so we read `response.data`
 * directly instead of polling the job (which would discard the inline payload).
 */
export function useImportLegalDocument() {
  const queryClient = useQueryClient();
  return useMutation<ImportLegalDocumentResponse, Error, ImportLegalDocumentInput>(
    {
      mutationFn: async ({ file, title, docType }) => {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title);
        if (docType) form.append("docType", docType);
        const response = await apiClient.post(`${BASE}/import`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data as ImportLegalDocumentResponse;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      },
    },
  );
}
