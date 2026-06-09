import { Info } from 'lucide-react'

interface ChatDisclosureProps {
  children: string
}

export function ChatDisclosure({ children }: ChatDisclosureProps) {
  return (
    <details className="group mt-3 px-1 text-xs text-muted-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground/70">
        <Info className="size-3.5" />
        How context works
      </summary>
      <p className="mt-2 max-w-xl leading-5">{children}</p>
    </details>
  )
}
