import Image from 'next/image';
import icon from '@/app/icon.png';

/**
 * Shown when the deployment has no Admin credential. The link itself is fine,
 * so this deliberately does not read as "broken link" — that would send the
 * client hunting for a new URL that does not exist.
 */
export function PortalUnavailable() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-16 sm:px-8">
      <div className="flex items-center gap-3">
        <Image src={icon} alt="" width={32} height={32} aria-hidden="true" />
        <span className="virtara-display text-lg font-bold text-spaceText">Virtara</span>
      </div>

      <h1 className="virtara-display mt-10 text-3xl font-bold text-spaceText">
        This page is temporarily unavailable
      </h1>
      <p className="mt-3 max-w-prose text-spaceAlt">
        Your link is still valid — we&rsquo;re just unable to load your project right now. Please try
        again shortly, or reply to our last email and we&rsquo;ll send your update directly.
      </p>
    </main>
  );
}
