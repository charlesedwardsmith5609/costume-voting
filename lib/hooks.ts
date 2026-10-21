"use client";
// Client hooks for guest screens. Shared state stays in Postgres; these only cache the latest
// server answers in React state for the current page.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchState, issueUpload, type IssuedUpload } from "./api";
import { clockOffset, statusView, type StatusView } from "./clock";
import { checkPicked, preparePhoto, type PreparedPhoto } from "./photo";
import { ALREADY_SAVED, FlowError, newProgress, runPhotoFlow, type FlowProgress, type Stage } from "./photoFlow";
import type { GuestState } from "./types";
import { putFile } from "./upload";

const STATE_POLL_MS = 15_000;

// Runs fn now, whenever the tab becomes visible again, and every intervalMs if given.
export function useOnVisible(fn: () => void, intervalMs?: number): void {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    run();
    document.addEventListener("visibilitychange", run);
    const timer = intervalMs ? setInterval(run, intervalMs) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", run);
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);
}

// The voting window from /api/state, polled every 15 seconds, with a one-second clock for the
// countdown. The countdown uses the server's clock: the phone's clock plus the measured offset.
export function useGuestState(): { state: GuestState | null; view: StatusView; failed: boolean; refresh: () => void } {
  const [state, setState] = useState<GuestState | null>(null);
  const [failed, setFailed] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    fetchState()
      .then(({ state, sentAt, receivedAt }) => {
        setOffset(clockOffset(state.serverNow, sentAt, receivedAt));
        setState(state);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useOnVisible(refresh, STATE_POLL_MS);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const view = statusView(state, now + offset);
  // The countdown reached 0: confirm with the server instead of assuming (the host may extend).
  const serverStatus = state?.status;
  useEffect(() => {
    if (view.kind === "closed" && serverStatus === "open") refresh();
  }, [view.kind, serverStatus, refresh]);

  return { state, view, failed, refresh };
}

function stageText(stage: Stage, fraction = 0): string {
  if (stage === "preparing") return "Preparing photo…";
  if (stage === "uploading") return `Uploading… ${Math.round(fraction * 100)}%`;
  return "Saving…";
}

type Job = { prepared: Promise<PreparedPhoto>; progress: FlowProgress };

// A picked photo and the save that uses it. Compression starts as soon as a photo is picked.
// The photo, the upload, and the error survive a failure, so "Try again" resumes. issue gets the
// signed upload URLs; admin pages pass their own (host/ paths, no voting window).
export function usePhotoSave(issue: () => Promise<IssuedUpload> = issueUpload) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const job = useRef<Job | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = useCallback((file: File) => {
    setError(null);
    const problem = checkPicked(file);
    if (problem) return setPickError(problem);
    setPickError(null);
    setPreview(URL.createObjectURL(file));
    const current: Job = { prepared: preparePhoto(file), progress: newProgress() };
    job.current = current;
    current.prepared.catch((err: Error) => {
      if (job.current === current) setPickError(err.message);
    });
  }, []);

  // save gets the uploaded photo path, or undefined when no photo was picked.
  const run = useCallback(async <T>(save: (photoPath?: string) => Promise<T>): Promise<T | typeof ALREADY_SAVED | null> => {
    setError(null);
    const current = job.current;
    try {
      if (!current) {
        setStage("Saving…");
        return await save();
      }
      return await runPhotoFlow(current.progress, {
        prepare: () => current.prepared,
        issue,
        put: putFile,
        save,
        onStage: (s, f) => setStage(stageText(s, f)),
      });
    } catch (err) {
      const code = err instanceof FlowError || err instanceof ApiError ? err.code : "server_error";
      setError(code);
      return null;
    } finally {
      setStage(null);
    }
  }, [issue]);

  return { hasPhoto: preview !== null, preview, pickError, stage, error, pick, run };
}
