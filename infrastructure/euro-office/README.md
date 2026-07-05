# Self-hosted Euro-Office DocumentServer

No vendor API key is required. The portal talks directly to the open-source DocumentServer runtime.

## Start locally

```bash
cd infrastructure/euro-office
export EURO_OFFICE_JWT_SECRET="$(openssl rand -hex 32)"
export EURO_OFFICE_PORT=8080
docker compose pull
docker compose up -d
docker logs -f opc-euro-office
```

The server is ready when the logs report that `docservice` entered the `RUNNING` state.

For local portal development, configure:

```text
EURO_OFFICE_URL=http://localhost:8080
EURO_OFFICE_JWT_SECRET=<the same generated secret>
PUBLIC_SITE_URL=http://localhost:<portal-port>
```

For production, place HTTPS in front of port 8080 and set `EURO_OFFICE_URL` to that technical endpoint. The endpoint is only the editor engine; staff continue to work exclusively through `/dokumente` in the Orange Pro Clean portal.

The example application is disabled. Files remain in the private Supabase bucket and are supplied to DocumentServer through short-lived signed URLs.
