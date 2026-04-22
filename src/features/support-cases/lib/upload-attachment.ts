import { apiPost } from "@/lib/api/request";
import type {
  AttachmentIntentRequest,
  AttachmentIntentResponse,
  SupportCaseAttachment,
} from "@/types/support-case";

/**
 * Runs steps 1 and 2 of the support-case attachment flow for a single file
 * and returns the descriptor to include in the reply hook's `attachments`
 * array. Step 3 (registering the descriptor on the thread) is handled by
 * `useReplySupportCase` / `useAdminReplySupportCase`, which auto-route to
 * `/support-cases/{id}/attachments` when attachments are present.
 *
 *   1. POST /v1/support-cases/{id}/attachments/intent   → presigned URL
 *   2. PUT  <uploadUrl>                                 → raw bytes to storage
 *
 * The PUT in step 2 is a direct-to-storage call using the presigned URL's
 * own credentials, so it must NOT carry our `Authorization` Bearer header
 * and must send exactly the headers returned by the intent (anything else
 * triggers a signature mismatch).
 */
export async function uploadSupportCaseAttachment(
  caseId: string,
  file: File,
): Promise<SupportCaseAttachment> {
  const mimeType = file.type || "application/octet-stream";

  const intentPayload: AttachmentIntentRequest = {
    fileName: file.name,
    mimeType,
    size: file.size,
  };

  const intent = await apiPost<AttachmentIntentResponse>(
    `/support-cases/${caseId}/attachments/intent`,
    intentPayload,
  );

  const uploadResponse = await fetch(intent.uploadUrl, {
    method: intent.method || "PUT",
    headers: intent.headers,
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
    );
  }

  return {
    documentId: crypto.randomUUID(),
    fileName: file.name,
    mimeType,
    size: file.size,
    objectKey: intent.objectKey,
  };
}
