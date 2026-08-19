/**
 * 站点文案配置。
 *
 * 构建时（tsc + vite build）编译进 bundle，运行时不可改，改文案即改此文件。
 * 备案站名：伟康技术小站（分享编程技术学习记录与日常生活感悟）。
 */

export const siteConfig = {
  /** 站名（导航、页脚、页面标题） */
  name: "伟康技术小站",

  /** Hero 主标题：拆成两行，第二行高亮 */
  hero: {
    title: ["走过的路，", "写成的诗"],
    /** 副标题（方案二：敲成诗篇） */
    tagline: "一行代码，写给今天；半页文字，寄给远方。",
    /** 站点一句话简介 */
    description: "一个程序员的自留地。技术记录与生活随笔在这里落脚——左边是谋生的手艺，右边是生活本身。",
  },

  /** 主 CTA */
  cta: {
    label: "开始阅读",
    to: "/posts",
  },

  /** Collections 区块标题 */
  collections: {
    title: "内容分类",
    subtitle: "代码与生活",
  },

  /** 导航链接（桌面端） */
  navLinks: [
    { name: "文章", to: "/blog" },
    { name: "时间线", to: "/archive" },
    { name: "日历", to: "/calendar" },
  ],

  /** Bento 卡片 */
  bentoItems: [
    {
      className: "bg-[#264653] text-white md:col-span-6",
      label: "Projects",
      title: "个人项目",
      description: "正在做和做完的独立开发项目，以及背后的取舍记录。",
    },
    {
      className: "bg-accent text-accent-foreground md:col-span-6",
      label: "Notes",
      title: "学习笔记",
      description: "边学边记的技术笔记，主要给自己看，能帮到别人更好。",
    },
    {
      className: "bg-[#e9c46a] text-[#1a1408] md:col-span-4",
      label: "Toolbox",
      title: "工具折腾",
      description: "编辑器、CLI、自托管服务的配置与踩坑记录。",
    },
    {
      className: "bg-card text-card-foreground border border-foreground/10 md:col-span-4",
      label: "Reading",
      title: "阅读记录",
      description: "读过的书和值得回看的文章摘记。",
    },
    {
      className: "bg-[#2a9d8f] text-white md:col-span-4",
      label: "Timeline",
      title: "时间线",
      description: "按月份回看所有公开记录。",
    },
  ],

  /** 页脚 */
  footer: {
    blurb: "自托管写作平台，面向长期阅读。",
    copyright: "伟康技术小站 · 技术记录与生活随笔",
  },
} as const;

export type SiteConfig = typeof siteConfig;
