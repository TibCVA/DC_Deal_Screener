import { hasUsers } from '@/lib/bootstrap';
import { redirect } from 'next/navigation';
import OnboardingForm from './ui/onboarding-form';

export default async function OnboardingPage() {
  const alreadyBootstrapped = await hasUsers();
  if (alreadyBootstrapped) {
    redirect('/login');
  }

  return (
    <div className="mx-auto mt-16 max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">Create your first admin</h1>
      <p className="text-sm text-slate-600">
        This page is only available on first run. Create the initial organization owner to continue to the workspace.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}
