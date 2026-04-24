import type {
  UserRow,
  ClientRow,
  TaskRow,
  AttendanceRow,
  WorkLogRow,
  InvoiceRow,
  NotificationRow,
} from "@workspace/db";

function isoOrNull(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function dateStrOrNull(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}

export function serializeAuthUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    position: u.position,
    phone: u.phone,
    department: u.department,
    avatarUrl: u.avatarUrl,
  };
}

export function serializeStaff(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    position: u.position,
    phone: u.phone,
    department: u.department,
    avatarUrl: u.avatarUrl,
    joinedAt: dateStrOrNull(u.joinedAt),
    createdAt: u.createdAt.toISOString(),
  };
}

export function serializeClient(c: ClientRow) {
  return {
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    address: c.address,
    status: c.status,
    notes: c.notes,
    contactPerson: c.contactPerson,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeTask(
  t: TaskRow,
  opts: { assigneeName?: string | null; clientName?: string | null } = {},
) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    assigneeName: opts.assigneeName ?? null,
    clientId: t.clientId,
    clientName: opts.clientName ?? null,
    dueDate: dateStrOrNull(t.dueDate),
    createdById: t.createdById,
    createdAt: t.createdAt.toISOString(),
    completedAt: isoOrNull(t.completedAt),
  };
}

export function serializeAttendance(
  a: AttendanceRow,
  opts: { staffName: string },
) {
  let hoursWorked: number | null = null;
  if (a.checkIn && a.checkOut) {
    hoursWorked = Math.round(
      (a.checkOut.getTime() - a.checkIn.getTime()) / 360000,
    ) / 10;
  }
  return {
    id: a.id,
    staffId: a.staffId,
    staffName: opts.staffName,
    date: dateStrOrNull(a.date)!,
    checkIn: isoOrNull(a.checkIn),
    checkOut: isoOrNull(a.checkOut),
    status: a.status,
    notes: a.notes,
    hoursWorked,
  };
}

export function serializeWorkLog(
  w: WorkLogRow,
  opts: { staffName: string; taskTitle?: string | null },
) {
  return {
    id: w.id,
    staffId: w.staffId,
    staffName: opts.staffName,
    taskId: w.taskId,
    taskTitle: opts.taskTitle ?? null,
    date: dateStrOrNull(w.date)!,
    summary: w.summary,
    hours: w.hours == null ? null : Number(w.hours),
    status: w.status,
    createdAt: w.createdAt.toISOString(),
  };
}

export function serializeInvoice(
  i: InvoiceRow,
  opts: { clientName: string },
) {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    clientName: opts.clientName,
    status: i.status,
    items: i.items ?? [],
    subtotal: Number(i.subtotal),
    tax: Number(i.tax),
    total: Number(i.total),
    issueDate: dateStrOrNull(i.issueDate)!,
    dueDate: dateStrOrNull(i.dueDate),
    paidAt: isoOrNull(i.paidAt),
    notes: i.notes,
    createdAt: i.createdAt.toISOString(),
  };
}

export function serializeNotification(n: NotificationRow) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
  };
}
