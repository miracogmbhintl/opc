# OPC AutoAid / Fuhrpark Copy Plan

Date: 2026-08-20  
Scope: Copy the usable EcoTaxi fleet/dispatch architecture into the Orange Pro Clean portal and feed it with AutoAid ECU/GPS data.

## 1. Source pattern from EcoTaxi

EcoTaxi used the OPC portal shell as the operating base. The relevant copyable modules are:

- Fleet map: live vehicle position, driver state, range and availability.
- Live dispatch: operational queue, assignment and control.
- Vehicles: vehicle master data and detail cards.
- Maintenance: vehicle health and service follow-up.
- Alerts: operational warnings.
- Reports: fleet utilisation, ride performance, costs and operational reports.
- Documents: vehicle, employee, customer and generated PDFs.
- Users & roles: portal access, roles and permissions.
- Settings: dispatch, fleet, notifications and integrations.

For OPC, the business language changes from taxi operations to cleaning operations:

| EcoTaxi module | OPC module | OPC use |
| --- | --- | --- |
| Fleet map | Fuhrpark Live Map | Auto location, tank, km, route, AutoAid status |
| Live dispatch | Einsatz- & Fahrzeugsteuerung | Vehicle-to-job and employee assignment |
| Rides | Fahrten / Tagesrouten | Trips, stops, daily route history |
| Drivers | Mitarbeiter / Fahrer | Assigned vehicle, current driver, shift link |
| Vehicles | Fahrzeugakte | Kennzeichen, dongle, service, DTC, documents |
| Maintenance | Wartung & Diagnose | Service due, motor warnings, battery/OBD faults |
| Alerts | Fuhrpark-Warnungen | Dongle removed, offline, long idle, critical DTC |
| Reports | Fuhrparkberichte | km, drive time, stop time, job plausibility |
| Settings | AutoAid Integration | API key, pull interval, push/pull mode |

## 2. Implementation direction

The OPC build should not read AutoAid directly from frontend components. Data flow should stay server-side:

1. Owner enters AutoAid API key in OPC settings.
2. Server API stores the key encrypted in `opc_integration_settings`.
3. Pull worker and/or webhook writes raw AutoAid payloads into `opc_autoaid_events_raw`.
4. Normalizer updates current vehicle status, location history, trips, stops, DTCs and alerts.
5. Frontend reads only normalized OPC tables.

This keeps the UI fast and avoids exposing external provider credentials in browser code.

## 3. First copied backend layer

The first foundation migration creates:

- `opc_integration_settings`
- `opc_fleet_vehicles`
- `opc_autoaid_events_raw`
- `opc_vehicle_status_current`
- `opc_vehicle_locations`
- `opc_vehicle_trips`
- `opc_vehicle_stops`
- `opc_vehicle_dtc_codes`
- `opc_fleet_alerts`

These are enough for the first AutoAid pull/push integration and for frontend V1 pages.

## 4. First frontend layer

A first owner-only frontend route is prepared at:

`/einstellungen/autoaid`

It allows the owner to:

- enable/disable AutoAid;
- set the AutoAid API base URL;
- enter or replace the API key;
- remove the stored API key;
- choose pull/push mode;
- choose the pull interval.

The key is not returned to the frontend after saving. The UI only shows whether a key exists and its last four characters.

## 5. Next copy step

The next code step is to add the ingest worker:

- `src/pages/api/integrations/autoaid/pull.ts`
- shared AutoAid client helper for decrypting the key and calling AutoAid REST endpoints;
- event normalizer for GPS, mileage, fuel, ignition, DTC and trip payloads;
- scheduled or manual trigger for first data import.

After first live data lands in the new tables, copy the EcoTaxi Fleet Map pattern into OPC as:

- `/fuhrpark`
- `/fuhrpark/karte`
- `/fuhrpark/fahrzeuge/[id]`
- `/fuhrpark/tagesrouten`
- `/fuhrpark/wartung`
- `/fuhrpark/berichte`

## 6. Required deployment notes

Before using the owner settings form in production, set this secret in Cloudflare/Worker environment:

`AUTOAID_SETTINGS_SECRET`

This is used to encrypt the AutoAid API key before it is stored in Supabase. The app also needs the existing server variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 7. Operating rules

- AutoAid secrets never go into public env vars.
- Raw events are kept for audit and later improvements.
- Frontend pages read normalized tables, not provider payloads.
- Owner can manage API credentials.
- Admin can later view fleet status and reports.
- Employee view should be limited to assigned vehicle/job context only.
