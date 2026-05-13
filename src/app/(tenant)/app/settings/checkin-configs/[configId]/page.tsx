import { redirect } from "next/navigation";

export default function CheckinConfigDetailRedirectPage() {
  redirect("/app/settings/forms?target=checkin");
}
