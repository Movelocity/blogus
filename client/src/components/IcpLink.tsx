const ICP_NUMBER = import.meta.env.VITE_ICP;

/**
 * ICP 备案号链接。
 * 通过 import.meta.env.VITE_ICP 注入，未配置时渲染为空。
 * 独立成组件以便 LandingPage 用 React.lazy 异步加载，不阻塞首屏。
 */
export function IcpLink() {
  if (!ICP_NUMBER) return null;
  return (
    <a
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {ICP_NUMBER}
    </a>
  );
}

export default IcpLink;
