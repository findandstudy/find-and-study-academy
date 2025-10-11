# Find And Study - Agents Portal Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from educational platforms like Coursera and Udemy combined with professional admin dashboards like Linear and Notion. The platform requires both engaging course presentation and efficient data management interfaces.

## Core Design Elements

### A. Color Palette
**Brand Colors (provided):**
- Primary Navy: 224 76% 32% (`#143591`)
- Brand Red: 356 88% 53% (`#ED1C24`) 
- Pure White: 0 0% 100% (`#FFFFFF`)

**Supporting Colors:**
- Light mode backgrounds: 210 25% 98%, 210 15% 95%
- Dark mode backgrounds: 210 20% 8%, 210 15% 12%
- Success: 142 69% 45%
- Warning: 38 92% 50%
- Error: 356 88% 53% (matches brand red)
- Text: 210 15% 20% (light), 210 10% 85% (dark)

### B. Typography
- **Primary**: Inter (via Google Fonts CDN) - clean, professional
- **Display/Headers**: Inter 600-700 weights for section headers
- **Body**: Inter 400-500 for content and UI elements
- **Code/Data**: JetBrains Mono for technical content and data tables

### C. Layout System
**Tailwind Spacing Units**: Consistent use of 2, 4, 6, 8, 12, 16
- Micro spacing: p-2, m-2 (form elements, badges)
- Standard spacing: p-4, gap-4, mb-6 (cards, sections)
- Large spacing: p-8, mt-12, gap-16 (page sections, hero areas)

### D. Component Library

**Navigation**: Clean header with Find And Study branding, role-based menu items, and user profile dropdown

**Course Cards**: Image thumbnails, progress indicators, completion badges with navy accent borders

**Data Tables**: Sortable headers, row hover states, action buttons grouped on right

**Forms**: Consistent input styling with navy focus rings, proper validation states

**Dashboard Cards**: Statistics cards with subtle shadows, icon + number + label format

**Quizzes**: Card-based question layouts with clear answer selection and progress tracking

**Certificates**: Professional certificate template with QR codes and verification elements

**Admin Panels**: Tabbed interfaces for different management sections, bulk action controls

### E. Content Structure

**Course Content**: 
- Structured sections (Geography, Climate, History, Culture, etc.)
- Rich HTML content rendering with consistent typography hierarchy
- Embedded mini-quizzes between sections

**Dashboards**:
- Agent view: Course progress, upcoming deadlines, achievement highlights
- Admin view: User statistics, content management tools, system integrations

## Images
**Hero Images**: Each country page features a large hero image (heroImageUrl from Country interface) with overlay text and optional coverColor accent. Hero images should be landscape format, high-quality, representing the country's landmarks or culture.

**Course Thumbnails**: Smaller rectangular images for course cards in grid layouts

**Profile/Agency Logos**: Square format for user avatars and agency branding uploads

**Certificate Graphics**: Professional certification badge/seal graphics for PDF generation

## Key UX Principles
- **Role-based UI**: Clear visual distinction between admin and agent interfaces
- **Progress Clarity**: Always-visible progress indicators for courses and quizzes
- **Educational Flow**: Logical content progression with clear next steps
- **Professional Polish**: Business-appropriate design suitable for educational institutions
- **Data Density**: Efficient information display for admin reporting and management tasks