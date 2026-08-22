"use client";

import { useState, type FormEvent } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type EmployeeSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "The update could not be saved.";

export function EditWorkProfileDialog({ profile, onUpdated }: { profile: EmployeeSummary; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await apiFetch(`/employees/${profile.id}`, { method: "PATCH", body: JSON.stringify({ ...values, version: profile.version }) });
      toast.success("Work profile updated"); setOpen(false); onUpdated();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" size="sm" />}><PencilIcon />Edit profile</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit work profile</DialogTitle><DialogDescription>Only fields permitted by your role will be changed. Version checks prevent overwriting a newer update.</DialogDescription></DialogHeader><form onSubmit={submit} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="preferredName">Preferred name</FieldLabel><Input id="preferredName" name="preferredName" defaultValue={profile.preferredName ?? ""} /></Field><Field><FieldLabel htmlFor="workPhone">Work phone</FieldLabel><Input id="workPhone" name="workPhone" type="tel" defaultValue={profile.workPhone ?? ""} /></Field><Field data-invalid={Boolean(error)}><FieldLabel htmlFor="jobTitle">Job title</FieldLabel><Input id="jobTitle" name="jobTitle" defaultValue={profile.jobTitle ?? ""} /><FieldDescription>Job title changes require HR or Admin access.</FieldDescription><FieldError>{error}</FieldError></Field></FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function EditResumeDialog({ profile, onUpdated }: { profile: EmployeeSummary; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await apiFetch(`/employees/${profile.id}/resume`, { method: "PATCH", body: JSON.stringify(values) }); toast.success("Resume updated"); setOpen(false); onUpdated(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setPending(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button variant="outline" size="sm" />}><PencilIcon />Edit resume</DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Edit resume</DialogTitle><DialogDescription>Share a concise introduction, what motivates you at work, and interests colleagues can connect over.</DialogDescription></DialogHeader><form onSubmit={submit} className="flex flex-col gap-5"><FieldGroup><Field><FieldLabel htmlFor="about">About</FieldLabel><Textarea id="about" name="about" rows={4} defaultValue={profile.resume?.about ?? ""} /></Field><Field><FieldLabel htmlFor="jobLove">What I love at work</FieldLabel><Textarea id="jobLove" name="jobLove" rows={3} defaultValue={profile.resume?.jobLove ?? ""} /></Field><Field data-invalid={Boolean(error)}><FieldLabel htmlFor="interests">Interests</FieldLabel><Textarea id="interests" name="interests" rows={3} defaultValue={profile.resume?.interests ?? ""} /><FieldError>{error}</FieldError></Field></FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save resume"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
