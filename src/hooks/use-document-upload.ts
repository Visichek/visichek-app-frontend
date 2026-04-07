"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadDocument, type UploadResult } from "@/lib/upload/document-upload";
import { ApiError } from "@/types/api";

interface UseDocumentUploadState {
  isUploading: boolean;
  error: string | null;
}

interface UseDocumentUploadReturn {
  upload: (file: File) => Promise<UploadResult | null>;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Hook to handle document upload with progress tracking and error handling.
 * Provides toast feedback for success and error states.
 *
 * @returns Upload function, loading state, error state, and reset function
 */
export function useDocumentUpload(): UseDocumentUploadReturn {
  const [state, setState] = useState<UseDocumentUploadState>({
    isUploading: false,
    error: null,
  });

  const upload = async (file: File): Promise<UploadResult | null> => {
    try {
      setState({ isUploading: true, error: null });

      const result = await uploadDocument(file);

      toast.success(`File "${file.name}" uploaded successfully`);
      setState({ isUploading: false, error: null });

      return result;
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to upload file. Please try again.";

      setState({
        isUploading: false,
        error: errorMessage,
      });

      toast.error(errorMessage);
      return null;
    }
  };

  const reset = () => {
    setState({ isUploading: false, error: null });
  };

  return {
    upload,
    isUploading: state.isUploading,
    error: state.error,
    reset,
  };
}
