"use client";
import { notFound, useParams } from "next/navigation";
import { NominateForm } from "@/components/NominateForm";
import { categoryLabel, isCategory } from "@/lib/categories";

// "+ Add a nominee" from a category screen: that category pre-checked, back to it after saving.
export default function AddPage() {
  const { category } = useParams<{ category: string }>();
  if (!isCategory(category)) notFound();
  const back = `/c/${category}`;
  return <NominateForm category={category} back={{ href: back, label: categoryLabel(category) }} done={back} />;
}
