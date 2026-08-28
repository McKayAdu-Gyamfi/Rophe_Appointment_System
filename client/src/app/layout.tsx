import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { RoleProvider } from '@/lib/role-context';
import { AppShell } from '@/components/app-shell';

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
    <html lang="en">
      {/* Browser extensions (ColorZilla, Grammarly, password managers) add
          attributes to <body> before React hydrates, which reads as a
          mismatch. Suppress it here — this applies one level deep, to this
          element's own attributes only, so real mismatches inside the app
          are still reported. */}
      <body suppressHydrationWarning>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
        {/* Simulated message confirmations surface here (PRD Section 6). */}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
