import {
  db,
  usersTable,
  clientsTable,
  tasksTable,
  attendanceTable,
  workLogsTable,
  invoicesTable,
  notificationsTable,
} from "@workspace/db";
import { hashPassword } from "./lib/auth";

async function main() {
  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    console.log("Database already seeded; skipping.");
    return;
  }

  console.log("Seeding users...");
  const users = await db
    .insert(usersTable)
    .values([
      {
        email: "admin@office.app",
        name: "Aria Admin",
        role: "admin",
        passwordHash: hashPassword("admin123"),
        position: "Office Manager",
        department: "Operations",
        phone: "+1 (415) 555-0100",
        joinedAt: "2024-01-15",
        status: "active",
      },
      {
        email: "alex@office.app",
        name: "Alex Chen",
        role: "staff",
        passwordHash: hashPassword("staff123"),
        position: "Account Executive",
        department: "Sales",
        phone: "+1 (415) 555-0101",
        joinedAt: "2024-03-01",
        status: "active",
      },
      {
        email: "morgan@office.app",
        name: "Morgan Lee",
        role: "staff",
        passwordHash: hashPassword("staff123"),
        position: "Project Coordinator",
        department: "Delivery",
        phone: "+1 (415) 555-0102",
        joinedAt: "2024-05-12",
        status: "active",
      },
      {
        email: "sam@office.app",
        name: "Sam Patel",
        role: "staff",
        passwordHash: hashPassword("staff123"),
        position: "Support Specialist",
        department: "Customer Success",
        phone: "+1 (415) 555-0103",
        joinedAt: "2024-09-20",
        status: "active",
      },
      {
        email: "jamie@office.app",
        name: "Jamie Rivera",
        role: "staff",
        passwordHash: hashPassword("staff123"),
        position: "Designer",
        department: "Creative",
        phone: "+1 (415) 555-0104",
        joinedAt: "2025-02-10",
        status: "active",
      },
    ])
    .returning();
  const [admin, alex, morgan, sam, jamie] = users;

  console.log("Seeding clients...");
  const clients = await db
    .insert(clientsTable)
    .values([
      {
        name: "Northwind Logistics",
        company: "Northwind Logistics LLC",
        contactPerson: "Riley Thompson",
        email: "riley@northwind.example",
        phone: "+1 (415) 555-0201",
        address: "120 Harbor St, Seattle, WA",
        status: "active",
        notes: "Quarterly retainer; prefers Monday morning calls.",
      },
      {
        name: "Sunrise Health",
        company: "Sunrise Health Group",
        contactPerson: "Dana Park",
        email: "dana@sunrise.example",
        phone: "+1 (415) 555-0202",
        address: "455 Wellness Way, Austin, TX",
        status: "active",
        notes: "HIPAA-conscious. All comms via secure portal.",
      },
      {
        name: "Pinecrest Realty",
        company: "Pinecrest Realty Co",
        contactPerson: "Jordan Lee",
        email: "jordan@pinecrest.example",
        phone: "+1 (415) 555-0203",
        address: "78 Forest Ave, Denver, CO",
        status: "active",
        notes: "Seasonal campaigns Q1 and Q3.",
      },
      {
        name: "Bluebird Foods",
        company: "Bluebird Foods Inc",
        contactPerson: "Casey Singh",
        email: "casey@bluebird.example",
        phone: "+1 (415) 555-0204",
        address: "9 Market Lane, Brooklyn, NY",
        status: "prospect",
        notes: "Pitch deck delivered; awaiting decision.",
      },
      {
        name: "Tidepool Studios",
        company: "Tidepool Studios",
        contactPerson: "Robin Hayes",
        email: "robin@tidepool.example",
        phone: "+1 (415) 555-0205",
        address: "32 Ocean Blvd, San Diego, CA",
        status: "inactive",
        notes: "Project paused — contract ended Dec 2025.",
      },
    ])
    .returning();
  const [northwind, sunrise, pinecrest, bluebird] = clients;

  console.log("Seeding tasks...");
  const today = new Date();
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await db.insert(tasksTable).values([
    {
      title: "Prepare Q2 onboarding deck for Northwind",
      description: "Slides covering kickoff, milestones and SLA.",
      status: "in_progress",
      priority: "high",
      assigneeId: alex!.id,
      clientId: northwind!.id,
      dueDate: addDays(2),
      createdById: admin!.id,
    },
    {
      title: "Schedule weekly status call with Sunrise",
      description: "Recurring Tuesday 10am.",
      status: "todo",
      priority: "medium",
      assigneeId: morgan!.id,
      clientId: sunrise!.id,
      dueDate: addDays(0),
      createdById: admin!.id,
    },
    {
      title: "Audit Pinecrest landing page copy",
      description: "Match the new brand voice guide.",
      status: "todo",
      priority: "medium",
      assigneeId: jamie!.id,
      clientId: pinecrest!.id,
      dueDate: addDays(5),
      createdById: admin!.id,
    },
    {
      title: "Reply to Bluebird discovery questions",
      description: "Detailed answers to RFP follow-up.",
      status: "review",
      priority: "high",
      assigneeId: alex!.id,
      clientId: bluebird!.id,
      dueDate: addDays(1),
      createdById: admin!.id,
    },
    {
      title: "Update internal expense policy doc",
      description: "Reflect new per-diem rates.",
      status: "todo",
      priority: "low",
      assigneeId: admin!.id,
      clientId: null,
      dueDate: addDays(7),
      createdById: admin!.id,
    },
    {
      title: "Send March recap to Northwind",
      description: "Hours, deliverables and next steps.",
      status: "done",
      priority: "medium",
      assigneeId: morgan!.id,
      clientId: northwind!.id,
      dueDate: addDays(-5),
      createdById: admin!.id,
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
    },
    {
      title: "Triage Sunrise support tickets",
      description: "Clear backlog before Friday.",
      status: "in_progress",
      priority: "high",
      assigneeId: sam!.id,
      clientId: sunrise!.id,
      dueDate: addDays(3),
      createdById: admin!.id,
    },
    {
      title: "Refresh Pinecrest social calendar",
      description: "Plan the next 4 weeks of posts.",
      status: "todo",
      priority: "low",
      assigneeId: jamie!.id,
      clientId: pinecrest!.id,
      dueDate: addDays(10),
      createdById: admin!.id,
    },
  ]);

  console.log("Seeding attendance...");
  const attRows: typeof attendanceTable.$inferInsert[] = [];
  const staffIds = [admin!.id, alex!.id, morgan!.id, sam!.id, jamie!.id];
  for (let i = 6; i >= 1; i--) {
    const date = addDays(-i);
    for (const sid of staffIds) {
      // Skip Saturdays/Sundays for variety
      const dow = new Date(date).getDay();
      if (dow === 0 || dow === 6) continue;
      const checkIn = new Date(date + "T09:00:00Z");
      const checkOut = new Date(date + "T17:30:00Z");
      attRows.push({
        staffId: sid,
        date,
        checkIn,
        checkOut,
        status: "present",
      });
    }
  }
  if (attRows.length) await db.insert(attendanceTable).values(attRows);

  console.log("Seeding work logs...");
  await db.insert(workLogsTable).values([
    {
      staffId: alex!.id,
      taskId: null,
      date: addDays(-1),
      summary: "Prepped Northwind kickoff deck — sections 1 and 2.",
      hours: "3.5",
      status: "in_progress",
    },
    {
      staffId: morgan!.id,
      taskId: null,
      date: addDays(-1),
      summary: "Confirmed Sunrise call agenda; circulated invites.",
      hours: "1.0",
      status: "completed",
    },
    {
      staffId: sam!.id,
      taskId: null,
      date: addDays(-2),
      summary: "Closed 12 Sunrise support tickets; escalated 1.",
      hours: "5.0",
      status: "completed",
    },
    {
      staffId: jamie!.id,
      taskId: null,
      date: addDays(-2),
      summary: "Drafted Pinecrest landing page copy revisions v1.",
      hours: "2.5",
      status: "in_progress",
    },
  ]);

  console.log("Seeding invoices...");
  await db.insert(invoicesTable).values([
    {
      invoiceNumber: "INV-2026-0001",
      clientId: northwind!.id,
      status: "paid",
      items: [
        { description: "Q1 retainer — Strategy", quantity: 1, unitPrice: 4500 },
        { description: "Onboarding workshop", quantity: 1, unitPrice: 1200 },
      ],
      subtotal: "5700.00",
      tax: "456.00",
      total: "6156.00",
      issueDate: addDays(-30),
      dueDate: addDays(-15),
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      notes: "Thanks for your prompt payment.",
    },
    {
      invoiceNumber: "INV-2026-0002",
      clientId: sunrise!.id,
      status: "sent",
      items: [
        { description: "Support hours — March", quantity: 25, unitPrice: 95 },
      ],
      subtotal: "2375.00",
      tax: "190.00",
      total: "2565.00",
      issueDate: addDays(-10),
      dueDate: addDays(20),
    },
    {
      invoiceNumber: "INV-2026-0003",
      clientId: pinecrest!.id,
      status: "draft",
      items: [
        { description: "Brand refresh — Phase 1", quantity: 1, unitPrice: 3200 },
      ],
      subtotal: "3200.00",
      tax: "256.00",
      total: "3456.00",
      issueDate: addDays(0),
      dueDate: addDays(30),
    },
    {
      invoiceNumber: "INV-2026-0004",
      clientId: northwind!.id,
      status: "overdue",
      items: [
        { description: "Out-of-scope analytics work", quantity: 8, unitPrice: 110 },
      ],
      subtotal: "880.00",
      tax: "70.40",
      total: "950.40",
      issueDate: addDays(-45),
      dueDate: addDays(-15),
    },
  ]);

  console.log("Seeding notifications...");
  await db.insert(notificationsTable).values([
    {
      userId: admin!.id,
      title: "Invoice overdue",
      message: "INV-2026-0004 for Northwind is overdue by 15 days.",
      type: "invoice",
      link: "/invoices",
    },
    {
      userId: admin!.id,
      title: "New work log",
      message: "Sam Patel posted an update on Sunrise tickets.",
      type: "work_log",
    },
    {
      userId: alex!.id,
      title: "Task due tomorrow",
      message: "Reply to Bluebird discovery questions is due soon.",
      type: "task",
      link: "/tasks",
    },
    {
      userId: alex!.id,
      title: "Welcome to Office Control",
      message: "Your account is set up — explore the dashboard to get started.",
      type: "system",
      read: true,
    },
  ]);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
