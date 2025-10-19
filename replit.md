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