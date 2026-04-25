# Find And Study - Agents Portal

## Overview
Find And Study is an educational platform designed for study abroad agents, offering a comprehensive training and certification system. Its core purpose is to enhance agent proficiency and streamline the study abroad application process. The platform allows agents to complete courses, take quizzes, earn certificates, and manage agency information. It features role-based access for agents and administrators, interactive course content, a robust quiz system with certificate generation, and advanced agency management capabilities. The project aims to become a leading training platform in the study abroad sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend and UI/UX
The application is a React-based single-page application, built with TypeScript and Vite. It employs a component-based architecture leveraging `shadcn/ui` and Tailwind CSS for a responsive, accessible, and consistent design. Wouter manages client-side routing with role-based protection. The UI includes custom layouts, toast notifications, modal dialogs, and a modern public landing page with WCAG-compliant contrast and a focus on key features.

### State Management and Data Storage
Client-side state is managed using Zustand, separating authentication from application data. The system is designed to integrate with a PostgreSQL backend via Drizzle ORM, with mock data persistence currently handled by `localStorage`. Progress tracking and certificates are persistently stored in the backend.

### Authentication and Authorization
A robust mock authentication system provides role-based access control for agents and administrators, including session management and automatic session restoration. New agent sign-ups are inactive by default and require administrator approval before login, ensuring a closed-system approach. The public Signup form requires applicants to pick their country from a dropdown of all 249 ISO countries (Turkish names) and to provide an international mobile phone number via a dial-code selector + number input that is normalized to E.164 (`+<dial><digits>`, leading trunk-zero stripped) before submission. Both `country` (ISO alpha-2) and `phone` are persisted on the user record and validated server-side against the real ISO country set.

### Course and Assessment System
The platform features a modular course structure with lessons and embedded quizzes. It tracks user progress, supports various quiz question types with automatic scoring, and generates certificates with QR codes for verification using `jsPDF` and `html2canvas`. Final Exams are country-specific, require course completion, and automatically generate certificates upon passing.

### Core Features
- **Email Notification System:** Infrastructure for sending various notifications.
- **Analytics System:** Tracks user engagement for reporting.
- **Video Support:** Course content supports video integration.
- **Dashboards:** Advanced Agent Dashboard with progress charts and an Admin Analytics Dashboard with enrollment trends.
- **Export Features:** PDF export for admin reports and CSV export for agent data.
- **Competitive Leaderboard System:** Point-based ranking with achievement badges.
- **Object Storage Integration:** For profile pictures and agency logos using presigned URLs.
- **Agent Menu Management System:** Admin control over agent sidebar menu visibility.
- **Agency Location Updates:** Integration with Google Maps and Yandex Maps.
- **Findy Chat Interface:** Modern, accessible chat widget with real-time messaging, typing indicators, and session management, with a minimize feature. The launcher is conditionally displayed only for authenticated users on panel routes. Bot replies are rendered through a small inline whitelist markdown renderer (`client/index.html` → `renderMarkdown()`) so model output formatted with `**bold**`, `### headings`, `- lists`, and `[text](url)` is shown as styled HTML instead of raw markdown; user input still goes through `textContent` so it cannot inject HTML, and bot input is HTML-escaped before whitelist substitutions. Chat backend routes in three tiers: (1) direct call to the configured AI provider (OpenAI, Anthropic, Gemini, Mistral, OpenRouter, or any OpenAI-compatible base URL) using the admin's saved provider/model/API key, (2) legacy n8n webhook fallback, (3) RAG-only degraded mode. Provider API keys are write-only — the saved key is redacted from `GET /api/admin/findy/config`. Provider/webhook error messages are gated to admins only (regular users see a generic friendly message). RAG context is strictly grounded: each chat call injects three sections — DESTINATIONS (all active countries), PLATFORM CONTENT (published `contents` rows whose title/body matches user-message tokens), and UPLOADED KNOWLEDGE BASE (top chunks from `knowledge_chunks`, e.g. admin-uploaded universities/programs spreadsheets). The default system prompt forbids the model from using prior knowledge about universities/programs/fees and requires it to reply "Bu bilgi şu anda sistemde mevcut değil." when the answer is not in the injected data. The retrieval pipeline is optimized for token efficiency and corpus growth: (1) the Excel/CSV parser drops `Course Details` marketing text and `__EMPTY*` SheetJS placeholder columns and caps each cell to 120 chars, producing ~400-char chunks instead of ~1100, (2) `searchKnowledgeChunks` applies Turkish-aware normalization (ç→c, ş→s, ı→i, ğ→g, ö→o, ü→u, â/î/û), Turkish suffix stripping (-da/-de/-sinde/-larin etc., min stem 4) and a small TR↔EN dictionary (üniversite→university, ücret→fee/tuition, mühendislik→engineering, türkiye→turkey, …) before reranking candidates by distinct-term match count, returning at most 12 chunks, (3) the chat handler enforces a hard 8KB total RAG-context budget and pre-filters by university/country metadata when the user's question mentions one (using a small sample of corpus metadata to discover known entity names), (3a) listing-intent detection — when the user asks "hangi üniversiteler var / list universities / which universities / kaç üniversite" without naming a specific one, the handler injects an `AVAILABLE UNIVERSITIES` section built from `storage.listKnowledgeUniversities()` (DISTINCT `metadata->>'Country'` × `metadata->>'Universities'` from `knowledge_chunks`) so the model sees the COMPLETE list grouped by country instead of only the top-12 chunks (which previously biased the answer to 1-2 universities); the default system prompt rule #6 instructs the model to use this section verbatim when present, (4) the candidate-fetch step caps the working set at `max(60, limit×5)` rows so even a sequential `ILIKE` scan stays sub-100ms at the current corpus; if the corpus eventually grows past ~50K rows, `pg_trgm` GIN indexes on `content`/`keywords` plus B-tree expression indexes on `metadata->>'Universities'` / `metadata->>'Country'` should be added via a Drizzle migration that includes the `gin_trgm_ops` operator class. After uploading new knowledge files, the admin must click "Reprocess" on the source so the new compact chunk format takes effect.
- **Quiz-to-Content Linking System:** Associates quizzes with specific lessons.
- **Country-based Final Exam System:** Links final exams to specific countries and courses with rigorous validation.
- **Multilingual Content System:** Supports 10 languages with a Tiptap rich-text editor and DOMPurify sanitization.
- **Multilingual Announcements:** Per-language overrides for announcement title/content via `announcement_translations` table. Admin endpoints under `/api/admin/announcements/:id/translations` (GET list, POST upsert, DELETE per language). Agent fetch (`/api/announcements`) honors `?lang=xx` query param, falling back to caller's `languagePreference`, then to source-language record when no translation exists.
- **FindyAI RAG Knowledge Sources:** Allows administrators to upload files (Excel, PDF, Word) or add URLs to create a knowledge base. Relevant chunks are injected into chat context for RAG, with background processing and status tracking.
- **Security Hardening:** Implements rate limiting on critical authentication endpoints and employs security response headers.
- **Content File Upload API:** Supports image uploads (profile/logo) and larger content files (PDF, DOCX, MP4) up to 50MB.
- **Partner Zone Folder System:** Google Drive-style folder management with unlimited nesting, enabling organization of contents. Includes admin and agent UIs with breadcrumb navigation, search, filtering, sorting, drag-and-drop for bulk moves, and multi-select for content management.
- **Bulk Export/Import:** Supports exporting all agencies to `.xlsx` and bulk importing agencies and users via Excel/CSV, with server-side validation and enhanced user import options including country and profile pictures.
- **Popup Ad System:** Manages targeted pop-up advertisements with configurable audience, timing, and dismissal options.
- **Announcements System:** Dedicated agent announcements page with dashboard integration.
- **Grouped Sidebar Layouts:** Both admin and agent layouts feature a structured sidebar with grouped navigation items.

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