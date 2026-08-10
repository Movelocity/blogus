/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 页脚 ICP 备案号，例如 粤ICP备2024301748号；不设置则页脚不展示 */
  readonly VITE_ICP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
