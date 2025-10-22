import { clsx } from 'clsx'
import TiltedGrid from '@/icons/tilted-grid.svg'

export function TiltedGridBackground({ className }: { className?: string }) {
  return (
    <div
      className={clsx([
        'absolute overflow-hidden [mask-image:linear-gradient(white,transparent)]',
        className,
      ])}
    >
      <TiltedGrid
        className={clsx([
          'h-[160%] w-full',
          'absolute inset-x-0 inset-y-[-30%] skew-y-[-18deg]',
          'dark:fill-white/[.02] dark:stroke-white/[.04]',
          'fill-black/[0.03] stroke-black/[0.08]',
        ])}
      />
    </div>
  )
}
