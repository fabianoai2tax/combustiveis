# Plan: Fix Client Company Data Display and Persistence

This plan outlines the steps to fix the bugs related to displaying and saving client and company information.

## Phase 1: Fix Data Display in Dialog

- [x] Task: Correct the data mapping in `cliente-dialog.tsx`. # fc8e88b
    - [x] Task: Modify the `form.reset` call inside the `useEffect` hook to correctly map the `nome` and `cnpj` fields from the fetched `empresas` data to the `nome_empresa` and `cnpj_empresa` form fields. # fc8e88b
- [x] Task: Conductor - User Manual Verification 'Phase 1: Fix Data Display in Dialog' (Protocol in workflow.md) [checkpoint: c57cbee]

## Phase 2: Fix Data Persistence

- [x] Task: Update the server action in `app/actions/clientes.ts`. # a8558f8
    - [x] Task: In the `saveClienteAndEmpresas` function, ensure the object being sent to Supabase uses the correct `nome` and `cnpj` field names for the `postos_gasolina_empresas` table. # a8558f8
    - [x] Task: Add the `{ onConflict: 'id' }` option to the `upsert` call for `postos_gasolina_empresas` to ensure updates to existing companies work correctly. # a8558f8
- [x] Task: Fix bug when adding a new company to an existing client. # c72ad22
    - [x] Task: In `saveClienteAndEmpresas`, modify the mapping of `empresasToUpsert` to conditionally include the `id` field only when it exists, preventing a `NOT NULL` violation on the primary key for new company insertions. # c72ad22
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Fix Data Persistence' (Protocol in workflow.md)

## Phase 3: Testing and Verification

- [ ] Task: Manually test the complete user flow.
    - [ ] Task: Verify that opening the dialog for a client with existing companies correctly displays their names and CNPJs.
    - [ ] Task: Verify that adding a new company, editing an existing one, and deleting a company all work as expected after saving.
    - [ ] Task: Verify that changing the client's name is persisted.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Testing and Verification' (Protocol in workflow.md)
