interface ChatHeaderProps {
  title: string
  subtitle: string
  messageCount: number
  maxMessages: number
}

export function ChatHeader({
  title,
  subtitle,
  messageCount,
  maxMessages,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-5 py-4">
      <div>
        <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {messageCount}/{maxMessages}
      </span>
    </header>
  )
}
