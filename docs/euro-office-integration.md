# Orange Pro Clean Office Integration

The office editor is presented only inside the existing Orange Pro Clean portal.

User-facing routes:

- `/dokumente`
- `/dokumente/neu`
- `/dokumente/:id`
- `/dokumente/:id/bearbeiten`

Euro-Office remains a technical document engine. It does not provide a separate OPC login, dashboard or user-facing application.

## Production architecture

The production DocumentServer runs as a Cloudflare Container at:

```text
https://office.opc.miraka.ch
```

Users continue to work only at:

```text
https://opc.miraka.ch/dokumente
```

The large container image is built by GitHub Actions. Docker Desktop is not required on an OPC administrator's Mac.

Cloudflare Containers currently require the Workers Paid plan. The configured `standard-3` instance provides 2 vCPU, 8 GiB memory and 16 GB disk, and scales down after 30 minutes without requests.

## One-time GitHub repository secrets

Add these Actions secrets under repository **Settings → Secrets and variables → Actions**:

```text
CLOUDFLARE_ACCOUNT_ID=<Cloudflare account ID>
CLOUDFLARE_API_TOKEN=<token with Workers, Containers, Pages and custom-domain permissions>
EURO_OFFICE_JWT_SECRET=<random value with at least 32 bytes>
```

Generate the JWT secret without Docker:

```bash
openssl rand -hex 32
```

Do not commit or paste the value into issues, logs or source files.

## Remote deployment

Run the GitHub Actions workflow:

```text
Actions → Deploy Euro Office Container → Run workflow
```

The workflow performs the complete production setup:

1. builds `ghcr.io/euro-office/documentserver:latest` on a GitHub-hosted runner;
2. deploys the image as the `opc-euro-office` Cloudflare Container Worker;
3. creates the custom domain `office.opc.miraka.ch`;
4. stores the JWT secret in the Container Worker;
5. writes the matching Office variables to the `opc` Pages project;
6. builds and deploys the OPC portal;
7. waits for `https://office.opc.miraka.ch/healthcheck` to return `true`.

No local tunnel, local Docker daemon or manually managed DNS record is required. The custom-domain deployment creates and manages the necessary Cloudflare DNS association.

## Pages environment values

The deployment workflow applies these production values:

```text
EURO_OFFICE_URL=https://office.opc.miraka.ch
EURO_OFFICE_JWT_SECRET=<same value as the Container Worker>
PUBLIC_SITE_URL=https://opc.miraka.ch
```

`EURO_OFFICE_JWT_SECRET` must be identical in the portal and DocumentServer.

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
- browser clients do not receive the service-role key or Office JWT secret.
- DocumentServer callback downloads are restricted to the configured engine origin.
- the insecure DocumentServer example application is disabled.
- file size is limited to 100 MB.
- supported extensions are validated before upload.

## Production checks

After the first container deployment:

1. open `/dokumente` and confirm the status shows **Office bereit**;
2. create one DOCX, XLSX and PPTX file;
3. edit and save each file;
4. reopen each file and confirm the changes persisted;
5. confirm a new row exists in `opc_document_versions` after every save;
6. test owner, admin, dispatch and explicitly assigned employee access;
7. confirm downloads use short-lived signed URLs.

## Implemented scope

- app-style Word, Excel, PowerPoint and upload launchers
- blank DOCX, XLSX and PPTX creation
- existing file upload
- document list and filtering
- runtime readiness indicator
- embedded editor
- signed editor configuration
- callback validation
- immutable version creation
- private signed downloads
- role-aware access checks
- remote Cloudflare Container deployment workflow

Future extensions:

- template administration interface
- customer/job/employee link selectors
- share-dialog UI
- restore an older version
- archive and soft-delete controls
- client publication workflow
