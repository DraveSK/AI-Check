import type { ReactNode } from 'react';
import { Loader2, Inbox, CircleAlert } from 'lucide-react';

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'pill ' + tone}>{children}</span>;
}

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={'card ' + className} {...rest}>
      {children}
    </section>
  );
}

export function PageTitle({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

export function Meter({ value, color = 'var(--accent)' }: { value: number; color?: string }) {
  return (
    <div className="meter">
      <i style={{ width: value + '%', background: color }} />
    </div>
  );
}

/** Renders inside a Card while a provider request is in flight. */
export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="state-block">
      <Loader2 size={18} className="spin" />
      <p>{label}</p>
    </div>
  );
}

/** Renders inside a Card when a provider returns no data yet. */
export function EmptyState({ label = 'No data yet. Run an inspection to populate this view.' }: { label?: string }) {
  return (
    <div className="state-block">
      <Inbox size={18} />
      <p>{label}</p>
    </div>
  );
}

/** Renders inside a Card when a provider request fails. */
export function ErrorState({ label }: { label: string }) {
  return (
    <div className="state-block error">
      <CircleAlert size={18} />
      <p>{label}</p>
    </div>
  );
}
