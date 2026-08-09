import './globals.css';
import type { Metadata } from 'next';
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
      <body>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
