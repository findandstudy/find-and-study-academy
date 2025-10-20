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

### Utilities
-   **Day.js**: Date manipulation.
-   **UUID**: Unique identifier generation.
-   **clsx/tailwind-merge**: CSS class management.
-   **Wouter**: Client-side routing.