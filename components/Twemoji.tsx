export type TwemojiProps = {
  emoji: string
  size?: string
  className?: string
}

export function kebabCase(str: string): string {
  return (
    str
      ?.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
      ?.map((x) => x.toLowerCase())
      ?.join('-') || str
  )
}

export function Twemoji({ emoji, size = 'twa-lg', className }: TwemojiProps) {
  const cls = `inline-block twa ${size} twa-${kebabCase(emoji)} ${className || ''}`
  return <i className={cls.trim()} />
}

export default Twemoji
