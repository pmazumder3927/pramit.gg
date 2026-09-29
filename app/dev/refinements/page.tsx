import { redirect } from "next/navigation";

// The selected refinement is now the default homepage.
export default function RefinementsPage() {
  redirect("/");
}
