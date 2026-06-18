import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export function AuthButton() {
  const { user, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors font-medium"
        >
          <span className="w-5 h-5 rounded-full bg-blue-500/40 text-blue-300 flex items-center justify-center text-[10px] font-bold">
            {(user.displayName ?? user.email)[0].toUpperCase()}
          </span>
          <span className="hidden sm:block max-w-[80px] truncate">
            {user.displayName ?? user.email.split('@')[0]}
          </span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-[#0f1f3d] border border-white/15 rounded-xl shadow-xl py-1 min-w-[140px]">
              <p className="px-3 py-1.5 text-xs text-white/35 truncate">{user.email}</p>
              <hr className="border-white/8 my-1" />
              <button
                onClick={() => { logout(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors font-medium"
      >
        Sign in
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
