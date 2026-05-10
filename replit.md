# Find And Study - Agents Portal

## Overview
Find And Study is an educational platform for study abroad agents, providing a comprehensive training and certification system. It aims to enhance agent proficiency, streamline the study abroad application process, and become a leading training platform in the sector. The platform enables agents to complete courses, take quizzes, earn certificates, and manage agency information, featuring role-based access, interactive content, a robust quiz system with certificate generation, and advanced agency management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend and UI/UX
The application is a React-based single-page application built with TypeScript and Vite. It uses a component-based architecture with `shadcn/ui` and Tailwind CSS for a responsive and accessible design. Client-side routing is handled by Wouter, featuring role-based protection. The UI includes custom layouts, toast notifications, modal dialogs, and a modern public landing page focused on key features and WCAG compliance.

### State Management and Data Storage
Client-side state is managed using Zustand, with authentication separate from application data. The system integrates with a PostgreSQL backend via Drizzle ORM, with `localStorage` used for mock data persistence during development. Progress tracking and certificates are persistently stored in the backend.

### Authentication and Authorization
The system uses cookie-based server sessions for secure authentication, with user IDs stored in PostgreSQL. Passwords are verified using bcrypt. New agent sign-ups require administrator approval. All uploaded content, including profile pictures and agency logos, is access-controlled. Security headers are applied globally.

### Deployment
The production environment targets `academy.findandstudy.com` on a Hostinger VPS using Ubuntu, PostgreSQL 16, PM2, and OpenLiteSpeed as a reverse proxy. A setup script automates server configuration, including Node.js, PostgreSQL, PM2, repository cloning, dependency installation, and SSL certificate (Let's Encrypt) setup. A separate deploy script handles updates and migrations.

### Course and Assessment System
The platform offers a modular course structure with lessons and embedded quizzes. It tracks user progress, supports various quiz types with automatic scoring, and generates verifiable certificates with QR codes. Final exams are country-specific and require course completion.

### Core Features
-   **Email Notification System:** Supports various notifications.
-   **Analytics System:** Tracks user engagement.
-   **Video Support:** Integrates video content into courses.
-   **Dashboards:** Agent progress charts and admin analytics dashboards.
-   **Export Features:** PDF reports for admins and CSV for agent data.
-   **Competitive Leaderboard:** Point-based ranking with achievement badges.
-   **Object Storage Integration:** Uses presigned URLs for profile pictures and agency logos.
-   **Agent Menu Management:** Admin control over agent sidebar menu visibility.
-   **Agency Location Updates:** Integrates with Google Maps and Yandex Maps.
-   **Findy Chat Interface:** A real-time chat widget for authenticated users with typing indicators and session management. It supports AI providers (OpenAI, Anthropic, Gemini, Mistral) with a fallback to n8n webhooks and a RAG-only degraded mode. The RAG system incorporates dynamic context from active countries, platform content, and an uploaded knowledge base (Excel, PDF, Word, URLs), optimized for token efficiency and Turkish-aware language processing. Conversation memory is maintained for 5 turns (10 messages). The chat handler includes a 60-second in-memory cache for frequently accessed, slow-changing data to improve performance.
-   **Quiz-to-Content Linking System:** Associates quizzes with lessons.
-   **Country-based Final Exam System:** Links exams to specific countries and courses with validation.
-   **Multilingual Content System:** Supports 10 languages with a Tiptap rich-text editor and DOMPurify sanitization.
-   **Multilingual Announcements:** Allows per-language overrides for announcements.
-   **FindyAI RAG Knowledge Sources:** Administrators can upload files or add URLs to build a knowledge base for RAG, with background processing and status tracking.
-   **Security Hardening:** Implements rate limiting and security response headers. Production builds enforce a strict Content-Security-Policy via Helmet: `script-src 'self'` (the Findy launcher is served as the external file `/findy-launcher.js`, not inline), `style-src 'self' 'unsafe-inline' fonts.googleapis.com`, `connect-src 'self'` (all AI/n8n calls go through the server), `frame-src` whitelisted to YouTube/Vimeo/Google Maps/Yandex Maps, `object-src 'none'`, `frame-ancestors 'self'` globally with a per-route override of `frame-ancestors *` for `/embed/*` so the chat widget can still be embedded on third-party sites. CSP is intentionally disabled in development because Vite HMR uses inline modules. Direct runtime dependencies `multer`, `drizzle-orm`, `nodemailer`, `jspdf`, and `react-router-dom` are pinned to their CVE-patched releases; transitive HIGH/CRITICAL packages (`fast-xml-parser`, `lodash`, `minimatch`, `glob`, `picomatch`, `path-to-regexp`, `jws`, `preact`, `react-router`) are forced to patched versions via `package.json` `overrides`. Final `npm audit --omit=dev`: **0 critical, 1 high** — the lone remaining `xlsx` HIGH has no upstream fix available (SheetJS community build) and is tracked as accepted risk in follow-up task #47; full evidence in `.local/security-report.md`.
-   **Content File Upload API:** Supports uploads of various file types up to 50MB.
-   **Partner Zone Folder System:** Google Drive-style folder management with unlimited nesting, drag-and-drop, and multi-select for content organization.
-   **Bulk Export/Import:** Supports exporting agencies to `.xlsx` and bulk importing agencies and users via Excel/CSV with server-side validation.
-   **Popup Ad System:** Manages targeted pop-up advertisements.
-   **Announcements System:** Dedicated agent announcements page with dashboard integration.
-   **Grouped Sidebar Layouts:** Structured sidebar navigation for both admin and agent interfaces.
-   **Mobile-Responsive Admin Pages:** Admin pages (Quizzes, ContentCountries, Agencies, Users, FindyAI) are usable on 360–768px viewports without horizontal scroll. Global `DialogContent` shrinks to `w-[calc(100%-1rem)]` with `max-h-[calc(100dvh-2rem)] overflow-y-auto` on mobile. `AdminLayout` topbar/main padding shrinks to `p-3` on mobile and the title is truncated. Admin form grids changed from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`. Card headers use `flex-wrap items-center justify-between gap-3` so action buttons wrap below titles. Agency list-view `<Table>` is wrapped in `overflow-x-auto`. The existing mobile drawer on `AdminLayout` (Menu button + overlay) handles sidebar collapse on small viewports.

## External Dependencies

### UI and Styling
-   Tailwind CSS
-   shadcn/ui
-   Radix UI
-   Lucide React

### Development
-   Vite
-   TypeScript
-   React

### State and Data
-   Zustand
-   TanStack Query
-   React Hook Form
-   Zod

### Database and Backend
-   Drizzle ORM
-   Neon Database (PostgreSQL)
-   Express.js

### Document and Certificate Generation
-   jsPDF
-   html2canvas
-   QRCode

### Security
-   express-rate-limit
-   bcryptjs

### Content Editing
-   Tiptap
-   DOMPurify

### Utilities
-   Day.js
-   UUID
-   clsx/tailwind-merge
-   Wouter