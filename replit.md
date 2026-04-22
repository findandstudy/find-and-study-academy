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
- **Multilingual Content System:** `contentTranslations` table with 6 languages (TR/EN/RU/UZ/KK/AZ), Tiptap rich-text editor, DOMPurify sanitization, 5 API routes.
- **FindyAI Extended Tabs:** KnowledgeBaseTab (RAG config), ChannelsEmbedTab (widget embed), ApiWebhooksTab (webhook/API).
- **Integration Wizard:** 2-step visual create dialog with type-selection cards and step indicators.
- **Security Hardening:** `express-rate-limit` on `/api/login` (20/15min), `/api/signup`, `/api/forgot-password` & `/api/reset-password` (5/hr); security response headers (X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, X-Frame-Options, Permissions-Policy); request body size capped at 10MB.
- **Content File Upload API:** `POST /api/uploads/content` — multer-based endpoint for images (5MB profile/logo) and content files up to 50MB (PDF, DOCX, MP4, etc.), served statically via `/uploads/content/`.

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