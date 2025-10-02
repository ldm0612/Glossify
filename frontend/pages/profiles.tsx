import React, { useEffect, useRef, useState } from 'react';
import { createUser, listUsers } from '../lib/api';

export default function Profiles() {
  const [users, setUsers] = useState<Array<{ id: string; name: string; avatar_url?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { users } = await listUsers();
        setUsers(users || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleSelect = (id: string) => {
    localStorage.setItem('glossify_active_user', id);
    window.location.href = '/';
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setCreating(true);
      const u = await createUser(name.trim());
      setUsers((prev) => [...prev, u]);
      localStorage.setItem('glossify_active_user', u.id);
      window.location.href = '/';
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Glossify!</h1>
          <p className="text-gray-600 mt-1">choose or create your account</p>
        </div>
        {loading ? (
          <div className="text-center text-gray-600">Loading…</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {users.map((u) => (
              <button
                key={u.id}
                className="w-40 h-40 rounded-lg bg-white shadow hover:shadow-md transition flex items-center justify-center border border-gray-200"
                onClick={() => handleSelect(u.id)}
                title={u.name}
              >
                <span className="text-lg font-medium text-gray-800">{u.name}</span>
              </button>
            ))}
            <div className="w-40 h-40 rounded-lg bg-white/70 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-white transition" onClick={() => { setShowCreate(true); setTimeout(() => inputRef.current?.focus(), 0); }}>
              <div className="text-center">
                <div className="text-3xl text-gray-500">+</div>
                <div className="text-sm text-gray-600">Add Profile</div>
              </div>
            </div>
          </div>
        )}

        {/* Create user form (hidden until plus clicked) */}
        {showCreate && (
          <div className="max-w-md mx-auto mt-10 card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Profile</h2>
              <button className="text-sm text-gray-500 hover:underline" onClick={() => setShowCreate(false)}>Close</button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Profile name"
                className="w-full px-3 py-2 border rounded"
                value={name}
                ref={inputRef}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
