import { apiPost } from "@/lib/api/request";
import type {
  AttachmentIntentRequest,
  AttachmentIntentResponse,
  SupportCaseAttachment,
} from "@/types/support-case";

/**
 * Runs the 3-step support-case attachment flow for a single file and returns
 * the attachment descriptor you can drop into a message payload.
 *
 *   1. POST /v1/support-cases/{id}/attachments/intent   → presigned URL
 *   2. PUT  <uploadUrl>                                 → raw S3 upload
 *   3. (caller) POST /v1/support-cases/{id}/messages or /attachments
 *      with the returned `SupportCaseAttachment` in the `attachments` array
 *
 * Step 3 is left to the caller so they can batch multiple files into a
 * single message registration.
 */
export async function uploadSupportCaseAttachment(
  caseId: string,
  file: File,
): Promise<SupportCaseAttachment> {
  const intentPayload: AttachmentIntentRequest = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };

  const intent = await apiPost<AttachmentIntentResponse>(
    `/support-cases/${caseId}/attachments/intent`,
    intentPayload,
  );

  const uploadOptions: RequestInit = {
    method: intent.method || "PUT",
    body: file,
  };
  if (intent.headers) {
    uploadOptions.headers = intent.headers;
  }

  const uploadResponse = await fetch(intent.uploadUrl, uploadOptions);

  if (!uploadResponse.ok) {
    throw new Error(
      `File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
    );
  }

  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    objectKey: intent.objectKey,
  };
}
