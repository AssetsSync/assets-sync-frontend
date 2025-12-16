// app/auth/success/page.tsx
import { redirect } from "next/navigation";

type YnabSuccessPageProps = {
  searchParams?: { state?: string };
};

export default function YnabSuccessPage({
  searchParams,
}: YnabSuccessPageProps) {
  // This will log on the server, not in the browser console
  console.log("YNAB connected, state =", searchParams?.state);

  // Immediately send user back home
  redirect("/");
}
