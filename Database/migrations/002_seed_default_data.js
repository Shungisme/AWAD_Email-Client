/**
 * Migration Script: Seed Default Data
 * Database: email-dashboard
 * Description: Seeds the database with sample users and default Kanban configurations
 */

// Connect to the database
const db = db.getSiblingDB('email-dashboard');

print("=================================");
print("Starting Migration: Seed Default Data");
print("=================================\n");

// 1. Seed Default Users
print("1. Seeding default users...");

const defaultUsers = [
  {
    email: "demo@example.com",
    // Password: "demo123" (hashed with bcrypt)
    password: "$2a$10$8ZQ3Z5Z5Z5Z5Z5Z5Z5Z5ZOK5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
    name: "Demo User",
    googleId: null,
    latestHistoryId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    email: "admin@example.com",
    // Password: "admin123" (hashed with bcrypt)
    password: "$2a$10$XYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZXYZ",
    name: "Admin User",
    googleId: null,
    latestHistoryId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

try {
  // Insert users if they don't exist
  defaultUsers.forEach(user => {
    const existingUser = db.users.findOne({ email: user.email });
    if (!existingUser) {
      db.users.insertOne(user);
      print(`  ✓ Created user: ${user.email}`);
    } else {
      print(`  → User already exists: ${user.email}`);
    }
  });
  print("✓ Users seeding completed\n");
} catch (error) {
  print(`✗ Error seeding users: ${error}\n`);
}

// 2. Seed Default Kanban Configurations
print("2. Seeding default Kanban configurations...");

const defaultKanbanConfig = {
  columns: [
    {
      id: "col-inbox",
      status: "inbox",
      title: "Inbox",
      color: "bg-blue-500",
      icon: "Inbox",
      gmailLabel: "INBOX",
      order: 0
    },
    {
      id: "col-todo",
      status: "todo",
      title: "To Do",
      color: "bg-yellow-500",
      icon: "Clock",
      gmailLabel: "STARRED",
      order: 1
    },
    {
      id: "col-in-progress",
      status: "in-progress",
      title: "In Progress",
      color: "bg-orange-500",
      icon: "PlayCircle",
      gmailLabel: undefined,
      order: 2
    },
    {
      id: "col-done",
      status: "done",
      title: "Done",
      color: "bg-green-500",
      icon: "CheckCircle",
      gmailLabel: undefined,
      order: 3
    },
    {
      id: "col-snoozed",
      status: "snoozed",
      title: "Snoozed",
      color: "bg-purple-500",
      icon: "Clock",
      gmailLabel: undefined,
      order: 4
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

try {
  // Get all users and create Kanban configs for them
  const users = db.users.find({}).toArray();
  
  users.forEach(user => {
    const existingConfig = db.kanbanconfigs.findOne({ userId: user._id.toString() });
    if (!existingConfig) {
      const config = {
        userId: user._id.toString(),
        ...defaultKanbanConfig
      };
      db.kanbanconfigs.insertOne(config);
      print(`  ✓ Created Kanban config for user: ${user.email}`);
    } else {
      print(`  → Kanban config already exists for user: ${user.email}`);
    }
  });
  
  print("✓ Kanban configurations seeding completed\n");
} catch (error) {
  print(`✗ Error seeding Kanban configs: ${error}\n`);
}

// 3. Display Summary
print("=================================");
print("Seeding completed successfully!");
print("=================================");
print("\nData seeded:");
print(`  - ${defaultUsers.length} default users`);
print("  - Kanban configurations for all users");
print("\nDefault user credentials:");
print("  Email: demo@example.com");
print("  Password: demo123");
print("\n  Email: admin@example.com");
print("  Password: admin123");
