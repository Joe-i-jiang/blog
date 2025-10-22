'use client'
import siteMetadata from '@/data/siteMetadata'
import { SquareActivity } from 'lucide-react'

const Umamishare = () => {
  if (siteMetadata.analyticsUrl) {
    return (
      <button
        aria-label="Open analytics"
        type="button"
        className="hover:animate-rubber-band hover:text-primary-400"
        onClick={() => window.open(siteMetadata.analyticsUrl, '_blank')}
      >
        <SquareActivity size={22} strokeWidth={2} />
      </button>
    )
  }
}

export default Umamishare
