import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'supervisor', 'empleado'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  ipAddress: text('ip_address'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  caseNumber: text('case_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerDni: text('customer_dni'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  createdBy: text('created_by').references(() => users.id),
  assignedTo: text('assigned_to').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const caseActivities = sqliteTable('case_activities', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  userId: text('user_id').references(() => users.id),
  authorLabel: text('author_label').notNull(),
  type: text('type', { enum: ['comment', 'status_change', 'assignment'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'in_progress', 'resolved', 'cancelled'] }).notNull().default('pending'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  visibility: text('visibility', { enum: ['all', 'roles', 'users'] }).notNull().default('all'),
  visibilityData: text('visibility_data'),
  assignedTo: text('assigned_to').references(() => users.id),
  createdBy: text('created_by').references(() => users.id),
  dueDate: integer('due_date'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const taskActivities = sqliteTable('task_activities', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  userId: text('user_id').references(() => users.id),
  fieldChanged: text('field_changed').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: integer('created_at').notNull(),
})

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  url: text('url').notNull(),
  category: text('category'),
  tags: text('tags').notNull().default('[]'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const vaultEntries = sqliteTable('vault_entries', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  username: text('username'),
  encryptedValue: text('encrypted_value').notNull(),
  iv: text('iv').notNull(),
  notes: text('notes'),
  visibility: text('visibility', { enum: ['all', 'roles', 'users'] }).notNull().default('all'),
  visibilityData: text('visibility_data'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  username: text('username').notNull(),
  ipAddress: text('ip_address'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
