import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RegistryClient from "./registry-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("x-user-email");

  // Middleware already verified the JWT. If no email header, session is missing.
  if (!email) {
    redirect("/login");
  }

  // Pass the verified email from the JWT into the client shell.
  // The client fetches the full profile from /api/registry on mount.
  const user = {
    displayName: email.split("@")[0],
    email,
  };

  return <RegistryClient initialUser={user} />;
}
