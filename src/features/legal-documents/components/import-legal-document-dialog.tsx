"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";
import { LoadingButton } from "@/components/feedback/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImportLegalDocument } from "@/features/legal-documents/hooks/use-legal-documents";
import { LEGAL_DOC_TYPES, type LegalDocType } from "@/types/legal-document";

const ACCEPTED = ".docx,.pdf,.txt,.md";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per the contract (§2.1)

export function ImportLegalDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const importMutation = useImportLegalDocument();

  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [docType, setDocType] = React.useState<LegalDocType>("other");

  // Reset transient state whenever the dialog closes so a re-open starts clean.
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle("");
      setDocType("other");
    }
  }, [open]);

  function handleFile(selected: File | null) {
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error("File is larger than the 25 MB limit");
      return;
    }
    setFile(selected);
    // Prefill the title from the file name (without extension) if empty.
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleImport() {
    if (!file) {
      toast.error("Choose a .docx, .pdf, .txt, or .md file to import");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the document a title");
      return;
    }
    try {
      const result = await importMutation.mutateAsync({
        file,
        title: title.trim(),
        docType,
      });
      toast.success("Imported as a draft — review before publishing");
      // PDF conversion is approximate; always surface conversion warnings.
      for (const warning of result.warnings ?? []) {
        toast.warning(warning, { duration: 8000 });
      }
      onOpenChange(false);
      if (result.id) {
        router.push(`/admin/legal-documents/${result.id}/edit`);
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Could not import this file. Supported types: .docx, .pdf, .txt, .md",
      );
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Import a legal document"
      description="Upload a Word, PDF, or text file. We convert it to an editable draft and keep the original on file. PDF conversion is approximate — review headings and spacing before publishing."
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="import-title">Title</Label>
          <Input
            id="import-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Privacy Policy"
            className="text-base md:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="import-doc-type">Document type</Label>
          <Select
            value={docType}
            onValueChange={(v) => setDocType(v as LegalDocType)}
          >
            <SelectTrigger id="import-doc-type">
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_DOC_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex flex-col">
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="import-file">File</Label>
          <label
            htmlFor="import-file"
            className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/30 px-4 py-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <FileUp className="h-5 w-5" aria-hidden="true" />
            {file ? (
              <span className="font-medium text-foreground">{file.name}</span>
            ) : (
              <span>Click to choose a .docx, .pdf, .txt, or .md file</span>
            )}
            <span className="text-xs">Max 25 MB</span>
            <input
              id="import-file"
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            onClick={handleImport}
            isLoading={importMutation.isPending}
            loadingText="Converting…"
            className="min-h-[44px]"
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Import as draft
          </LoadingButton>
        </div>
      </div>
    </ResponsiveModal>
  );
}
