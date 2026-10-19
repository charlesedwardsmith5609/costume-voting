"use client";
import { NominateForm } from "@/components/NominateForm";

// "Nominate a costume", step 3: someone new. No category pre-checked; home after saving.
export default function NominateNewPage() {
  return <NominateForm category={null} back={{ href: "/nominate", label: "Already here?" }} done="/" />;
}
