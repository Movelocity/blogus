import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * 构建期把 ICP 备案号内联进 index.html。
 * 备案爬虫和多数 SEO 抓取不执行 JS，必须落在原始 HTML 里才能被读到。
 * VITE_ICP 为空时不注入。
 */
function injectIcp(): Plugin {
  return {
    name: "inject-icp",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const mode = ctx.server ? "development" : "production";
        const icp = loadEnv(mode, process.cwd(), "VITE_").VITE_ICP?.trim();
        if (!icp) return [];
        return [
          {
            tag: "div",
            attrs: { id: "icp-beian", style: "display:none" },
            children: [
              {
                tag: "a",
                attrs: { href: "https://beian.miit.gov.cn/", rel: "nofollow" },
                children: icp
              }
            ],
            injectTo: "body"
          }
        ];
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), injectIcp()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      "/api": "http://127.0.0.1:3009",
      "/uploads": "http://127.0.0.1:3009"
    }
  }
});
