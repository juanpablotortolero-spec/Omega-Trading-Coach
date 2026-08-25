import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const REMEMBER_FLAG = 'pat_remember_me';

/**
 * Reads from whichever storage actually holds the session (localStorage wins
 * if present, since that's where "remembered" sessions — and any session
 * created before this flag existed — live). Writes go to localStorage only
 * when the user opted in via the login form's "Recuérdame" checkbox;
 * otherwise the session is written to sessionStorage and cleared when the
 * browser/tab closes.
 */
const rememberAwareStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    const remembered = localStorage.getItem(REMEMBER_FLAG) === 'true';
    if (remembered) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: rememberAwareStorage,
  },
});
