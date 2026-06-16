import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { ArchivePage } from "./pages/ArchivePage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PostPage } from "./pages/PostPage";
import { BlogLayout } from "./components/layouts/BlogLayout";
import { AdminLayout } from "./components/layouts/AdminLayout";
import "./tailwind.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<BlogLayout />}>
          <Route element={<HomePage />} path="/blog" />
          <Route element={<ArchivePage />} path="/archive" />
          <Route element={<PostPage />} path="/posts/:slug" />
          <Route element={<LoginPage />} path="/login" />
        </Route>
        <Route element={<AdminLayout />}>
          <Route element={<AdminPage />} path="/admin" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
