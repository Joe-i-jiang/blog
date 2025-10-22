'use client'

import { Fragment, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Radio,
  RadioGroup,
  Transition,
} from '@headlessui/react'
import { MoonStar, Sun, Laptop, SunMoon } from 'lucide-react'

const THEMES = [
  {
    label: 'Light',
    value: 'light',
    icon: Sun,
  },
  {
    label: 'Dark',
    value: 'dark',
    icon: MoonStar,
  },
  {
    label: 'System',
    value: 'system',
    icon: Laptop,
  },
]

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  // When mounted on client, now we can show the UI
  useEffect(() => setMounted(true), [])

  return (
    <div className="mr-5 flex items-center">
      <Menu as="div" className="relative inline-block text-left">
        <div className="flex items-center justify-center hover:animate-rubber-band hover:text-primary-400">
          <MenuButton aria-label="Theme switcher">
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <MoonStar strokeWidth={2} size={22} />
              ) : (
                <Sun strokeWidth={2} size={22} />
              )
            ) : (
              <SunMoon strokeWidth={2} size={22} />
            )}
          </MenuButton>
        </div>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="transform opacity-0 scale-75"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-200"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-75"
        >
          <MenuItems className="absolute right-1/2 z-50 mt-2 w-28 origin-top-right translate-x-1/2 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-black">
            <RadioGroup value={theme} onChange={setTheme}>
              <div className="space-y-1 p-1">
                {THEMES.map(({ label, value, icon: Icon }) => (
                  <Radio
                    key={value}
                    value={value}
                    as="div"
                    className="cursor-pointer rounded-md hover:bg-gray-200 data-[checked]:bg-gray-200 dark:hover:bg-gray-800 dark:data-[checked]:bg-gray-800"
                  >
                    <MenuItem
                      as="div"
                      className="flex w-full items-center gap-3 px-2 py-1.5 text-sm"
                    >
                      <Icon size={20} strokeWidth={2} />
                      <span>{label}</span>
                    </MenuItem>
                  </Radio>
                ))}
              </div>
            </RadioGroup>
          </MenuItems>
        </Transition>
      </Menu>
    </div>
  )
}

export default ThemeSwitch
