import { describe, expect, it } from "vitest";
import { buildSlideshowPhotos } from "@/lib/server/slideshow";

const nominee = (id: string, photo: string, hidden = false, person: string | null = id) => ({
  id,
  person_name: person,
  costume_name: null,
  photo_path: photo,
  hidden,
});

describe("buildSlideshowPhotos", () => {
  it("lists current, hidden, earlier, and unused photos once each, with labels", () => {
    const photos = buildSlideshowPhotos({
      nominees: [nominee("a", "guest/1.jpg"), nominee("b", "guest/2.jpg", true), nominee("c", "guest/3.jpg", false, null)],
      edits: [
        { nominee_id: "a", old_photo_path: "guest/0.jpg", new_photo_path: "guest/1.jpg" },
        { nominee_id: "a", old_photo_path: "guest/1.jpg", new_photo_path: "host/9.jpg" },
      ],
      uploadPaths: ["guest/1.jpg", "guest/7.jpg"],
      excluded: new Set(),
    });
    expect(photos.map((p) => [p.path, p.label, p.source])).toEqual([
      ["guest/1.jpg", "a", "current"],
      ["guest/2.jpg", "b", "hidden"],
      ["guest/3.jpg", "Mystery guest 👻", "current"],
      ["guest/0.jpg", "a", "earlier"],
      ["host/9.jpg", "a", "earlier"],
      ["guest/7.jpg", null, "unused"],
    ]);
  });

  it("marks excluded photos", () => {
    const photos = buildSlideshowPhotos({
      nominees: [nominee("a", "guest/1.jpg"), nominee("b", "guest/2.jpg")],
      edits: [],
      uploadPaths: [],
      excluded: new Set(["guest/2.jpg"]),
    });
    expect(photos.map((p) => p.excluded)).toEqual([false, true]);
  });
});
