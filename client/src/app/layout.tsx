import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { RoleProvider } from '@/lib/role-context';
import { AppShell } from '@/components/app-shell';

// The reference design's typeface is a humanist geometric sans with open
// counters and a tall x-height — Plus Jakarta Sans is the closest thing with
// a licence we can ship. Loaded as a CSS variable so Tailwind's `font-sans`
// resolves to it everywhere (see tailwind.config.ts).
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Rophe Specialist Care',
  description: 'Patient engagement & appointment platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      {/* Browser extensions (ColorZilla, Grammarly, password managers) add
          attributes to <body> before React hydrates, which reads as a
          mismatch. Suppress it here — this applies one level deep, to this
          element's own attributes only, so real mismatches inside the app
          are still reported. */}
      <body suppressHydrationWarning className="font-sans antialiased">
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
        {/* Simulated message confirmations surface here (PRD Section 6). */}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
