'use client'

import { MinimalistHero } from '@/components/ui/minimalist-hero'

export default function Home() {
  return (
    <MinimalistHero
      logoText="DeMolay"
      navLinks={[
        { label: 'História',   href: '/historia' },
        { label: 'Past MC',    href: '/antigos-mc' },
        { label: 'Fotos',      href: '/fotos' },
        { label: 'Eventos',    href: '/eventos' },
        { label: 'Tesouraria', href: '/login' },
      ]}
      mainText=""
      readMoreLink="#"
      imageSrc="/jacques.png"
      imageAlt="Jacques DeMolay"
      overlayText={{ part1: 'Roque', part2: 'Diniz', part3: 'Arruda' }}
      instagramHandle="@roquedinizarruda"
      socialLinks={[]}
      locationText="Capítulo Nº 307 — Brasil"
      className="w-full h-full"
    />
  )
}
