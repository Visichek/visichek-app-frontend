import { redirect } from "next/navigation";

export default function NewCheckinConfigRedirectPage() {
  redirect("/app/settings/forms?target=checkin");
}
