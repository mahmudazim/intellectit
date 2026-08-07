import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { mobileNavFor, navFor } from "@/lib/nav";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { MobileTopBar } from "@/components/nav/MobileTopBar";
import { Sidebar } from "@/components/nav/Sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, fullName } = session.user;
  const items = navFor(role);
  const mobileItems = mobileNavFor(role);

  return (
    <div className="min-h-dvh">
      <Sidebar
        items={items}
        fullName={fullName}
        roleLabel={role === "TEACHER" ? "O'qituvchi" : "O'quvchi"}
      />

      <div className="lg:pl-60">
        <MobileTopBar />
        {/* pb-20: pastki tab bar kontentni yopib qolmasligi uchun */}
        <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-4 md:px-6 lg:pb-8 lg:pt-6">
          {children}
        </main>
      </div>

      <BottomTabBar items={mobileItems} />
    </div>
  );
}
