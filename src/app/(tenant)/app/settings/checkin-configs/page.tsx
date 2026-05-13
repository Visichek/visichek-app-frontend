import { redirect } from "next/navigation";

export default function CheckinConfigsRedirectPage() {
  redirect("/app/settings/forms?target=checkin");
}
