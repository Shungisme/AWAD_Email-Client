# Database Folder - Email Client Application

This folder contains all database-related files including migration scripts and sample data for the Email Client application.

## 📁 Structure

```
Database/
├── migrations/                  # Migration scripts for database structure
│   ├── 001_create_collections.js    # Creates collections and indexes
│   └── 002_seed_default_data.js     # Seeds default users and configs
├── seed-data/                   # Sample data files (JSON format)
│   ├── users.json              # Sample user records
│   ├── emails.json             # Sample email records
│   └── kanbanconfigs.json      # Sample Kanban board configurations
└── README.md                    # This file
```

## 🗄️ Database Information

- **Database Type**: MongoDB
- **Database Name**: `email-dashboard`
- **ORM**: Mongoose
- **Connection String**: `mongodb://localhost:27017/email-dashboard` (default)

## 📊 Collections Schema

### 1. Users Collection
Stores user account information.

**Fields:**
- `email` (String, Required, Unique) - User's email address
- `password` (String, Optional) - Hashed password (optional for OAuth users)
- `name` (String, Required) - User's display name
- `googleId` (String, Optional) - Google OAuth ID
- `latestHistoryId` (String, Optional) - Gmail API history ID for sync
- `createdAt` (Date) - Account creation timestamp
- `updatedAt` (Date) - Last update timestamp

**Indexes:**
- `email` (Unique)
- `googleId` (Unique, Sparse)

### 2. Emails Collection
Stores email messages with Gmail integration.

**Fields:**
- `emailId` (String, Required) - Gmail message ID
- `threadId` (String) - Gmail thread ID
- `userId` (String, Required) - Owner user ID
- `subject` (String, Required) - Email subject
- `from` (Object, Required) - Sender information
- `to` (Array, Required) - Recipients
- `cc` (Array) - CC recipients
- `body` (String, Required) - Email body content
- `bodySnippet` (String) - Preview text
- `timestamp` (Date, Required) - Send/receive timestamp
- `attachments` (Array) - File attachments
- `labels` (Array, Required) - Gmail labels
- `mailboxId` (String) - Mailbox/folder ID
- `status` (String, Required) - Kanban workflow status
- `snoozeUntil` (Date) - Snooze timestamp
- `isRead` (Boolean, Required) - Read status
- `isStarred` (Boolean, Required) - Starred status
- `embedding` (Array) - Vector embedding for semantic search
- `embeddingModel` (String) - Model used for embedding
- `embeddingDim` (Number) - Embedding dimension
- `embeddingCreatedAt` (Date) - Embedding generation timestamp
- `createdAt` (Date) - Record creation timestamp
- `updatedAt` (Date) - Last update timestamp

**Indexes:**
- `emailId`
- `userId`
- `userId + timestamp` (Compound)
- `userId + status` (Compound)
- `userId + labels` (Compound)
- `userId + isStarred` (Compound)
- `snoozeUntil` (Sparse)

### 3. Kanban Configs Collection
Stores user-specific Kanban board configurations.

**Fields:**
- `userId` (String, Required, Unique) - User ID
- `columns` (Array, Required) - Kanban column definitions
  - `id` (String) - Column ID
  - `status` (String) - Semantic identifier
  - `title` (String) - Display title
  - `color` (String) - Tailwind color class
  - `icon` (String) - Lucide-react icon name
  - `gmailLabel` (String) - Gmail label mapping
  - `order` (Number) - Display order
- `createdAt` (Date) - Configuration creation timestamp
- `updatedAt` (Date) - Last update timestamp

**Indexes:**
- `userId` (Unique)

## 🚀 How to Import the Migration Script

### Prerequisites

1. **Install MongoDB**:
   - Download from: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

2. **Start MongoDB Service**:
   ```bash
   # Windows
   net start MongoDB
   
   # Linux/Mac
   sudo systemctl start mongod
   # or
   brew services start mongodb-community
   ```

3. **Verify MongoDB is Running**:
   ```bash
   mongosh --version
   ```

### Method 1: Using MongoDB Shell (mongosh)

#### Step 1: Create Collections and Indexes

```bash
# Navigate to the Database folder
cd Database/migrations

# Run the migration script
mongosh mongodb://localhost:27017 001_create_collections.js
```

#### Step 2: Seed Default Data

```bash
mongosh mongodb://localhost:27017 002_seed_default_data.js
```

### Method 2: Import Sample Data (Optional)

If you want to import the sample data files directly:

```bash
# Navigate to Database folder
cd Database

# Import users
mongoimport --db email-dashboard --collection users --file seed-data/users.json --jsonArray

# Import emails
mongoimport --db email-dashboard --collection emails --file seed-data/emails.json --jsonArray

# Import Kanban configs
mongoimport --db email-dashboard --collection kanbanconfigs --file seed-data/kanbanconfigs.json --jsonArray
```

### Method 3: Using Docker Compose

If the application is running with Docker Compose:

```bash
# Start the services
docker-compose up -d

# Access MongoDB container
docker-compose exec mongo mongosh email-dashboard

# In mongosh, load and run migration scripts
load('/docker-entrypoint-initdb.d/001_create_collections.js')
load('/docker-entrypoint-initdb.d/002_seed_default_data.js')
```

### Method 4: Using Studio 3T or MongoDB Compass (GUI)

1. **Download MongoDB Compass**: https://www.mongodb.com/try/download/compass
2. **Connect** to `mongodb://localhost:27017`
3. **Create database** named `email-dashboard`
4. **Import collections**:
   - Go to Collection → Import Data
   - Select JSON files from `seed-data/` folder
   - Import each file to its respective collection

## ✅ Verify Installation

After running the migration scripts, verify the installation:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/email-dashboard

# Check collections
show collections

# Count documents in each collection
db.users.countDocuments()
db.emails.countDocuments()
db.kanbanconfigs.countDocuments()

# View indexes
db.users.getIndexes()
db.emails.getIndexes()
db.kanbanconfigs.getIndexes()

# View sample data
db.users.findOne()
db.emails.findOne()
db.kanbanconfigs.findOne()
```

Expected output:
- 3 collections: `users`, `emails`, `kanbanconfigs`
- At least 2 users (demo and admin)
- Sample emails for demo user
- Kanban configurations for each user

## 🔑 Default Credentials

After seeding, you can login with:

**Demo Account:**
- Email: `demo@example.com`
- Password: `demo123`

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

## 🔄 Reset Database

To reset the database and start fresh:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017

# Drop the entire database
use email-dashboard
db.dropDatabase()

# Re-run migration scripts
exit
mongosh mongodb://localhost:27017 001_create_collections.js
mongosh mongodb://localhost:27017 002_seed_default_data.js
```

## 🛠️ Troubleshooting

### Issue: Connection Failed

**Solution:**
- Verify MongoDB service is running: `mongosh --version`
- Check connection string in `.env` file
- For MongoDB Atlas, use connection string from Atlas dashboard

### Issue: Collection Already Exists

**Solution:**
- This is normal if you've run migrations before
- To recreate: Drop database and re-run migrations

### Issue: Import Errors with mongoimport

**Solution:**
- Ensure MongoDB tools are installed: https://www.mongodb.com/try/download/database-tools
- Use `--jsonArray` flag for array-based JSON files
- Check file paths are correct

### Issue: Index Creation Errors

**Solution:**
- Drop existing indexes: `db.collection.dropIndexes()`
- Re-run migration script

## 📝 Notes

1. **Password Hashing**: The passwords in sample data are placeholders. The actual application uses bcrypt with salt rounds of 10.

2. **ObjectId vs String**: The sample data uses string IDs for readability. MongoDB will automatically convert `_id` fields to ObjectId format during import.

3. **Timestamps**: All timestamps use ISO 8601 format (UTC timezone).

4. **Gmail Integration**: For full functionality, configure Gmail OAuth credentials in `.env` file.

5. **Semantic Search**: The `embedding` fields are optional and populated when using AI features.

## 🔗 Related Documentation

- [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Compass](https://www.mongodb.com/products/compass)
- [mongosh Reference](https://docs.mongodb.com/mongodb-shell/)

## 📧 Support

If you encounter any issues with database setup, please contact the development team or refer to the main project README.md.
