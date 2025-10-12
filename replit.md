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

## Recent Features Added

### Email Notification System (2024-10-12)
- Email service infrastructure with template system for course completion, certificates, and announcements
- Email logs table for tracking sent emails with status monitoring
- User notification preferences (email notifications, course completion, certificate, announcements)
- Email templates built with responsive HTML design
- Note: Resend integration (connector:ccfg_resend_01K69QKYK789WN202XSE3QS17V) dismissed by user - infrastructure ready for future API key configuration

### Analytics System (2024-10-12)
- Analytics metrics table for tracking user engagement and progress
- Metric types: course_start, course_complete, quiz_attempt, lesson_view, login
- Support for course-specific and user-specific analytics queries
- Date range querying capability for reporting

### Video Support Schema (2024-10-12)
- Content table extended with videoUrl and videoDuration fields
- Support for YouTube, Vimeo, or Object Storage video URLs

### Advanced Agent Dashboard (2024-10-12)
- Interactive progress charts using recharts library showing course completion over time
- Weekly activity timeline with lesson views, quiz attempts, and course completions
- Learning statistics cards displaying total courses, certificates, and average quiz score
- Recent achievements section highlighting completed courses and earned certificates

### Admin Analytics Dashboard (2024-10-12)
- Comprehensive analytics dashboard with enrollment trends and certificate distribution charts
- Real-time metrics for active agents, course completions, and certificate issuance
- Top performers ranking system with completion rates and progress tracking
- Data visualization using recharts for agent activity and quiz performance analysis

### Export Features (2024-10-12)
- PDF export functionality for admin reports using jsPDF library
- Comprehensive PDF reports including statistics, course enrollment data, score distribution, and top performers
- CSV export for agent data including names, emails, progress, certificates, and course completion
- Download functionality with date-stamped filenames for record keeping

### Competitive Leaderboard System (2024-10-12)
- Point-based ranking system: 100 points per certificate + progress percentage
- Achievement badges for top 3 performers (gold, silver, bronze medals)
- Real-time leaderboard showing all agents ranked by points
- Current user position highlighted with special styling
- Points breakdown explanation visible on dashboard
- Dedicated leaderboard page accessible from agent navigation menu

### Object Storage Integration (2024-10-12)
- Profile picture upload functionality with Object Storage persistence
- Agency logo upload with presigned URLs and ACL policies
- Public visibility for uploaded images
- URL storage in database for persistent access across sessions

### Agent Menu Management System (2024-10-12)
- Admin-controlled agent sidebar menu visibility
- Menu Management page in admin panel for toggling menu items on/off
- Real-time menu filtering for agent users based on admin settings
- Settings stored in systemSettings table as JSON
- API endpoints: GET/PUT /api/menu-visibility for reading and updating settings
- Supports granular control over Dashboard, Courses, Certificates, Leaderboard, My Agency, Exams/Orders, Subscriptions, and Profile menu items

### Agency Location Updates (2024-10-12)
- Replaced Latitude/Longitude fields with Google Map and Yandex Map link fields in My Agency page
- Agency type updated to use googleMapUrl and yandexMapUrl instead of lat/lng
- Removed embedded map preview functionality
- Map links provide direct navigation to Google Maps and Yandex Maps for agency location

### Findy Chat Interface (2024-10-12)
- Modern, elegant chat widget accessible via fixed launcher button in bottom-right corner
- Slide-up chat window with gradient header, message history, and input area
- Real-time message display with user/bot avatars and timestamps
- Typing indicator animation for bot responses
- Mock AI responses (prepared for N8n AI agent integration via webhook)
- Responsive design with mobile optimization and dark mode support
- Full accessibility with ARIA labels, keyboard support, and data-testid attributes
- Session management with unique session IDs for future conversation tracking
- **Interface language: English**

### Courses Page Default Selection (2024-10-12)
- Turkey (Türkiye) tab automatically selected by default when navigating to Courses page
- Smart fallback logic: displays admin content when available, default course when not
- Correctly handles both placeholder Turkey (id='turkey') and real admin Turkey (UUID id)

### Dorm Booking Integration (2024-10-12)
- Dorm Booking logo added to agent sidebar below Agent Portal
- Logo-only link (no text) opens https://dormbooking.com/ in new tab
- Same size and styling as Agent Portal for visual consistency
- Works correctly in both collapsed and expanded sidebar states

### Multi-Language Support (2024-10-12)
- Internationalization (i18n) using react-i18next with 4 languages: Turkish (tr), English (en), Arabic (ar), Russian (ru)
- Automatic browser language detection with localStorage persistence using custom key 'i18n_language'
- LanguageSwitcher component with flag icons in both Login and AgentLayout headers
- Comprehensive translation coverage for navigation, authentication, dashboard, courses, certificates, agency, leaderboard, profile, admin, and chat interfaces
- RTL (Right-to-Left) layout support for Arabic language with CSS-based directional styling
- Document direction (dir attribute) automatically managed based on selected language
- Translation keys organized hierarchically: nav.*, auth.*, common.*, dashboard.*, courses.*, etc.
- Login page pre-authentication language selection for user convenience
- Agent sidebar navigation fully translated with dynamic label rendering
- Tested end-to-end with all 26 test scenarios passing including language switching, RTL behavior, and localStorage verification

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

### Internationalization (i18n)
- **react-i18next**: React bindings for i18next internationalization framework
- **i18next**: Core i18n framework with plugin architecture
- **i18next-browser-languagedetector**: Automatic browser language detection plugin