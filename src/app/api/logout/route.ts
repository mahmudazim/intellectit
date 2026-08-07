import { signOut } from "@/lib/auth";

export async function POST() {
  // signOut redirect javobini o'zi qaytaradi
  await signOut({ redirectTo: "/login" });
}
