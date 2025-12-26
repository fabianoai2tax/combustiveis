# Tech Stack

## Overview

The "combustiveis" application is built using a modern and robust technology stack designed for performance, scalability, and developer efficiency.

## Core Technologies

*   **Frontend Framework:** Next.js with React
    *   **Rationale:** Next.js provides server-side rendering (SSR), static site generation (SSG), and API routes, enabling a high-performance and SEO-friendly frontend. React facilitates a component-based UI development, ensuring maintainability and reusability.
*   **Styling & UI Components:** Tailwind CSS, Radix UI
    *   **Rationale:** Tailwind CSS offers a utility-first approach for rapid UI development and highly customizable styling. Radix UI provides unstyled, accessible components that integrate seamlessly with Tailwind CSS, ensuring a robust and accessible user interface.
*   **Programming Language:** TypeScript
    *   **Rationale:** TypeScript enhances code quality and maintainability by providing static type checking, reducing errors, and improving developer experience, especially in larger codebases.
*   **Backend & Database:** Supabase
    *   **Rationale:** Supabase offers a powerful open-source alternative to Firebase, providing a PostgreSQL database, authentication, and real-time capabilities. This simplifies backend development and deployment, allowing for rapid feature delivery.

## Key Libraries & Tools

*   **Form Management:** React Hook Form, Zod
    *   **Rationale:** React Hook Form provides efficient and flexible form management with minimal re-renders, while Zod is used for schema validation, ensuring data integrity.
*   **Date Handling:** date-fns, React DayPicker
    *   **Rationale:** `date-fns` is a comprehensive and lightweight date utility library, and `React DayPicker` offers an accessible and customizable date picker component for user input.
*   **Data Tables:** Tanstack Table
    *   **Rationale:** Tanstack Table provides a headless table utility, allowing for highly customizable and performant data tables crucial for displaying fuel-related information.
*   **PDF Generation:** jspdf, jspdf-autotable
    *   **Rationale:** These libraries enable the generation of client-side PDF documents, useful for reports or printable summaries of fuel data.
*   **Other Utilities:** `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (icons), `sonner` (notifications).
