'use client';

import { FormEvent, useState } from 'react';

export default function OnboardingForm() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
      orgName: String(formData.get('orgName') || ''),
    };

    const res = await fetch('/api/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Bootstrap failed');
      return;
    }
    setSuccess('Admin created. You can now sign in.');
    setTimeout(() => {
      window.location.href = '/login';
    }, 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm text-slate-600">Organization name</label>
        <input name="orgName" required className="w-full" placeholder="My Fund" />
      </div>
      <div>
        <label className="text-sm text-slate-600">Admin email</label>
        <input name="email" type="email" required className="w-full" placeholder="you@example.com" />
      </div>
      <div>
        <label className="text-sm text-slate-600">Password</label>
        <input name="password" type="password" required className="w-full" minLength={12} />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-700">{success}</p>}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Creating…' : 'Create admin'}
      </button>
    </form>
  );
}
