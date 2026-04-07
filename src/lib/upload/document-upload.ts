import { apiPost } from "@/lib/api/request";
import type {
  UploadIntentRequest,
  UploadIntentResponse,
  CompleteUploadRequest,
} from "@/types/api";

export interface UploadResult {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/**
 * Upload a document using the two-step flow:
 * 1. Create upload intent to get a presigned URL
 * 2. Upload file bytes to the presigned URL
 * 3. Complete the upload to finalize it
 *
 * @param file The file to upload
 * @returns Upload result with object key and metadata
 * @throws ApiError if any step fails
 */
export async function uploadDocument(file: File): Promise<UploadResult> {
  // Step 1: Create upload intent
  const intentPayload: UploadIntentRequest = {
    file_name: file.name,
    mime_type: file.type,
    size: file.size,
  };

  const intentResponse = await apiPost<UploadIntentResponse>(
    "/v1/documents/upload-intents",
    intentPayload
  );

  const { object_key, upload_url, method, headers } = intentResponse;

  // Step 2: Upload file bytes to the presigned URL
  const uploadOptions: RequestInit = {
    method: method || "PUT",
    body: file,
  };

  if (headers) {
    uploadOptions.headers = headers;
  }

  const uploadResponse = await fetch(upload_url, uploadOptions);

  if (!uploadResponse.ok) {
    throw new Error(
      `File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
    );
  }

  // Step 3: Complete the upload to finalize it
  const completePayload: CompleteUploadRequest = {
    object_key,
    file_name: file.name,
    mime_type: file.type,
    size: file.size,
  };

  await apiPost("/v1/documents/complete", completePayload);

  return {
    objectKey: object_key,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}
