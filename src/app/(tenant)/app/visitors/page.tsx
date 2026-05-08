import { redirect } from "next/navigation";

export default function VisitorsPage() {
  redirect("/app/visitors/pending");
}
