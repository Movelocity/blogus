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
    eyebrow: "技术生活新纪元",
    title: ["光与代码，", "塑成日常"],
    lead:
      "这里分享的不是功能清单，而是技术如何退居幕后——在架构取舍、工具选型与工程秩序里，寻找能住进日常的克制与质感。",
    secondary:
      "独立项目与系统设计是入口；真正想传递的，是一种看待代码的方式：长期主义、少即是多，让工具像光一样安静塑形，而不是争夺注意力。",
    /** 站点一句话简介（SEO、分享卡片） */
    description:
      "分享系统设计与技术生活理念。架构取舍、工具哲学与工程秩序——为追求质感的技术生活者，留下一套能住进日常的思考方式。",
  },

  /** 主 CTA */
  cta: {
    label: "进入文章",
    to: "/posts",
  },

  /** Collections 区块标题 */
  collections: {
    title: "五个维度，一种语法",
    subtitle: "理念与实践",
    description:
      "不是教程堆砌，而是让工具退居幕后，只留下架构判断、工程节奏与生活质地之间的默契。",
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
      label: "Architecture",
      title: "系统与架构",
      description: "复杂度的边界、服务的拆分与演进——分享那些愿意慢下来的设计判断。",
    },
    {
      className: "bg-accent text-accent-foreground md:col-span-6",
      label: "Craft",
      title: "工程秩序",
      description: "命名、模块与协作习惯构成看不见的底座；秩序本身，就是一种工程美学。",
    },
    {
      className: "bg-[#e9c46a] text-[#1a1408] md:col-span-4",
      label: "Tools",
      title: "工具哲学",
      description: "编辑器、CLI 与自托管不是炫技清单，而是延伸意志、缩短距离的外骨骼。",
    },
    {
      className: "bg-card text-card-foreground border border-foreground/10 md:col-span-4",
      label: "Sources",
      title: "思想源头",
      description: "书页与长文里借来的视角，反哺日常里的架构决策与产品取舍。",
    },
    {
      className: "bg-[#2a9d8f] text-white md:col-span-4",
      label: "Evolution",
      title: "演进脉络",
      description: "理念随项目迭代而变；回看的不是流水账，而是思路如何一步步成形。",
    },
  ],

  /** 页脚 */
  footer: {
    blurb: "技术理念与个人实践的长期分享，面向愿意慢下来的读者。",
    copyright: "伟康技术小站 · 技术理念与生活质感",
  },

  /** 文章页作者信息（展示在标题下方） */
  author: {
    name: "伟康",
    bio: "程序员，分享系统设计与技术生活的看法",
    avatarUrl: undefined as string | undefined,
  },
} as const;

export type SiteConfig = typeof siteConfig;
