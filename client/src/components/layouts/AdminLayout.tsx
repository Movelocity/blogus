import { Outlet } from "react-router";
import { Navigation } from "../Navigation";

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Navigation />
      <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-6 pb-32 pt-28 lg:px-12">
        <Outlet />
      </main>
    </div>
  );
}
