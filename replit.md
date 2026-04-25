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
- **Findy Chat Interface:** Modern, accessible chat widget with real-time messaging, typing indicators, and session management, with a minimize feature. The launcher is conditionally displayed only for authenticated users on panel routes. Chat backend routes in three tiers: (1) direct call to the configured AI provider (OpenAI, Anthropic, Gemini, Mistral, OpenRouter, or any OpenAI-compatible base URL) using the admin's saved provider/model/API key, (2) legacy n8n webhook fallback, (3) RAG-only degraded mode. Provider API keys are write-only — the saved key is redacted from `GET /api/admin/findy/config`. Provider error messages are gated to admins only; regular users see a generic friendly message.
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