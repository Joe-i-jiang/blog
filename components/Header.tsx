import siteMetadata from '@/data/siteMetadata'
import headerNavLinks from '@/data/headerNavLinks'
import Image from '@/components/Image'
import Link from '@/components/Link'
import MobileNav from '@/components/MobileNav'
import ThemeSwitch from '@/components/ThemeSwitch'
import SearchButton from '@/components/SearchButton'
import Umamishare from '@/components/Umamishare'
import { clsx } from 'clsx'

const Header = () => {
  let headerClass = 'flex items-center w-full bg-white dark:bg-dark justify-between py-10'
  if (siteMetadata.stickyNav) {
    headerClass += ' sticky top-0 z-50'
  }

  return (
    <header className={headerClass}>
      <Link
        href="/"
        aria-label={siteMetadata.headerTitle}
        className={clsx([
          'rounded-xl p-0.5',
          'ring-1 ring-zinc-900/5 dark:ring-white/10',
          'shadow-lg shadow-zinc-800/5',
        ])}
      >
        <Image
          src="/static/headfig.jpg"
          alt={siteMetadata.headerTitle}
          width={100}
          height={100}
          className="h-10 w-10 rounded-xl"
          loading="eager"
        />
      </Link>
      <div className="flex items-center space-x-4 leading-5 sm:space-x-6">
        <div className="no-scrollbar hidden max-w-40 items-center space-x-4 overflow-x-auto sm:flex sm:space-x-6 md:max-w-72 lg:max-w-96">
          {headerNavLinks
            .filter((link) => link.href !== '/')
            .map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="block px-1 font-bold text-gray-900 hover:text-primary-500 dark:text-gray-100 dark:hover:text-primary-400"
              >
                {link.title}
              </Link>
            ))}
        </div>
        <Umamishare />
        <SearchButton />
        <ThemeSwitch />
        <MobileNav />
      </div>
    </header>
  )
}

export default Header
