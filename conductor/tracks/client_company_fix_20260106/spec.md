# Spec: Fix Client Company Data Display and Persistence

## Overview

This track addresses a critical bug preventing users from successfully managing client and company information. When a user attempts to edit a client, the correct number of company input fields are shown, but they are empty because the data fetched from the database is not correctly mapped to the form fields. Additionally, any new data entered is not saved correctly due to a misconfiguration in the database `upsert` operation.

The root causes are:
1.  A data mapping mismatch in `cliente-dialog.tsx` where the component expects fields like `nome_empresa` but the database provides different field names (e.g., `nome`).
2.  The `saveClienteAndEmpresas` server action is missing the necessary `onConflict` option for the `upsert` operation, preventing existing company records from being updated.

## Functional Requirements

- When the `cliente-dialog.tsx` component is opened for editing, it must correctly fetch and **display** the data for all companies associated with that client.
- When a user adds, edits, or deletes a company within the dialog and clicks "Save", the changes must be correctly persisted in the `postos_gasolina_empresas` table.
- When a user modifies the client's name and clicks "Save", the change must be correctly persisted in the `postos_gasolina_clientes` table.
- The UI should provide clear feedback to the user, indicating whether the save operation was successful or if an error occurred.

## Acceptance Criteria

- Open the client edit dialog for a client with existing companies. The company names and CNPJs must be visible in the input fields.
- Add a new company to a client and save. Re-open the dialog; the new company must be present and its data visible.
- Edit an existing company's details (e.g., name or CNPJ) and save. Re-open the dialog; the changes must be reflected and visible.
- Delete a company from a client and save. Re-open the dialog; the company must be gone.
- Change the client's name and save. The new name must be reflected in the main clients table.
- All operations must be reflected correctly in the Supabase database tables.

## Out of Scope

- Major UI redesign of the `cliente-dialog.tsx` component.
- Changes to any other part of the application.
