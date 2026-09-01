# ☁️ Cloudly — Cloud File Driver

> A modern, secure, and responsive cloud file management platform built with React, TypeScript, and Supabase.

Cloudly is a full-featured cloud storage and file management application designed to provide a clean and intuitive experience for storing, organizing, accessing, and sharing files from anywhere.

The platform combines a modern Google Drive-inspired interface with secure cloud storage, user authentication, folder management, file sharing, favorites, recent activity, trash management, file previews, and responsive mobile support.

---

## ✨ Features

### 🔐 Authentication & User Accounts

* Secure user registration and login
* Session-based authentication
* User profile management
* Profile avatar support
* Password change functionality
* Secure logout
* Protected file access

### 📁 File & Folder Management

* Create folders and nested folder structures
* Upload multiple files
* Drag-and-drop file uploading
* Rename files and folders
* Move files between folders
* Download files
* File previews
* File type detection
* File size validation
* Storage usage tracking

### ☁️ Cloud Storage

Cloudly uses Supabase Storage to securely store uploaded files.

* Dedicated cloud storage bucket
* Unique storage paths for uploaded files
* File metadata stored separately
* File version tracking
* Storage usage calculation
* 100 MB maximum file upload limit
* Support for common document, image, video, audio, and code file types

### ⭐ Organization & Productivity

* Star important files and folders
* Recent files view
* Search files and folders
* Sort files alphabetically
* List and grid layouts
* Breadcrumb navigation
* Storage usage indicator

### 🤝 File Sharing

* Share files and folders with other users
* Shared-with-me workspace
* Permission-aware shared resources
* Public sharing support
* Shareable file links
* Owner information for shared resources

### 🗑️ Trash & Recovery

* Move files and folders to Trash
* Restore deleted items
* Permanently delete files
* Separate Trash workspace

### 📱 Responsive Experience

Cloudly is designed for desktop, tablet, and mobile devices.

* Responsive dashboard
* Mobile navigation
* Mobile-friendly file management
* Mobile file capture workflow
* Adaptive list/grid layouts
* Touch-friendly controls

### 📷 Mobile Capture

The application includes a mobile capture workflow for scanning/capturing pages and saving them directly into cloud storage.

Captured pages can be uploaded into selected folders for easy organization.


## 🛠️ Tech Stack

| Technology              | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| **React 18**            | Frontend UI                              |
| **TypeScript**          | Type-safe application development        |
| **Vite**                | Development and production build tooling |
| **Tailwind CSS**        | Utility-first styling                    |
| **Supabase**            | Backend-as-a-Service                     |
| **Supabase Auth**       | Authentication & sessions                |
| **Supabase PostgreSQL** | Application database                     |
| **Supabase Storage**    | Cloud file storage                       |
| **Lucide React**        | UI icons                                 |
| **PDF-Lib**             | PDF processing                           |
| **ESLint**              | Code quality                             |
| **Netlify**             | Deployment configuration                 |

The repository's package configuration confirms React, TypeScript, Vite, Tailwind CSS, Supabase JS, Lucide React, and PDF-Lib as core dependencies.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────┐
│                  Cloudly                    │
│              React + TypeScript             │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              Application Layer              │
│                                             │
│  Authentication │ File Manager │ Sharing    │
│  Search         │ Favorites    │ Activity   │
│  Trash          │ Preview      │ Profile    │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                   Supabase                  │
│                                             │
│   ┌────────────┐   ┌────────────────────┐  │
│   │ PostgreSQL │   │   Storage Bucket   │  │
│   │            │   │                    │  │
│   │ Users      │   │ Uploaded Files     │  │
│   │ Files      │   │ File Versions      │  │
│   │ Folders    │   │                    │  │
│   │ Shares     │   └────────────────────┘  │
│   │ Activities │                           │
│   │ Stars      │                           │
│   └────────────┘                           │
└─────────────────────────────────────────────┘
```

The application separates file metadata from actual stored file objects. Uploaded files are placed in Supabase Storage while metadata, ownership, folder relationships, sharing, stars, versions, and activity information are maintained in the database.

---

## 📂 Project Structure

```text
Cloudy_File_Driver/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── AuthScreen
│   │   ├── ShareModal
│   │   ├── FilePreviewModal
│   │   ├── PublicSharePage
│   │   ├── ProfileSettingsModal
│   │   ├── NotificationsPanel
│   │   └── MobileCaptureModal
│   │
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── useAuth.ts
│   │   ├── useDrive.ts
│   │   └── types.ts
│   │
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── supabase/
│
├── .env.example
├── netlify.toml
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.*
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/sankha166/Cloudy_File_Driver.git
cd Cloudy_File_Driver
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Use the provided `.env.example` as the starting point:

```bash
cp .env.example .env
```

Configure your Supabase project credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Never commit real credentials, service-role keys, passwords, or other secrets to GitHub.

### 4. Configure Supabase

Create/configure your Supabase project and apply the database schema located in the project's `supabase` directory.

The application uses Supabase for:

* Authentication
* PostgreSQL database
* File storage
* File metadata
* Sharing
* User profiles
* Activity tracking
* File versions

### 5. Start the development server

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

### 6. Build for production

```bash
npm run build
```

### 7. Preview the production build

```bash
npm run preview
```

### 8. Run code quality checks

```bash
npm run lint
```

### 9. Run TypeScript checks

```bash
npm run typecheck
```

---

## 🔒 Security

Cloudly is designed around authenticated and ownership-aware file operations.

Important security considerations include:

* Authentication handled through Supabase Auth
* User-specific file ownership
* Protected storage access
* Database-level authorization through Supabase policies
* Unique storage keys for uploaded files
* Environment variables for project configuration
* No credentials committed to source control

For production deployments, ensure that Supabase Row Level Security (RLS) policies and Storage policies are correctly configured before exposing the application publicly.

---

## 📊 File Management Flow

```text
User
 │
 ├── Select File
 │
 ▼
Client Validation
 │
 ├── File Type Check
 ├── File Size Check
 └── Filename Sanitization
 │
 ▼
Supabase Storage
 │
 └── Upload File
 │
 ▼
PostgreSQL
 │
 ├── File Metadata
 ├── Owner
 ├── Folder
 └── File Version
 │
 ▼
Activity Log
 │
 ▼
Cloudly Dashboard
```

---

## 🎯 Core Use Cases

Cloudly can be used for:

* Personal cloud storage
* Academic document management
* Student file organization
* Project file storage
* Document sharing
* Team file collaboration
* Backup and file recovery
* Mobile document capture
* Centralized file management

---

## 🌟 Why Cloudly?

Traditional file management often becomes difficult when files are distributed across local devices, folders, messaging applications, and external drives.

Cloudly provides a centralized workspace where users can:

**Store → Organize → Search → Preview → Share → Download → Recover**

all from one responsive web application.

---

## 🔮 Future Improvements

Potential future enhancements include:

* Real-time collaborative editing
* Advanced file version history
* Folder-level permission management
* Expiring share links
* Storage plan management
* Larger file uploads
* Advanced file search and filtering
* Image/document OCR
* File activity analytics
* Multi-device synchronization
* Offline/PWA support
* Drag-and-drop folder organization
* Cloud-to-cloud import/export
* Enhanced sharing permissions

---

## 🤝 Contributing

## 📄 License

This project is currently maintained as a private repository.

If you plan to make the project open source, add an appropriate license such as MIT, Apache-2.0, or GPL-3.0.

---

## 👨‍💻 Author

**Sankha**

GitHub: [@sankha166](https://github.com/sankha166)

---

## ⭐ Project

If you find Cloudly useful or interesting, consider giving the repository a ⭐ on GitHub.

**Cloudly — Your files. Your cloud. Your control.**
