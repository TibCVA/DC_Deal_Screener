'use client';

import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const res = await signIn('credentials', { email, password, redirect: false });
    if (res?.error) {
      setError('Invalid credentials');
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="text-sm text-slate-500">Use your analyst credentials to access the workspace.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Email</label>
          <input name="email" type="email" required className="w-full" />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Password</label>
          <input name="password" type="password" required className="w-full" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>
      <p className="mt-3 text-xs text-slate-500">Contact your admin if you need access.</p>
    </div>
  );
}
