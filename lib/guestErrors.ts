// Guest-facing copy for error codes from the guest API and the photo flow.
const MESSAGES: Record<string, string> = {
  rate_limited: "Slow down a little! Try again in a few minutes.",
  not_found: "This nominee was removed.",
  invalid_nominee: "This nominee was removed.",
  upload_failed: "Upload failed. Check your connection and try again.",
  not_image: "Couldn't read that photo. Try a different one.",
  unreadable: "Couldn't read that photo. Try a different one.",
  too_large: "That photo is too big. Try a different one.",
  no_photo: "Add a photo first",
  no_category: "Pick at least one category",
};

export const GENERIC_ERROR = "Something went wrong. Try again.";

// "closed" is the server's answer both before start and after close.
export function errorMessage(code: string, notStarted = false): string {
  if (code === "closed") return notStarted ? "Voting opens soon" : "Voting is closed";
  return MESSAGES[code] ?? GENERIC_ERROR;
}
