# Find And Study - Agents Portal

## Overview
Find And Study is an educational platform designed for study abroad agents, offering a comprehensive training and certification system. Agents can complete courses, take quizzes, earn certificates, and manage agency information. The platform features role-based access for agents and administrators, interactive course content, a robust quiz system with certificate generation, and agency management capabilities. The long-term vision is to establish a leading platform for agent training in the study abroad sector, improving agent proficiency and streamlining the application process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is a single-page application built with React, TypeScript, and Vite. It follows a component-based architecture using `shadcn/ui` and Tailwind CSS for a consistent design system, including responsive design and accessibility.

### State Management
Zustand manages client-side state, separating authentication concerns (`useAuthStore`) from application data (`useDataStore`), which includes users, agencies, courses, quizzes, and progress.

### Routing and Navigation
Wouter handles client-side routing with role-based protection for public, agent, and admin routes.

### Data Storage Strategy
Currently uses `localStorage` for mock data persistence, but is architected for a seamless transition to a real backend using Drizzle ORM and PostgreSQL.

### Authentication System
A mock authentication system provides role-based access control for agents and administrators, with session management via `localStorage` and automatic session restoration. It includes signup flows and automatic agency creation.

### Course and Assessment System
Features a modular course structure with lessons and embedded quizzes. It tracks progress, generates certificates using `jsPDF` and `html2canvas` with QR codes for verification, and supports various quiz question types with automatic scoring. Final Exams are country-specific and require 100% course completion and all mini-quizzes passed before activation.

### UI Component Architecture
Built on `shadcn/ui` for consistent design, featuring custom layouts for different roles, responsive design, toast notifications, and modal dialogs.

### Deployment Configuration
Includes an auto-seeding system for initial data (admin user, default countries, menu settings) on first startup, ensuring production readiness.

### Features
-   **Email Notification System:** Infrastructure for email services with templates (course completion, certificates, announcements).
-   **Analytics System:** Tracks user engagement (course_start, course_complete, quiz_attempt, lesson_view, login) with reporting capabilities.
-   **Video Support:** Content table extended to support video URLs.
-   **Dashboards:** Advanced Agent Dashboard with progress charts, activity timelines, and learning statistics; Admin Analytics Dashboard with enrollment trends, certificate distribution, and top performer rankings.
-   **Export Features:** PDF export for admin reports and CSV export for agent data.
-   **Competitive Leaderboard System:** Point-based ranking with achievement badges for top performers.
-   **Object Storage Integration:** For profile pictures and agency logos using presigned URLs.
-   **Agent Menu Management System:** Admin control over agent sidebar menu visibility.
-   **Agency Location Updates:** Replaced Latitude/Longitude with Google Map and Yandex Map link fields.
-   **Findy Chat Interface:** Modern, accessible chat widget with real-time messaging, typing indicators, and session management, prepared for AI integration via webhook.
-   **Courses Page Default Selection:** Türkiye tab is automatically selected by default.
-   **Dorm Booking Integration:** Link to Dorm Booking website in the agent sidebar.
-   **Quiz-to-Content Linking System:** Allows admins to associate quizzes with specific lessons, making "Start Quiz" buttons appear on lessons with linked quizzes for agents.
-   **Country-based Final Exam System:** Final exams are linked to specific countries and courses, with rigorous validation to ensure correct association and availability only after 100% course and mini-quiz completion.

## External Dependencies

### UI and Styling Framework
-   **Tailwind CSS**: Styling framework.
-   **shadcn/ui**: Component library.
-   **Radix UI**: Accessible component primitives.
-   **Lucide React**: Icon system.

### Development and Build Tools
-   **Vite**: Build tool.
-   **TypeScript**: Language.
-   **React**: Frontend framework.

### State and Data Management
-   **Zustand**: Client-side state management.
-   **TanStack Query**: Server state management (configured).
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

### Utility Libraries
-   **Day.js**: Date manipulation.
-   **UUID**: Unique identifier generation.
-   **clsx/tailwind-merge**: CSS class management.
-   **Wouter**: Client-side routing.
## Development History

### Progress Tracking Migration to Backend (2025-10-20)
- **Critical Issue**: Course progress disappeared when switching browsers - localStorage-only storage caused data loss
- **User Impact**: Agent EYMEN NAMAZCI reported losing progress when accessing from different devices
- **Root Cause**: Progress data stored exclusively in localStorage, not synchronized with backend
  - Each browser had independent localStorage
  - No cross-device persistence
  - Hard refreshes could lose data
- **Solution**: Complete backend migration with PostgreSQL persistence
  - **Database Schema** (shared/schema.ts): Added `progresses` table
    - Columns: user_id, course_id, lesson_completed_ids (array), percent, current_lesson_id, last_accessed, last_lesson_completed_at
    - Unique constraint on (user_id, course_id) prevents duplicates
    - Proper types and indexes for performance
  - **Storage Layer** (server/storage.ts): Extended IStorage interface
    - getProgresses(userId?) - fetch all user progresses
    - getProgressByUserAndCourse(userId, courseId) - specific course
    - upsertProgress(data) - create or update with merge logic
    - updateProgress(userId, courseId, updates) - partial updates
  - **Backend API** (server/routes.ts): Four endpoints
    - GET /api/progress - all user progresses
    - GET /api/progress/:courseId - specific course progress
    - POST /api/progress - upsert (create or merge)
    - PATCH /api/progress/:courseId - partial update preserving existing fields
  - **Frontend Migration** (client/src/pages/agent/Dashboard.tsx):
    - Removed localStorage dependency for progress
    - Uses React Query to fetch from /api/progress
    - Backend-first strategy with no localStorage fallback
    - Certificates also fetched from backend with course enrichment
- **Implementation Details**:
  - Upsert logic merges new data with existing: `data.field ?? existing.field`
  - PATCH endpoint filters undefined values before update
  - Storage layer uses Drizzle ORM with type safety
  - Database migration successful (npm run db:push)
  - Route registration order fixed (server restart required for PATCH)
- **Architect Review**: Complete system validation with testing
  - POST upsert verified: merges without overwriting
  - PATCH partial update verified: preserves lessonCompletedIds
  - Database persistence confirmed: cross-session data retention
  - Evidence: percent=85 update preserved existing lessonCompletedIds
- **Testing**: Manual API testing with curl
  - POST created progress with percent=25, lessonCompletedIds=["lesson-1","lesson-2"]
  - PATCH updated percent=85, lessonCompletedIds preserved
  - Database confirmed: data persists across server restarts
- **Result**: Progress now persists across browsers, devices, and sessions
  - Solves user's cross-device issue completely
  - Production-ready backend infrastructure
  - Future: Add UI lesson tracking mutations + localStorage migration for existing users

### Certificate System Backend Enrichment & ARIA Fixes (2025-10-20)
- **Issue**: Agent certificates couldn't download because course info was missing from backend response
- **Secondary Issue**: Admin Certificate Details modal had ARIA accessibility warning (missing description)
- **Root Cause**: `/api/certificates` endpoint returned raw certificate data without course information
  - Frontend depended on localStorage for course data
  - When localStorage was empty/stale, downloads failed with "Course not found" error
- **Solution**: Backend course enrichment + ARIA compliance
  - **Backend Fix** (server/routes.ts): `/api/certificates` now enriches response with course data
    - Fetches courses from storage
    - Maps each certificate with nested course object (id, title, slug)
    - Returns: `{ id, code, scorePercent, issuedAt, userId, courseId, course: {...} }`
  - **Frontend Fix** (client/src/pages/agent/Certificates.tsx):
    - Primary: Uses `certificate.course` from backend
    - Fallback: Tries localStorage `courses` array if backend course is null
    - Proper error handling with toast notification
  - **ARIA Fix** (client/src/pages/admin/Certificates.tsx):
    - Added DialogDescription import
    - Added description: "View and download certificate information"
    - Eliminates accessibility warnings
- **Implementation Details**:
  - Backend enrichment pattern matches admin endpoint (`/api/admin/certificates`)
  - Frontend gracefully handles both enriched and legacy certificate data
  - Download functions verify course availability before PDF generation
- **Testing**: Playwright e2e test verified
  - Agent PDF/Badge downloads work without errors
  - Admin PDF/Badge downloads work without errors
  - No ARIA warnings in console
  - Clean console throughout entire flow
- **Result**: Certificates system now fully backend-powered with localStorage safety net

### Badge Logo Embedded Base64 Fix (2025-10-20)
- **Issue**: Agent badge downloads showed "Failed to load Find and Study logo" error
- **Root Cause**: Public folder path `/badge-logo.png` had CORS/timing issues in canvas image loading
- **Solution**: Embedded Find and Study logo as base64 constant (same pattern as certificate background)
  - Logo file: 78KB base64 embedded directly in pdf.ts
  - Constant: BADGE_LOGO_BASE64 with full data URL
  - Eliminates fetch/CORS/timing issues completely
  - Instant loading from memory
- **Implementation**: client/src/lib/pdf.ts
  - generateBadgePNG uses BADGE_LOGO_BASE64 instead of public path
  - No external network calls or file system dependencies
  - Works identically in development and production
- **Testing**: Playwright test verified - no console errors, clean badge downloads
- **Performance**: ~78KB added to bundle (acceptable for badge generation utility)

### Production Certificate PDF Download Fix (2025-10-20)
- **Issue**: PDF certificate downloads worked in development but failed in production (deployed site)
- **Root Cause**: Asset import path (`@assets/train_1760536930109.png`) transformed differently in production builds
- **Solution**: Embedded certificate background image as base64 constant
  - Converted background PNG to base64 data URL (~236KB)
  - Removed external fetch() dependency
  - Eliminates CORS and asset path issues
  - Works identically in development and production
- **Implementation**: client/src/lib/pdf.ts
  - CERTIFICATE_BACKGROUND constant contains full base64 data URL
  - Direct usage in jsPDF.addImage() without async fetch
  - No external dependencies or network calls required
- **Testing**: Verified on both agent and admin certificate pages
- **Performance**: ~315KB added to bundle (acceptable for single utility)

### Auto-Certificate Generation for Final Exams (2025-10-19)
- **Feature**: Certificates automatically generated when agents pass Final Exams (score >= passPercent)
- **Backend Implementation** (/api/attempts endpoint):
  - Checks quiz.isFinal && scorePercent >= passPercent after attempt submission
  - Generates secure certificate code (FAS-XXXXXXXXXXXX format using crypto.randomBytes)
  - Database unique constraint on (user_id, course_id) prevents duplicates
  - Concurrent request safety: Handles both code collisions and user/course duplicates
  - Code collision: Regenerates new code and retries (up to 5 attempts)
  - User/course duplicate: Returns existing certificate with alreadyIssued=true flag
- **Frontend Integration**:
  - submitAttempt response includes optional certificate object
  - QuizModal displays toast notification with certificate code
  - Different messages for new vs already-issued certificates
  - Certificate added to localStorage for immediate UI visibility
- **Database Schema**:
  - Unique constraint: user_course_unique on (user_id, course_id)
  - Code field: Unique constraint for certificate code
  - PostgreSQL error code 23505 handled gracefully
- **Error Handling**: Robust retry logic, duplicate detection, and user feedback
