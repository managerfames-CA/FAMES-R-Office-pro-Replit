export const todayIso = (): string => new Date().toISOString().slice(0, 10);
export const nowIso = (): string => new Date().toISOString();
export const isPastDue = (dueDate: string, completed = false): boolean => Boolean(dueDate) && !completed && dueDate < todayIso();
export const isUpcoming = (dueDate: string, days: number, completed = false): boolean => {
  if (!dueDate || completed) return false;
  const today = new Date(`${todayIso()}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  const delta = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return delta >= 0 && delta <= days;
};
export const formatDate = (value: string): string => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : '—';
export const formatDateTime = (value: string): string => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
