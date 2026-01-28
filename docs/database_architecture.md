# Supabase Database Architecture Documentation

## 1. System Overview

**Project Name**: Flash Flow SaaS
**Database Engine**: PostgreSQL 15+ (Supabase Managed)
**Generated At**: 2026-01-26

### 1.1 Installed Extensions
| Extension | Version | Description |
|-----------|---------|-------------|
| `plpgsql` | 1.0 | PL/pgSQL procedural language |
| `vector` | 0.8.0 | Vector data type and ivfflat access method |
| `pg_graphql` | 1.5.11 | GraphQL support |
| `pg_stat_statements` | 1.11 | Track planning and execution statistics |
| `pgcrypto` | 1.3 | Cryptographic functions |
| `supabase_vault` | 0.3.1 | Supabase Vault for secrets |
| `uuid-ossp` | 1.1 | UUID generation |

---

## 2. Storage Architecture

### 2.1 Storage Buckets
| Bucket ID | Public | File Size Limit | MIME Types |
|-----------|--------|-----------------|------------|
| `user-avatars` | Yes | Unlimited | All |
| `flow-icons` | Yes | Unlimited | All |
| `workflow-uploads` | Yes | Unlimited | All |
| `flow-files` | Yes | Unlimited | All |
| `generated-images` | Yes | Unlimited | All |

### 2.2 Storage Policies (RLS)
- **workflow-uploads**: Public read/write/update.
- **user-avatars**: Public read. Authenticated users can update/upload their own avatars (folder-based isolation).
- **flow-icons**: Public read. Authenticated users can upload/update.
- **flow-files**: Public read. Authenticated users can upload.

---

## 3. Database Schema (Public)

### 3.1 Core Tables

#### `flows`
Stores the core workflow definitions.
- **PK**: `id` (uuid)
- **FK**: `owner_id` -> `auth.users.id` (CASCADE)
- **RLS**: Users can CRUD their own flows.

#### `flow_executions`
Logs execution history of workflows.
- **PK**: `id` (uuid)
- **FK**: `user_id` -> `auth.users.id` (CASCADE)
- **FK**: `flow_id` -> `flows.id`
- **RLS**: Users can insert/view their own executions.

#### `chat_history`
Stores chat messages for flow interactions.
- **PK**: `id` (uuid)
- **FK**: `flow_id` -> `flows.id` (CASCADE)
- **RLS**: Users can CRUD history for flows they own.

### 3.2 User Management

#### `user_profiles`
Extended user profile data.
- **PK**: `id` (uuid)
- **FK**: `user_id` -> `auth.users.id` (Unique, CASCADE)
- **RLS**: Users can CRUD their own profile.

#### `users_quota`
Tracks usage limits and consumption.
- **PK**: `id` (uuid)
- **FK**: `user_id` -> `auth.users.id` (Unique, CASCADE)
- **RLS**: Users can view/update their own quota.

#### `points_ledger`
Transaction log for user points/credits.
- **PK**: `id` (uuid)
- **FK**: `user_id` -> `auth.users.id`
- **RLS**: Users can insert/view their own ledger entries.

### 3.3 AI & Knowledge

#### `agent_docs`
Vector store for RAG (Retrieval-Augmented Generation).
- **PK**: `id` (uuid)
- **Column**: `embedding` (vector)
- **Index**: HNSW on `embedding`
- **RLS**: Public read access.

#### `knowledge_files`
User-uploaded knowledge base files.
- **PK**: `id` (uuid)
- **FK**: `user_id` -> `auth.users.id` (CASCADE)
- **RLS**: Users can CRUD their own files.

#### `llm_node_memory`
Long-term memory for LLM nodes within flows.
- **PK**: `id` (uuid)
- **FK**: `flow_id` -> `flows.id`
- **RLS**: Access controlled via flow ownership.

### 3.4 Configuration

#### `llm_models`
Registry of available LLM models.
- **PK**: `id` (uuid)
- **RLS**: Public read.

#### `image_gen_models`
Registry of available image generation models.
- **PK**: `id` (uuid)
- **RLS**: Public read.

---

## 4. Business Logic (Functions & Triggers)

### 4.1 Auth Hooks
- **Trigger**: `on_auth_user_created` on `auth.users` (AFTER INSERT)
- **Function**: `handle_new_user()`
    - Automatically creates a `users_quota` record for new users.
    - Sets default limits: 50 LLM execs, 20 Flow gens, 100 Points.

### 4.2 Utility Functions
- `match_agent_docs`: Performs vector similarity search on `agent_docs`.
- `check_and_increment_quota`: Atomic check-and-update for user quotas using `FOR UPDATE` locking.
- `get_quota_status`: Read-only quota check.
- `current_user_id`: Wrapper for `auth.uid()`.

### 4.3 Maintenance Triggers
- `update_updated_at_column`: Automatically updates `updated_at` timestamp on modification (applied to `flows`, `users_quota`, etc.).

---

## 5. Security Model

### 5.1 Row Level Security (RLS)
- **Enabled**: All public tables have RLS enabled.
- **Pattern**: Most policies use `user_id = (select auth.uid())` for ownership verification.
- **Performance**: Recent optimization replaced `auth.uid()` with subquery for better caching.

### 5.2 Foreign Keys
- **Cascade Deletion**: All user-related data (`flows`, `files`, `logs`) is configured to cascadingly delete when the user is deleted from `auth.users`.
