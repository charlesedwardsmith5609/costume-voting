import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { ALREADY_SAVED, FlowError, newProgress, runPhotoFlow, type FlowDeps } from "@/lib/photoFlow";

const photo = new Blob(["photo"]);
const thumb = new Blob(["thumb"]);
const issued = (n: number) => ({ path: `guest/${n}.jpg`, signedUrl: `photo-${n}`, thumbSignedUrl: `thumb-${n}` });

// Fake steps that record calls and fail when told to.
function fakes(fail: Partial<Record<"prepare" | "issue" | "photo" | "thumb" | "save", unknown>> = {}) {
  const calls: string[] = [];
  let issues = 0;
  const deps: FlowDeps<string> = {
    prepare: async () => {
      calls.push("prepare");
      if (fail.prepare) throw fail.prepare;
      return { photo, thumb };
    },
    issue: async () => {
      calls.push("issue");
      if (fail.issue) throw fail.issue;
      return issued(++issues);
    },
    put: async (url, file, onProgress) => {
      calls.push(`put ${url}`);
      const which = file === photo ? "photo" : "thumb";
      if (fail[which]) throw fail[which];
      onProgress(1);
    },
    save: async (path) => {
      calls.push(`save ${path}`);
      if (fail.save) throw fail.save;
      return "saved";
    },
    onStage: () => {},
  };
  return { deps, calls, fail };
}

async function failure(p: Promise<unknown>): Promise<FlowError> {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(FlowError);
  return err as FlowError;
}

describe("runPhotoFlow", () => {
  it("prepares, issues, uploads the photo and thumbnail, then saves the issued path", async () => {
    const { deps, calls } = fakes();
    expect(await runPhotoFlow(newProgress(), deps)).toBe("saved");
    expect(calls).toEqual(["prepare", "issue", "put photo-1", "put thumb-1", "save guest/1.jpg"]);
  });

  it("a failed photo upload retries with fresh URLs, without compressing again", async () => {
    const f = fakes({ photo: new Error("offline") });
    const p = newProgress();
    expect((await failure(runPhotoFlow(p, f.deps))).code).toBe("upload_failed");
    f.fail.photo = undefined;
    f.calls.length = 0;
    expect(await runPhotoFlow(p, f.deps)).toBe("saved");
    expect(f.calls).toEqual(["issue", "put photo-2", "put thumb-2", "save guest/2.jpg"]);
  });

  it("an upload Storage accepted but whose response was lost does not block the retry", async () => {
    // Storage keeps the first file and refuses a second upload to the same path.
    const stored = new Set<string>();
    const f = fakes();
    let loseResponse = true;
    f.deps.put = async (url) => {
      f.calls.push(`put ${url}`);
      if (stored.has(url)) throw new Error("409 already exists");
      stored.add(url);
      if (loseResponse && url.startsWith("photo")) throw new Error("timeout");
    };
    const p = newProgress();
    expect((await failure(runPhotoFlow(p, f.deps))).code).toBe("upload_failed");
    loseResponse = false;
    expect(await runPhotoFlow(p, f.deps)).toBe("saved");
    expect(f.calls.at(-1)).toBe("save guest/2.jpg");
  });

  it("a failed save retries only the save; nothing is uploaded twice", async () => {
    const f = fakes({ save: new ApiError("network") });
    const p = newProgress();
    expect((await failure(runPhotoFlow(p, f.deps))).code).toBe("network");
    f.fail.save = undefined;
    f.calls.length = 0;
    expect(await runPhotoFlow(p, f.deps)).toBe("saved");
    expect(f.calls).toEqual(["save guest/1.jpg"]);
  });

  it("a save that went through but whose response was lost is not saved twice", async () => {
    for (const lost of [new ApiError("network"), new ApiError("server_error"), new Error("boom")]) {
      const f = fakes({ save: lost });
      const p = newProgress();
      await failure(runPhotoFlow(p, f.deps));
      // The first save committed, so the path is now used.
      f.fail.save = new ApiError("invalid_photo");
      f.calls.length = 0;
      expect(await runPhotoFlow(p, f.deps)).toBe(ALREADY_SAVED);
      expect(f.calls).toEqual(["save guest/1.jpg"]);
    }
  });

  it("a definite rejection between tries does not hide that an earlier save may have committed", async () => {
    const f = fakes({ save: new ApiError("network") });
    const p = newProgress();
    await failure(runPhotoFlow(p, f.deps));
    f.fail.save = new ApiError("rate_limited");
    expect((await failure(runPhotoFlow(p, f.deps))).code).toBe("rate_limited");
    f.fail.save = new ApiError("invalid_photo");
    expect(await runPhotoFlow(p, f.deps)).toBe(ALREADY_SAVED);
  });

  it("a failed thumbnail does not stop the save and is not retried", async () => {
    const f = fakes({ thumb: new Error("offline"), save: new ApiError("network") });
    const p = newProgress();
    await failure(runPhotoFlow(p, f.deps));
    expect(f.calls).toContain("put thumb-1");
    f.fail.save = undefined;
    f.calls.length = 0;
    expect(await runPhotoFlow(p, f.deps)).toBe("saved");
    expect(f.calls).toEqual(["save guest/1.jpg"]);
  });

  it("when the server rejects the photo, the next try uploads to fresh URLs", async () => {
    const f = fakes({ save: new ApiError("invalid_photo") });
    const p = newProgress();
    expect((await failure(runPhotoFlow(p, f.deps))).code).toBe("upload_failed");
    f.fail.save = undefined;
    f.calls.length = 0;
    expect(await runPhotoFlow(p, f.deps)).toBe("saved");
    expect(f.calls).toEqual(["issue", "put photo-2", "put thumb-2", "save guest/2.jpg"]);
  });

  it("reports server answers when getting upload URLs, and a lost connection as an upload failure", async () => {
    expect((await failure(runPhotoFlow(newProgress(), fakes({ issue: new ApiError("rate_limited") }).deps))).code).toBe("rate_limited");
    expect((await failure(runPhotoFlow(newProgress(), fakes({ issue: new ApiError("closed") }).deps))).code).toBe("closed");
    expect((await failure(runPhotoFlow(newProgress(), fakes({ issue: new ApiError("network") }).deps))).code).toBe("upload_failed");
  });

  it("reports why a photo could not be prepared", async () => {
    for (const [thrown, code] of [
      [new Error("too_large"), "too_large"],
      [new Error("unreadable"), "unreadable"],
      [new Error("canvas exploded"), "unreadable"],
    ] as const) {
      const err = await failure(runPhotoFlow(newProgress(), fakes({ prepare: thrown }).deps));
      expect([err.stage, err.code]).toEqual(["preparing", code]);
    }
  });
});
