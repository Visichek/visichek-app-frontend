"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { useDocumentUpload } from "@/hooks/use-document-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface FileUploadZoneProps {
  /**
   * Accepted file types (e.g., "image/*", ".pdf", "image/png,application/pdf")
   */
  accept?: string;
  /**
   * Maximum file size in bytes
   */
  maxSize?: number;
  /**
   * Called when upload completes successfully
   */
  onUploadComplete?: (objectKey: string) => void;
  /**
   * Placeholder text shown in the drop zone
   */
  placeholder?: string;
  /**
   * Help text shown below the drop zone
   */
  helpText?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

export function FileUploadZone({
  accept,
  maxSize,
  onUploadComplete,
  placeholder = "Drop your file here or click to browse",
  helpText,
  disabled = false,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { upload, isUploading, error } = useDocumentUpload();

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file size
    if (maxSize && file.size > maxSize) {
      const sizeMB = (maxSize / 1024 / 1024).toFixed(1);
      const error = `File is too large. Maximum size is ${sizeMB}MB.`;
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);

    // Simulate progress (real progress tracking would depend on backend support)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 30;
      });
    }, 200);

    const result = await upload(file);

    clearInterval(progressInterval);

    if (result) {
      setUploadProgress(100);
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
      }, 1500);

      if (onUploadComplete) {
        onUploadComplete(result.objectKey);
      }
    } else {
      setUploadProgress(0);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
        className="hidden"
        aria-hidden="true"
      />

      {selectedFile ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {!isUploading && (
              <button
                onClick={handleClear}
                className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove file"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Uploading...</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            relative flex cursor-pointer flex-col items-center justify-center
            rounded-lg border-2 border-dashed px-6 py-12 text-center
            transition-colors
            ${isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 bg-muted/20"
            }
            ${disabled || isUploading
              ? "cursor-not-allowed opacity-50"
              : "hover:border-primary/50 hover:bg-primary/5"
            }
          `}
          role="button"
          tabIndex={disabled || isUploading ? -1 : 0}
          onKeyDown={(e) => {
            if (!disabled && !isUploading && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={placeholder}
        >
          <div className="pointer-events-none space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{placeholder}</p>
              {helpText && (
                <p className="text-xs text-muted-foreground">{helpText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
