"use client";

import { useEffect, useState } from "react";

/**
 * Tiny module-scoped registry so a queued write that outlives the component
 * that triggered it still shows up in the global "Saving…" indicator.
 *
 * Callers register a jobId when they fire the write and unregister when it
 * settles (or the notification fallback delivers). The registry is cleared on
 * full page reload, which matches the backend contract — the notification
 * delivers the bad news regardless.
 */
type Listener = () => void;

const jobIds = new Set<string>();
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function registerInFlightJob(jobId: string) {
  if (!jobId || jobIds.has(jobId)) return;
  jobIds.add(jobId);
  emit();
}

export function unregisterInFlightJob(jobId: string) {
  if (!jobIds.delete(jobId)) return;
  emit();
}

/**
 * Subscribe to the set of jobs currently being polled. Re-renders the caller
 * whenever a job is registered / unregistered.
 */
export function useInFlightJobs(): ReadonlySet<string> {
  const [snapshot, setSnapshot] = useState<Set<string>>(() => new Set(jobIds));

  useEffect(() => {
    const listener: Listener = () => setSnapshot(new Set(jobIds));
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return snapshot;
}

export function useInFlightJobCount(): number {
  const jobs = useInFlightJobs();
  return jobs.size;
}
