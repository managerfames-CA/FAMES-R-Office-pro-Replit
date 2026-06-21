import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface AppContextValue {
  revision: number;
  notifyDataChanged: () => void;
  toast: { message: string; type: 'success' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [toast, setToast] = useState<AppContextValue['toast']>(null);
  const value = useMemo<AppContextValue>(() => ({
    revision,
    notifyDataChanged: () => setRevision(value => value + 1),
    toast,
    showToast: (message, type = 'success') => {
      setToast({ message, type });
      window.setTimeout(() => setToast(null), 3500);
    }
  }), [revision, toast]);
  return <AppContext.Provider value={value}>{children}{toast && <div className={`toast toast-${toast.type}`} role="status">{toast.message}</div>}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider is missing.');
  return context;
}
