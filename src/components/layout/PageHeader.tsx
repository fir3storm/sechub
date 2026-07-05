import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-cyan-500/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {badge && (
          <div className="mb-2 flex items-center gap-2 font-mono-cyber text-[10px] uppercase tracking-[0.25em] text-cyan-500/80">
            <span className="status-dot status-dot-pulse bg-cyan-400" />
            {badge}
          </div>
        )}
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground cyber-glow-text sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 font-mono-cyber text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function CyberCard({
  className,
  children,
  hover = false,
  title,
  icon: Icon,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn(hover ? "cyber-panel-hover" : "cyber-panel", "p-5", className)}>
      <span className="cyber-corner-tl" />
      <span className="cyber-corner-tr" />
      <span className="cyber-corner-bl" />
      <span className="cyber-corner-br" />
      {title && (
        <div className="mb-4 flex items-center gap-2 border-b border-cyan-500/10 pb-3">
          {Icon && <Icon className="h-4 w-4 text-cyan-400" />}
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-100/90">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}
