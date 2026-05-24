import React, { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase-browser';

export default function SetPassword() {
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return <p className="text-green-600">Password updated! You may now log in.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="password" className="block font-medium">New password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="border rounded p-2 w-full"
      />
      {error && <p className="text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {loading ? 'Setting…' : 'Set Password'}
      </button>
    </form>
  );
}
