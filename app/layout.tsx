import './globals.css';
import { Providers } from '@/components/providers';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DC Deal Screener',
  description: 'Evidence-first data center deal screening for funds',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen">
            <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center font-bold">
                    DC
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">DC Deal Screener</p>
                    <p className="text-sm text-slate-500">Evidence-led underwriting</p>
                  </div>
                </div>
                <div className="text-sm text-slate-600">Investor workspace</div>
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
