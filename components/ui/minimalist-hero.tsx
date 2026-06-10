'use client'

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asset } from '@/lib/asset';

interface MinimalistHeroProps {
  logoText: string;
  navLinks: { label: string; href: string; onClick?: () => void }[];
  mainText: string;
  readMoreLink: string;
  imageSrc: string;
  imageAlt: string;
  overlayText: { part1: string; part2: string; part3?: string; part4?: string };
  socialLinks: { icon: LucideIcon; href: string }[];
  locationText: string;
  instagramHandle?: string;
  className?: string;
}

const InstagramSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
)

export const MinimalistHero = ({
  logoText, navLinks, mainText, readMoreLink,
  imageSrc, imageAlt, overlayText, socialLinks, locationText, instagramHandle, className,
}: MinimalistHeroProps) => {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ background: '#0a0a0a', color: '#ffffff', fontFamily: 'sans-serif', width: '100%', height: '100vh' }}
    >
      <style>{`
        @keyframes mhFadeDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mhFadeUp   { from{opacity:0;transform:translateY(50px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mhFadeRight{ from{opacity:0;transform:translateX(40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes mhFade     { from{opacity:0} to{opacity:1} }

        @media (max-width: 768px) {
          /* botões no topo, centralizados e bem visíveis */
          .mh-nav   { top: 14px !important; left: 0 !important; right: 0 !important; justify-content: center !important;
                      gap: 10px !important; flex-wrap: wrap !important; padding: 0 12px !important; }
          .mh-nav a { font-size: 12px !important; color: #fff !important; font-weight: 700 !important;
                      background: rgba(255,255,255,0.12) !important; border: 1px solid rgba(255,255,255,0.25) !important;
                      padding: 7px 16px !important; border-radius: 999px !important; backdrop-filter: blur(6px) !important; }
          /* Jacques fica como está (não mexer) */
          .mh-imgwrap { padding-right: 0 !important; align-items: center !important; }
          .mh-img   { height: 52vh !important; }
          /* texto maior, posicionado mais abaixo (sobre o corpo, não o rosto) */
          .mh-title { right: 0 !important; left: 0 !important; top: 62% !important; bottom: auto !important;
                      transform: translateY(-50%) !important; text-align: center !important; padding: 0 16px !important; }
          .mh-title h1 { font-size: clamp(3rem, 16vw, 5.2rem) !important; line-height: 0.93 !important;
                         letter-spacing: -0.04em !important; font-weight: 900 !important;
                         text-shadow: 0 4px 30px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.75) !important; }
          /* Instagram colado logo abaixo do texto */
          .mh-insta { top: 62% !important; left: 0 !important; right: 0 !important; bottom: auto !important;
                      justify-content: center !important; transform: translateY(88px) !important; font-size: 12px !important;
                      opacity: 0.9 !important; text-shadow: 0 2px 10px rgba(0,0,0,0.8) !important; }
          .mh-loc   { bottom: 16px !important; right: 0 !important; left: 0 !important; text-align: center !important; }
        }
      `}</style>

      {/* Nav — topo direito */}
      <nav className="mh-nav" style={{ position: 'absolute', top: 32, right: 48, zIndex: 30, display: 'flex', gap: 40, animation: 'mhFadeDown .5s ease both' }}>
        {navLinks.map(link => (
          <a key={link.label} href={link.href}
            onClick={(e) => {
              if (link.onClick) {
                e.preventDefault()
                link.onClick()
              } else if (link.href === '/') {
                e.preventDefault()
                const el = document.getElementById('main-scroll')
                if (el) el.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
              }
            }}
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' }}>
            {link.label}
          </a>
        ))}
      </nav>

      {/* Container central — flex garante centralização horizontal */}
      <div className="mh-imgwrap" style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        zIndex: 2,
        pointerEvents: 'none',
        paddingRight: '14%',
      }}>
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Jacques */}
          <img
            className="mh-img"
            src={asset(imageSrc)} alt={imageAlt}
            style={{
              position: 'relative',
              zIndex: 2,
              height: '92vh',
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'bottom',
              animation: 'mhFadeUp 1s cubic-bezier(.22,1,.36,1) .3s both',
            }}
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.onerror = null
              t.src = 'https://placehold.co/400x700/c0392b/ffffff?text=Jacques+DeMolay'
            }}
          />
        </div>
      </div>

      {/* Texto grande — enorme, branco, sobreposto à figura, centralizado na altura */}
      <div className="mh-title" style={{ position: 'absolute', right: 48, top: '50%', transform: 'translateY(-50%)', zIndex: 30, textAlign: 'left' }}>
        <div style={{ animation: 'mhFadeRight .8s cubic-bezier(.22,1,.36,1) .6s both' }}>
          <h1 style={{
            fontSize: 'clamp(3rem, 8.5vw, 9rem)',
            fontWeight: 800,
            lineHeight: 1.02,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            margin: 0,
            whiteSpace: 'nowrap',
          }}>
            {overlayText.part1}<br />
            {overlayText.part2}<br />
            {overlayText.part3}
          </h1>
        </div>
      </div>

      {/* Footer esquerdo — Instagram */}
      {instagramHandle && (
        <a
          className="mh-insta"
          href={`https://instagram.com/${instagramHandle.replace('@', '')}`}
          target="_blank" rel="noopener noreferrer"
          style={{
            position: 'absolute', top: 32, left: 48, zIndex: 30,
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 11, fontWeight: 500,
            animation: 'mhFade .5s ease 1.2s both',
          }}
        >
          <InstagramSVG />
          <span>{instagramHandle.startsWith('@') ? instagramHandle : `@${instagramHandle}`}</span>
        </a>
      )}

      {/* Footer direito — localização */}
      <div className="mh-loc" style={{ position: 'absolute', bottom: 28, right: 48, zIndex: 30, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', animation: 'mhFade .5s ease 1.3s both' }}>
        {locationText}
      </div>
    </div>
  )
}
