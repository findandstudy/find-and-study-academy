# Find And Study - Agents Portal

## Overview
Find And Study is an educational platform for study abroad agents, providing a comprehensive training and certification system. It enables agents to complete courses, take quizzes, earn certificates, and manage agency information. The platform supports role-based access for agents and administrators, offers interactive course content, a robust quiz system with certificate generation, and agency management capabilities. The project aims to become a leading platform for agent training in the study abroad sector, enhancing agent proficiency and streamlining the application process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The application is a single-page application built with React, TypeScript, and Vite. It utilizes a component-based architecture with `shadcn/ui` and Tailwind CSS for a consistent, responsive, and accessible design system. Wouter handles client-side routing with role-based protection.

### State Management & Data Storage
Zustand manages client-side state, separating authentication from application data. The system is designed for a seamless transition to a real backend using Drizzle ORM and PostgreSQL, currently using `localStorage` for mock data persistence. Progress tracking and certificates are persisted in the backend (PostgreSQL).

### Authentication & Authorization
A mock authentication system provides role-based access control for agents and administrators, including session management via `localStorage` and automatic session restoration. It supports signup flows and automatic agency creation.

### Course and Assessment System
The platform features a modular course structure with lessons and embedded quizzes. It tracks progress, generates certificates using `jsPDF` and `html2canvas` with QR codes for verification, and supports various quiz question types with automatic scoring. Final Exams are country-specific, require 100% course completion and all mini-quizzes passed before activation, and automatically generate certificates upon passing.

### UI/UX & Features
The UI is built on `shadcn/ui`, featuring custom layouts, responsive design, toast notifications, and modal dialogs. Key features include:
- **Email Notification System:** Infrastructure for sending notifications (course completion, certificates).
- **Analytics System:** Tracks user engagement (course_start, quiz_attempt, lesson_view) with reporting.
- **Video Support:** Content table supports video URLs.
- **Dashboards:** Advanced Agent Dashboard with progress charts and learning statistics; Admin Analytics Dashboard with enrollment trends.
- **Export Features:** PDF export for admin reports and CSV export for agent data.
- **Competitive Leaderboard System:** Point-based ranking with achievement badges.
- **Object Storage Integration:** For profile pictures and agency logos using presigned URLs.
- **Agent Menu Management System:** Admin control over agent sidebar menu visibility.
- **Agency Location Updates:** Fields for Google Map and Yandex Map links.
- **Findy Chat Interface:** Modern, accessible chat widget with real-time messaging, typing indicators, and session management, designed for AI integration, and includes a minimize feature.
- **Quiz-to-Content Linking System:** Allows associating quizzes with specific lessons.
- **Country-based Final Exam System:** Final exams linked to specific countries and courses with rigorous validation.
- **Multilingual Content System:** `contentTranslations` table with 10 languages (TR/EN/RU/UZ/KK/AZ/AR/ZH/ES/FR), Tiptap rich-text editor, DOMPurify sanitization, 5 API routes.
- **FindyAI Extended Tabs:** ChannelsEmbedTab (widget embed), ApiWebhooksTab (webhook/API). Knowledge Base tab removed — replaced by Sources tab with built-in PostgreSQL RAG.
- **FindyAI RAG Knowledge Sources:** `SourcesTab` in FindyAI admin — upload Excel/PDF/Word files or add URLs, parsed into `knowledge_sources`/`knowledge_chunks` tables; top-15 relevant chunks injected into chat context for token-efficient RAG. Background processing with status tracking (active/processing/error). Full CRUD API: GET/POST /api/admin/findy/sources, DELETE/POST reprocess per source.
- **Integration Wizard:** 2-step visual create dialog with type-selection cards and step indicators.
- **Security Hardening:** `express-rate-limit` on `/api/login` (20/15min), `/api/signup`, `/api/forgot-password` & `/api/reset-password` (5/hr); security response headers (X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, X-Frame-Options, Permissions-Policy); request body size capped at 10MB.
- **Content File Upload API:** `POST /api/uploads/content` — multer-based endpoint for images (5MB profile/logo) and content files up to 50MB (PDF, DOCX, MP4, etc.), served statically via `/uploads/content/`.
- **Partner Zone Folder System:** Google Drive-style folder management with **unlimited nesting** via `parent_folder_id` (self-referential, nullable). `partner_folders` table (id, name, description, coverImageUrl, countryCode, categoryTag, status, order, parentFolderId) + `folderId` FK on `contents`. Admin UI (`/admin/partner-zone` and `/admin/partner-zone/:folderId`) and Agent UI (`/agent/partner-zone` and `/agent/partner-zone/:folderId`) both support breadcrumb navigation, "Alt Klasör" creation inside any folder, and a shared toolbar with debounced search, country filter (with `CountryFlag`), file-type filter (Belge/Video/Görsel — only inside folder detail), and sort (Yeni→Eski / A→Z). Each content row exposes dual **"Aç"** (window.open) + **"İndir"** (anchor download) buttons for ALL file types. Cover image upload sends `purpose=cover`; server downsizes to **max 540×540** via Sharp (fit:'inside', withoutEnlargement, SVG skipped, fallback to original on resize error). Public API: `GET /api/partner-folders?parentId=root|<uuid>`, `GET /api/partner-folders/:id/contents` (returns `{folder, contents, subfolders, breadcrumb}`). Admin API: full CRUD on `/api/admin/partner-folders` (POST/PATCH accept `parentFolderId`; PATCH guards self-parenting and descendant cycles via `getFolderPath` depth-32 cycle-safe walk; DELETE returns 409 with Turkish "Klasör boş değil…" when subfolders/contents exist) + `PATCH /api/admin/contents/:id/folder`. Admin UI also supports **HTML5 drag-and-drop** to move folders/files: folder cards are both `draggable` and drop targets, content rows are draggable, and breadcrumb crumbs (root + ancestors) act as drop targets so items can be moved "up". Drop highlights via `ring-2 ring-primary`; no-op moves (same parent) and self-drops are skipped client-side, and backend cycle guard remains the source of truth.
- **Agency Bulk Export/Import:** Export button downloads all agencies to `.xlsx`; Bulk Import button opens dialog with template download, file picker (Excel/CSV), preview table, and `POST /api/admin/agencies/bulk-import` backend route.
- **User Bulk Import Enhancements:** `/admin/users` Bulk Import dialog template (`user_bulk_import_template.xlsx`) and parser now also accept optional `country` (ISO 3166-1 alpha-2, e.g. `TR`/`US`) and `profilePicture` (http(s) URL or `/uploads/...` path) columns. Preview table renders Country + Photo columns (Avatar thumbnail). Backend `POST /api/admin/users/bulk-import` validates these per row server-side (regex `^[A-Z]{2}$` for country; `http(s)`/`/uploads/` prefix for picture) BEFORE creating the user, then applies them via `storage.updateUser` after `createUser` (mirroring the single-create endpoint). Failed `updateUser` triggers a compensating `deleteUser` so per-row results accurately reflect persisted state.
- **Create User Dialog Enhancements:** Admin "Create New User" dialog at `/admin/users` now includes (1) a Profile Picture upload area at the top — Avatar preview + "Fotoğraf Yükle" button (PNG/JPG/JPEG only, max 5MB; uploads via `POST /api/uploads/content` and stores returned URL in `users.profile_picture`); and (2) a Country dropdown listing **all 249 ISO 3166-1 alpha-2 countries** (Turkish names, sorted via `tr` collator) backed by `client/src/lib/world-countries.ts`. New `users.country` text column stores the ISO code. `POST /api/admin/users` extended to accept `country`, `profilePicture`, and `companyName` (applied via `storage.updateUser` after `createUser`, mirroring the existing `status` pattern).
- **Public Landing Page (`/`):** Modern marketing page with sticky nav, navy-blue hero (HSL 224 76%), feature grid (Eğitim/Sertifika/Partner Zone/Liderlik), latest 3 announcements (`GET /api/announcements/public`), bottom CTA, and footer. Logged-in users are auto-redirected to their dashboard; the route was previously a redirect to `/login`.
- **Pop-up Reklam Sistemi:** `popups` table (title, content, imageUrl, linkUrl/Text, targetAudience [all/agents/specific], targetAgencyIds[], status, startsAt/expiresAt, frequency [every_session/every_login/once_per_user]) + `popup_dismissals` (popupId+userId unique, dontShowAgain). Admin CRUD at `/admin/popups`; client `PopupRenderer` mounted in `App.tsx` polls `/api/popups/active` for authenticated users and applies frequency rules via `sessionStorage` + server-side dismissal (`POST /api/popups/:id/dismiss`).
- **Agent Duyurular Sayfası (`/agent/announcements`):** Dashboard now slices the announcements feed to the latest 3 (newest first via `desc(publishedAt), desc(createdAt)`) and shows a "Tümünü Gör" link to the dedicated full list page in the agent sidebar (Genel grubu).
- **Grouped Sidebar Layouts:** Both `AdminLayout` and `AgentLayout` use a `navigationGroups` structure with small uppercase Turkish group labels (Genel, İçerik/Eğitim, Yönetim/Acente, Etkileşim/Hizmetler, Sistem/Bağlantılar). Compact `py-1.5` items, `flex-1 overflow-y-auto` nav region keeps logout always visible at the bottom; collapsed sidebar shows tooltips and a thin separator between groups instead of labels. Header reduced to `h-16`. Agent user section shows agency name inline with the badge to save vertical space.

## External Dependencies

### UI and Styling
-   **Tailwind CSS**: Styling framework.
-   **shadcn/ui**: Component library.
-   **Radix UI**: Accessible component primitives.
-   **Lucide React**: Icon system.

### Development
-   **Vite**: Build tool.
-   **TypeScript**: Language.
-   **React**: Frontend framework.

### State and Data
-   **Zustand**: Client-side state management.
-   **TanStack Query**: Server state management.
-   **React Hook Form**: Form handling.
-   **Zod**: Schema validation.

### Database and Backend
-   **Drizzle ORM**: Type-safe database toolkit.
-   **Neon Database**: PostgreSQL hosting.
-   **Express.js**: Backend framework.

### Document and Certificate Generation
-   **jsPDF**: PDF generation.
-   **html2canvas**: HTML to canvas conversion.
-   **QRCode**: QR code generation.

### Security
-   **express-rate-limit**: Rate limiting for auth and API endpoints.
-   **bcryptjs**: Password hashing.

### Content Editing
-   **Tiptap**: Rich-text editor for multilingual content.
-   **DOMPurify**: HTML sanitization for user-generated content.

### Utilities
-   **Day.js**: Date manipulation.
-   **UUID**: Unique identifier generation.
-   **clsx/tailwind-merge**: CSS class management.
-   **Wouter**: Client-side routing.