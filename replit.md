# Find And Study - Agents Portal

## Overview

Find And Study is an educational platform designed specifically for study abroad agents. The application serves as a comprehensive training and certification system where agents can complete courses about different countries, take quizzes, earn certificates, and manage their agency information. The platform features role-based access with separate interfaces for agents and administrators, course management with interactive content, quiz systems with certification generation, and agency management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is built as a single-page application using React with TypeScript and Vite as the build tool. The frontend follows a component-based architecture with clear separation of concerns through dedicated directories for pages, components, stores, and utilities. The UI is built using shadcn/ui components with Tailwind CSS for styling, following a design system with consistent color schemes, typography (Inter font), and spacing patterns.

### State Management
The application uses Zustand for client-side state management, separated into two main stores: authentication state (useAuthStore) for managing user sessions and roles, and data state (useDataStore) for managing all application data including users, agencies, courses, quizzes, progress tracking, and certificates. This provides a clean separation between authentication concerns and business data.

### Routing and Navigation
The application implements client-side routing using Wouter, with role-based route protection ensuring users can only access appropriate sections. The routing structure separates public routes (login, signup, certificate verification), agent routes (dashboard, courses, certificates, profile), and admin routes (dashboard, content management, user management, reports).

### Data Storage Strategy
Currently configured for mock/demo mode using localStorage for data persistence through a custom storage utility. The application is architected to easily transition to a real backend, with database schemas defined using Drizzle ORM and PostgreSQL configuration ready for production deployment. The storage layer abstracts data operations making the transition seamless.

### Authentication System
Mock authentication system with role-based access control supporting two user types: agents (primary users who take courses) and admins (manage content and users). Session management uses localStorage with automatic session restoration on app initialization. The auth system includes signup flows for new agents with automatic agency creation.

### Course and Assessment System
Modular course structure with sections containing lessons and embedded quizzes. Progress tracking system records lesson completion and quiz attempts. Certificate generation using jsPDF and html2canvas for PDF creation with QR codes for verification. Quiz system supports multiple question types with automatic scoring and pass/fail determination.

### UI Component Architecture
Built on shadcn/ui component library providing consistent design patterns. Custom layout components for different user roles (AdminLayout, AgentLayout, AuthCard). Responsive design with mobile-first approach and proper accessibility considerations. Toast notifications for user feedback and modal dialogs for complex interactions.

## External Dependencies

### UI and Styling Framework
- **Tailwind CSS**: Primary styling framework with custom design tokens
- **shadcn/ui**: Pre-built component library based on Radix UI primitives
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon system for consistent iconography

### Development and Build Tools
- **Vite**: Modern build tool and development server
- **TypeScript**: Type safety and enhanced developer experience
- **React**: Core frontend framework with hooks and context

### State and Data Management
- **Zustand**: Lightweight state management for client-side state
- **TanStack Query**: Server state management and caching (configured but not actively used in mock mode)
- **React Hook Form**: Form handling with validation
- **Zod**: Schema validation for form inputs and data structures

### Database and Backend (Configured)
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL support
- **Neon Database**: PostgreSQL hosting service (configured via connection string)
- **Express.js**: Backend server framework (minimal implementation present)

### Document and Certificate Generation
- **jsPDF**: PDF generation for certificates
- **html2canvas**: HTML to canvas conversion for certificate rendering
- **QRCode**: QR code generation for certificate verification

### Utility Libraries
- **Day.js**: Date manipulation and formatting
- **UUID**: Unique identifier generation
- **clsx/tailwind-merge**: Conditional CSS class management
- **Wouter**: Lightweight client-side routing