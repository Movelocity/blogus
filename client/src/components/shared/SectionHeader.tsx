interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, className = "" }: SectionHeaderProps) {
  return (
    <header className={`grid gap-6 border-b border-foreground/10 pb-10 lg:grid-cols-12 lg:items-end ${className}`}>
      <div className="lg:col-span-7">
        <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
          <span className="h-px w-8 bg-foreground/30" />
          {eyebrow}
        </span>
        <h1 className="m-0 font-display text-6xl leading-[0.92] tracking-tight text-foreground md:text-7xl lg:text-[96px]">
          {title}
        </h1>
      </div>
      {description ? (
        <div className="lg:col-span-5 lg:pb-4">
          <p className="m-0 text-lg leading-relaxed text-muted-foreground">{description}</p>
        </div>
      ) : null}
    </header>
  );
}
