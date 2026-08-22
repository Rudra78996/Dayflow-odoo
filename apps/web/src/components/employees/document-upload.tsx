"use client";

import { useState } from "react";
import { FileUpIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

type UploadIntent = {
  fileId: string;
  uploadUrl: string | null;
  storageConfigured: boolean;
  requiredHeaders: Record<string, string>;
};

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function DocumentUpload({ employeeId }: { employeeId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const intent = await apiFetch<UploadIntent>("/files/upload-intents", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          checksumSha256: await sha256(file),
          classification: "CONFIDENTIAL_HR",
        }),
      });
      if (!intent.storageConfigured || !intent.uploadUrl) {
        throw new Error("Object storage is not configured. The protected metadata record was created, but no file left your browser.");
      }
      const response = await fetch(intent.uploadUrl, { method: "PUT", body: file, headers: intent.requiredHeaders });
      if (!response.ok) throw new Error("The storage service rejected the upload.");
      const complete = await apiFetch<{ message: string }>(`/files/${intent.fileId}/complete`, { method: "POST" });
      toast.success("Document received", { description: complete.message });
      setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="mb-4 flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ShieldCheckIcon className="size-4" /></span><div><p className="font-medium">Secure document upload</p><p className="text-sm text-muted-foreground">PDF, JPEG, PNG, or WebP · 10 MB maximum · security scan required</p></div></div>
      <Field data-invalid={Boolean(error)}><FieldLabel htmlFor="employee-document" className="sr-only">Choose a document</FieldLabel><div className="flex flex-col gap-2 sm:flex-row"><Input id="employee-document" type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button type="button" onClick={upload} disabled={!file || pending}><FileUpIcon data-icon="inline-start" />{pending ? "Uploading…" : "Upload"}</Button></div><FieldDescription>Downloads remain locked until the configured scanner marks the object clean.</FieldDescription><FieldError>{error}</FieldError></Field>
    </div>
  );
}
