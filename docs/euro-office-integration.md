# Orange Pro Clean Office Integration

The office editor is presented only inside the existing Orange Pro Clean portal.

User-facing routes:

- `/dokumente`
- `/dokumente/neu`
- `/dokumente/:id`
- `/dokumente/:id/bearbeiten`

Euro-Office remains a backend document engine. It does not provide a separate OPC login, dashboard or user-facing application.

## Required Cloudflare environment variables

```text
EURO_OFFICE_URL=https://office-engine.example.internal
EURO_OFFICE_JWT_SECRET=<minimum-24-character-random-secret>
PUBLIC_SITE_URL=https://<orange-pro-clean-portal-domain>
```

`EURO_OFFICE_JWT_SECRET` must be identical in the portal and the Euro-Office DocumentServer configuration.

The engine URL can be hidden behind a same-domain reverse proxy path such as `/office-engine`. In that setup, set `EURO_OFFICE_URL` to the externally reachable proxy origin/path and ensure these paths are forwarded to DocumentServer:

```text
/office-engine/web-apps/*
/office-engine/coauthoring/*
/office-engine/cache/*
/office-engine/sdkjs/*
/office-engine/doc/*
```

The portal itself remains the only user-facing application.

## Document flow

1. A user creates or uploads a document in `/dokumente`.
2. The portal stores the file in the private Supabase bucket `opc-office-documents`.
3. The editor configuration endpoint creates a short-lived signed file URL.
4. The configuration and callback URL are signed with HS256.
5. Euro-Office renders inside `/dokumente/:id/bearbeiten`.
6. Save callbacks are accepted only when the callback token and configured engine origin are valid.
7. Each accepted save creates an immutable row in `opc_document_versions`.
8. Database triggers update the document's current version.

## Security model

- `owner`, `admin` and `dispatch` can create and edit operational documents.
- `owner` and `admin` may delete documents when deletion is enabled in the UI.
- employees only receive access through ownership or explicit document permissions.
- clients only receive explicitly shared documents.
- Supabase files remain private.
- browser clients do not receive the service-role key.
- DocumentServer callback downloads are restricted to the configured engine origin.
- file size is limited to 100 MB.
- supported extensions are validated before upload.

## Production checks

Before enabling the module in production:

1. Pin a tested Euro-Office DocumentServer image version.
2. Configure HTTPS between the portal and DocumentServer.
3. Set the same JWT secret on both systems.
4. Confirm DocumentServer can reach the public portal callback URL.
5. Confirm DocumentServer can reach Supabase signed storage URLs.
6. Test DOCX, XLSX and PPTX create, edit, autosave and download flows.
7. Test role access with owner, admin, dispatch and employee accounts.
8. Confirm version rows are created after editor saves.
9. Back up the private document bucket and document tables.

## Current implementation scope

Implemented:

- blank DOCX, XLSX and PPTX creation
- existing file upload
- document list and filtering
- embedded editor
- signed editor configuration
- callback validation
- immutable version creation
- private signed downloads
- role-aware access checks

Future extensions:

- template administration interface
- customer/job/employee link selectors
- share-dialog UI
- restore an older version
- archive and soft-delete controls
- client publication workflow
