import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neon' | 'magenta' | 'warn' | 'ghost' | 'danger' | 'success'

const TONES: Record<Tone, string> = {
  neon: 'bg-neon text-primary-foreground hover:brightness-110 neon-glow',
  magenta: 'bg-magenta text-accent-foreground hover:brightness-110 magenta-glow',
  warn: 'bg-warn text-primary-foreground hover:brightness-110',
  success: 'bg-success text-primary-foreground hover:brightness-110',
  ghost: 'bg-secondary text-foreground hover:bg-muted border border-border',
  danger: 'bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25',
}

export function NeonButton({
  tone = 'neon',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Panel({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-sm', className)}>
      {(title || action) && (
        <header className="mb-2.5 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-sm tracking-wide text-foreground">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Badge({ children, tone = 'neon', className }: { children: ReactNode; tone?: 'neon' | 'magenta' | 'warn' | 'danger' | 'muted' | 'success'; className?: string }) {
  const tones = {
    neon: 'border-neon/40 bg-neon/10 text-neon',
    magenta: 'border-magenta/40 bg-magenta/10 text-magenta',
    warn: 'border-warn/40 bg-warn/10 text-warn',
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    success: 'border-success/40 bg-success/10 text-success',
    muted: 'border-border bg-muted text-muted-foreground',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Meter({ value, label, className }: { value: number; label?: string; className?: string }) {
  const color = value >= 70 ? 'bg-success' : value >= 40 ? 'bg-warn' : 'bg-destructive'
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums text-foreground">{Math.round(value)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>
      <p className="font-display text-sm">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="flex-1 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div className="max-h-[85%] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-6 scrollbar-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
