import { Outlet } from "react-router";
import { Navigation } from "../Navigation";

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Navigation />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
