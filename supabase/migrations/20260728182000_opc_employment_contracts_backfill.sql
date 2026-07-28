-- Orange Pro Clean GmbH
-- Arbeitsvertrags-Backfill V1
--
-- Sara und Pravin:
--   100-%-Monatslohn, aber vollständig variable Arbeitszeiten.
--   weekly_hours und guaranteed_weekly_hours bleiben NULL.
--   reference_weekly_hours = 42 ist nur eine nicht bindende Vollzeit-Referenz.
--   fixed_salary_covers_variable_hours = true.
--
-- Stundenlohn-Personal:
--   variable_hours, keine festen oder garantierten Wochenstunden.
--
-- Andy bleibt unberührt, weil sein konkreter Lohnwert noch nicht bestätigt ist.
-- Der Lauf verwendet keine temporären Tabellen und ist idempotent.

ROLLBACK;
BEGIN;
SET LOCAL TIME ZONE 'Europe/Zurich';

DO $$
BEGIN
  IF to_regclass('public.opc_employment_contracts') IS NULL THEN
    RAISE EXCEPTION 'Tabelle public.opc_employment_contracts fehlt.';
  END IF;

  IF to_regprocedure(
    'public.opc_resolve_employment_contract_type(text,date)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Funktion public.opc_resolve_employment_contract_type(text,date) fehlt.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS
  public.opc_employment_contracts_backup_20260728_backfill_v1
AS
SELECT c.*
FROM public.opc_employment_contracts c
WHERE c.employee_id IN (
  SELECT (x->>'employee_id')::uuid
  FROM jsonb_array_elements($json$[{"employee_id": "da084053-d67a-4d65-984b-bc2ae2880a1c", "employee_name": "Emine Zieberi", "contract_number": "OPC-PAY-2026-000010", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "e044673c-2f42-484d-8f8b-5427b696cc1e", "employee_name": "Filip Andjekovic", "contract_number": "OPC-PAY-2026-000011", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 26.5, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "9ea589e4-5624-4108-bad2-6ab00a63a47d", "employee_name": "Herminia Ascensão do Vale Monteiro", "contract_number": "OPC-PAY-2026-000019", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "b62debc3-0115-4b4c-b536-240602cd11a2", "employee_name": "Luciano Marangi", "contract_number": "OPC-PAY-2026-000006", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "8742eba5-ce71-45a3-a457-489120190cab", "employee_name": "Maria Angelica Varela Malpica", "contract_number": "OPC-PAY-2026-000007", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "63a0e241-5383-445e-b778-3136d0e3cdbe", "employee_name": "Migel Mirkovic", "contract_number": "OPC-PAY-2026-000013", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 30.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa", "employee_name": "Rico / Ylercio", "contract_number": "OPC-PAY-2026-000016", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "0f82f804-f1a4-4eb8-a9da-4bb11d62ff83", "employee_name": "Sebastien Jasari", "contract_number": "OPC-PAY-2026-000015", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "d1428879-542b-42a0-9555-a7e13a0ea875", "employee_name": "Sara Batista", "contract_number": "OPC-PAY-2026-000014", "salary_type": "monthly", "valid_from": "2026-07-01", "hourly_rate_chf": null, "monthly_salary_chf": 5000.0, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}, {"employee_id": "63f682f1-4c4f-4948-82ba-07bc028fc0c3", "employee_name": "Pravin Manotheepan", "contract_number": "OPC-PAY-2026-000005", "salary_type": "monthly", "valid_from": "2026-06-01", "hourly_rate_chf": null, "monthly_salary_chf": 6803.5, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}]$json$::jsonb) x
);

COMMENT ON TABLE
  public.opc_employment_contracts_backup_20260728_backfill_v1
IS
  'Sicherung vor OPC Arbeitsvertrags-Backfill V1 vom 28.07.2026.';

DO $$
DECLARE
  r record;
  v_existing_id uuid;
  v_conflict text;
  v_count integer;
  v_owner uuid :=
    'd48f36db-fccf-426c-86db-e6f258a7495f'::uuid;
BEGIN
  FOR r IN
    SELECT *
    FROM jsonb_to_recordset($json$[{"employee_id": "da084053-d67a-4d65-984b-bc2ae2880a1c", "employee_name": "Emine Zieberi", "contract_number": "OPC-PAY-2026-000010", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "e044673c-2f42-484d-8f8b-5427b696cc1e", "employee_name": "Filip Andjekovic", "contract_number": "OPC-PAY-2026-000011", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 26.5, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "9ea589e4-5624-4108-bad2-6ab00a63a47d", "employee_name": "Herminia Ascensão do Vale Monteiro", "contract_number": "OPC-PAY-2026-000019", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "b62debc3-0115-4b4c-b536-240602cd11a2", "employee_name": "Luciano Marangi", "contract_number": "OPC-PAY-2026-000006", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "8742eba5-ce71-45a3-a457-489120190cab", "employee_name": "Maria Angelica Varela Malpica", "contract_number": "OPC-PAY-2026-000007", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "63a0e241-5383-445e-b778-3136d0e3cdbe", "employee_name": "Migel Mirkovic", "contract_number": "OPC-PAY-2026-000013", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 30.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa", "employee_name": "Rico / Ylercio", "contract_number": "OPC-PAY-2026-000016", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "0f82f804-f1a4-4eb8-a9da-4bb11d62ff83", "employee_name": "Sebastien Jasari", "contract_number": "OPC-PAY-2026-000015", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "d1428879-542b-42a0-9555-a7e13a0ea875", "employee_name": "Sara Batista", "contract_number": "OPC-PAY-2026-000014", "salary_type": "monthly", "valid_from": "2026-07-01", "hourly_rate_chf": null, "monthly_salary_chf": 5000.0, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}, {"employee_id": "63f682f1-4c4f-4948-82ba-07bc028fc0c3", "employee_name": "Pravin Manotheepan", "contract_number": "OPC-PAY-2026-000005", "salary_type": "monthly", "valid_from": "2026-06-01", "hourly_rate_chf": null, "monthly_salary_chf": 6803.5, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}]$json$::jsonb) AS x(
      employee_id uuid,
      employee_name text,
      contract_number text,
      salary_type text,
      valid_from date,
      hourly_rate_chf numeric,
      monthly_salary_chf numeric,
      employment_percentage numeric,
      reference_weekly_hours numeric,
      is_gav_applicable boolean
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.opc_employees e
      WHERE e.id = r.employee_id
    ) THEN
      RAISE EXCEPTION
        'Mitarbeiter fehlt in opc_employees: % (%)',
        r.employee_name,
        r.employee_id;
    END IF;

    SELECT string_agg(c.contract_number, ', ' ORDER BY c.contract_number)
    INTO v_conflict
    FROM public.opc_employment_contracts c
    WHERE c.employee_id = r.employee_id
      AND c.contract_number <> r.contract_number
      AND c.status IN ('active', 'approved')
      AND c.valid_from <= r.valid_from
      AND (
        c.valid_until IS NULL
        OR c.valid_until >= r.valid_from
      );

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION
        'Überlappender fremder Vertrag bei %: %',
        r.employee_name,
        v_conflict;
    END IF;

    SELECT c.id
    INTO v_existing_id
    FROM public.opc_employment_contracts c
    WHERE c.contract_number = r.contract_number
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.opc_employment_contracts c
      SET
        employee_id = r.employee_id,
        contract_type =
          public.opc_resolve_employment_contract_type(
            r.salary_type,
            r.valid_from
          ),
        salary_type = r.salary_type,
        status = 'active',
        valid_from = r.valid_from,
        valid_until = NULL,

        weekly_hours = NULL,
        employment_percentage = r.employment_percentage,
        reference_weekly_hours = r.reference_weekly_hours,
        guaranteed_weekly_hours = NULL,

        pay_currency = 'CHF',
        hourly_rate_chf = r.hourly_rate_chf,
        monthly_salary_chf = r.monthly_salary_chf,
        annual_salary_chf = NULL,

        is_gav_applicable = r.is_gav_applicable,
        gav_name = CASE
          WHEN r.is_gav_applicable
            THEN 'GAV Reinigungsbranche Deutschschweiz'
          ELSE NULL
        END,

        workload_model = 'variable_hours',
        overtime_assessment_mode = 'manual',
        fixed_salary_covers_variable_hours =
          (r.salary_type = 'monthly'),

        notes = CASE
          WHEN r.salary_type = 'monthly' THEN
            '100-%-Monatslohn mit vollständig variablem Arbeitseinsatz. Keine festen oder garantierten Wochenstunden. 42 Stunden sind ausschliesslich ein nicht bindender Vollzeit-Referenzwert.'
          ELSE
            'Stundenlohn mit variablem Arbeitseinsatz und ohne feste oder garantierte Wochenstunden. Abweichende Objekttarife werden pro Zeiteintrag gespeichert.'
        END,

        metadata = COALESCE(c.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'contract_backfill',
              'opc_employment_contracts_backfill_v1',
            'source',
              'authoritative_excel_and_management_confirmation',
            'variable_schedule',
              true,
            'fixed_weekly_hours',
              false,
            'guaranteed_weekly_hours',
              false,
            'reference_weekly_hours_is_binding',
              false,
            'management_confirmation_date',
              DATE '2026-07-28',
            'updated_at',
              NOW()
          ),

        approved_at = COALESCE(c.approved_at, NOW()),
        approved_by = COALESCE(c.approved_by, v_owner),
        updated_at = NOW(),
        updated_by = v_owner
      WHERE c.id = v_existing_id;
    ELSE
      INSERT INTO public.opc_employment_contracts (
        employee_id,
        contract_number,
        contract_type,
        salary_type,
        status,
        valid_from,
        valid_until,
        weekly_hours,
        employment_percentage,
        pay_currency,
        hourly_rate_chf,
        monthly_salary_chf,
        annual_salary_chf,
        is_gav_applicable,
        gav_name,
        workload_model,
        reference_weekly_hours,
        guaranteed_weekly_hours,
        overtime_assessment_mode,
        fixed_salary_covers_variable_hours,
        notes,
        approved_at,
        approved_by,
        updated_by,
        metadata
      )
      VALUES (
        r.employee_id,
        r.contract_number,
        public.opc_resolve_employment_contract_type(
          r.salary_type,
          r.valid_from
        ),
        r.salary_type,
        'active',
        r.valid_from,
        NULL,
        NULL,
        r.employment_percentage,
        'CHF',
        r.hourly_rate_chf,
        r.monthly_salary_chf,
        NULL,
        r.is_gav_applicable,
        CASE
          WHEN r.is_gav_applicable
            THEN 'GAV Reinigungsbranche Deutschschweiz'
          ELSE NULL
        END,
        'variable_hours',
        r.reference_weekly_hours,
        NULL,
        'manual',
        (r.salary_type = 'monthly'),
        CASE
          WHEN r.salary_type = 'monthly' THEN
            '100-%-Monatslohn mit vollständig variablem Arbeitseinsatz. Keine festen oder garantierten Wochenstunden. 42 Stunden sind ausschliesslich ein nicht bindender Vollzeit-Referenzwert.'
          ELSE
            'Stundenlohn mit variablem Arbeitseinsatz und ohne feste oder garantierte Wochenstunden. Abweichende Objekttarife werden pro Zeiteintrag gespeichert.'
        END,
        NOW(),
        v_owner,
        v_owner,
        jsonb_build_object(
          'contract_backfill',
            'opc_employment_contracts_backfill_v1',
          'source',
            'authoritative_excel_and_management_confirmation',
          'variable_schedule',
            true,
          'fixed_weekly_hours',
            false,
          'guaranteed_weekly_hours',
            false,
          'reference_weekly_hours_is_binding',
            false,
          'management_confirmation_date',
            DATE '2026-07-28',
          'created_at',
            NOW()
        )
      );
    END IF;
  END LOOP;

  SELECT COUNT(*)
  INTO v_count
  FROM public.opc_employment_contracts c
  WHERE c.contract_number IN (
    SELECT x->>'contract_number'
    FROM jsonb_array_elements($json$[{"employee_id": "da084053-d67a-4d65-984b-bc2ae2880a1c", "employee_name": "Emine Zieberi", "contract_number": "OPC-PAY-2026-000010", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "e044673c-2f42-484d-8f8b-5427b696cc1e", "employee_name": "Filip Andjekovic", "contract_number": "OPC-PAY-2026-000011", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 26.5, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "9ea589e4-5624-4108-bad2-6ab00a63a47d", "employee_name": "Herminia Ascensão do Vale Monteiro", "contract_number": "OPC-PAY-2026-000019", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "b62debc3-0115-4b4c-b536-240602cd11a2", "employee_name": "Luciano Marangi", "contract_number": "OPC-PAY-2026-000006", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "8742eba5-ce71-45a3-a457-489120190cab", "employee_name": "Maria Angelica Varela Malpica", "contract_number": "OPC-PAY-2026-000007", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "63a0e241-5383-445e-b778-3136d0e3cdbe", "employee_name": "Migel Mirkovic", "contract_number": "OPC-PAY-2026-000013", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 30.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa", "employee_name": "Rico / Ylercio", "contract_number": "OPC-PAY-2026-000016", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "0f82f804-f1a4-4eb8-a9da-4bb11d62ff83", "employee_name": "Sebastien Jasari", "contract_number": "OPC-PAY-2026-000015", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "d1428879-542b-42a0-9555-a7e13a0ea875", "employee_name": "Sara Batista", "contract_number": "OPC-PAY-2026-000014", "salary_type": "monthly", "valid_from": "2026-07-01", "hourly_rate_chf": null, "monthly_salary_chf": 5000.0, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}, {"employee_id": "63f682f1-4c4f-4948-82ba-07bc028fc0c3", "employee_name": "Pravin Manotheepan", "contract_number": "OPC-PAY-2026-000005", "salary_type": "monthly", "valid_from": "2026-06-01", "hourly_rate_chf": null, "monthly_salary_chf": 6803.5, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}]$json$::jsonb) x
  );

  IF v_count <> 10 THEN
    RAISE EXCEPTION
      'Erwartet wurden 10 Backfill-Verträge, gefunden: %',
      v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opc_employment_contracts c
    WHERE c.contract_number IN (
      'OPC-PAY-2026-000014',
      'OPC-PAY-2026-000005'
    )
      AND NOT (
        c.salary_type = 'monthly'
        AND c.employment_percentage = 100
        AND c.weekly_hours IS NULL
        AND c.reference_weekly_hours = 42
        AND c.guaranteed_weekly_hours IS NULL
        AND c.workload_model = 'variable_hours'
        AND c.fixed_salary_covers_variable_hours = true
      )
  ) THEN
    RAISE EXCEPTION
      'Sara-/Pravin-Vertragsmodell ist nicht korrekt gespeichert.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.opc_employment_contracts c
    WHERE c.contract_number IN (
      'OPC-PAY-2026-000010',
      'OPC-PAY-2026-000011',
      'OPC-PAY-2026-000019',
      'OPC-PAY-2026-000006',
      'OPC-PAY-2026-000007',
      'OPC-PAY-2026-000013',
      'OPC-PAY-2026-000016',
      'OPC-PAY-2026-000015'
    )
      AND NOT (
        c.salary_type = 'hourly'
        AND c.weekly_hours IS NULL
        AND c.reference_weekly_hours IS NULL
        AND c.guaranteed_weekly_hours IS NULL
        AND c.workload_model = 'variable_hours'
        AND c.fixed_salary_covers_variable_hours = false
      )
  ) THEN
    RAISE EXCEPTION
      'Mindestens ein Stundenlohn-Vertragsmodell ist inkorrekt.';
  END IF;
END
$$;

COMMIT;

SELECT
  e.employee_number,
  concat_ws(
    ' ',
    e.legal_first_name,
    e.legal_last_name
  ) AS employee_name,
  c.contract_number,
  c.contract_type,
  c.salary_type,
  c.status,
  c.valid_from,
  c.hourly_rate_chf,
  c.monthly_salary_chf,
  c.employment_percentage,
  c.weekly_hours,
  c.reference_weekly_hours,
  c.guaranteed_weekly_hours,
  c.workload_model,
  c.fixed_salary_covers_variable_hours,
  c.is_gav_applicable,
  c.metadata ->> 'reference_weekly_hours_is_binding'
    AS reference_hours_binding
FROM public.opc_employment_contracts c
JOIN public.opc_employees e
  ON e.id = c.employee_id
WHERE c.contract_number IN (
  SELECT x->>'contract_number'
  FROM jsonb_array_elements($json$[{"employee_id": "da084053-d67a-4d65-984b-bc2ae2880a1c", "employee_name": "Emine Zieberi", "contract_number": "OPC-PAY-2026-000010", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "e044673c-2f42-484d-8f8b-5427b696cc1e", "employee_name": "Filip Andjekovic", "contract_number": "OPC-PAY-2026-000011", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 26.5, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "9ea589e4-5624-4108-bad2-6ab00a63a47d", "employee_name": "Herminia Ascensão do Vale Monteiro", "contract_number": "OPC-PAY-2026-000019", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "b62debc3-0115-4b4c-b536-240602cd11a2", "employee_name": "Luciano Marangi", "contract_number": "OPC-PAY-2026-000006", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "8742eba5-ce71-45a3-a457-489120190cab", "employee_name": "Maria Angelica Varela Malpica", "contract_number": "OPC-PAY-2026-000007", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "63a0e241-5383-445e-b778-3136d0e3cdbe", "employee_name": "Migel Mirkovic", "contract_number": "OPC-PAY-2026-000013", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 30.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa", "employee_name": "Rico / Ylercio", "contract_number": "OPC-PAY-2026-000016", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "0f82f804-f1a4-4eb8-a9da-4bb11d62ff83", "employee_name": "Sebastien Jasari", "contract_number": "OPC-PAY-2026-000015", "salary_type": "hourly", "valid_from": "2026-06-01", "hourly_rate_chf": 22.0, "monthly_salary_chf": null, "employment_percentage": null, "reference_weekly_hours": null, "is_gav_applicable": true}, {"employee_id": "d1428879-542b-42a0-9555-a7e13a0ea875", "employee_name": "Sara Batista", "contract_number": "OPC-PAY-2026-000014", "salary_type": "monthly", "valid_from": "2026-07-01", "hourly_rate_chf": null, "monthly_salary_chf": 5000.0, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}, {"employee_id": "63f682f1-4c4f-4948-82ba-07bc028fc0c3", "employee_name": "Pravin Manotheepan", "contract_number": "OPC-PAY-2026-000005", "salary_type": "monthly", "valid_from": "2026-06-01", "hourly_rate_chf": null, "monthly_salary_chf": 6803.5, "employment_percentage": 100.0, "reference_weekly_hours": 42.0, "is_gav_applicable": false}]$json$::jsonb) x
)
ORDER BY employee_name;
