-- Orange Pro Clean GmbH
-- Payroll Phase 1.2: Korrektur und Klassifizierung der Standardwerte 2026
--
-- Rechtlich fix / global:
--   AHV/IV/EO AN 5.30 %, AG 5.30 %
--   ALV AN 1.10 %, AG 1.10 %, Jahresmaximum CHF 148'200
--   NBU-Deckung ab 8 Stunden/Woche beim gleichen Arbeitgeber
--   BVG-Eintrittsschwelle 2026 CHF 22'680
--
-- GAV Reinigung Deutschschweiz:
--   Vollzugskostenbeitrag AN 0.45 %, AG 0.20 %, total 0.65 %
--   KTG-Pflicht bei regelmässig mindestens 12.5 Stunden/Woche;
--   effektive Prämie wird hälftig geteilt.
--
-- Unternehmens-/Versicherungswerte aus Excel:
--   NBU AN 1.38 %
--   KTG AN 0.80 %
-- Diese beiden Sätze sind keine allgemeinen gesetzlichen Pauschalen.
--
-- Quellensteuerwerte bleiben als provisorisch markiert.
-- BVG-Beträge werden nicht geraten oder überschrieben.

ROLLBACK;
BEGIN;
SET LOCAL TIME ZONE 'Europe/Zurich';

DO $$
BEGIN
  IF to_regclass('public.opc_employee_payroll_profiles') IS NULL THEN
    RAISE EXCEPTION 'opc_employee_payroll_profiles fehlt.';
  END IF;
  IF to_regclass('public.opc_payroll_rule_sets') IS NULL THEN
    RAISE EXCEPTION 'opc_payroll_rule_sets fehlt.';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS
  public.opc_employee_payroll_profiles_backup_20260728_standardwerte_v1
AS
SELECT *
FROM public.opc_employee_payroll_profiles
WHERE employee_id IN (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
);

UPDATE public.opc_payroll_rule_sets
SET
  ahv_employee_rate = 5.3000,
  ahv_employer_rate = 5.3000,
  alv_employee_rate = 1.1000,
  alv_employer_rate = 1.1000,
  alv_annual_max_chf = 148200.00,
  nbu_weekly_hours_threshold = 8.00,
  bvg_entry_threshold_chf = 22680.00,
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'ktg_gav_weekly_hours_threshold', 12.5,
    'gav_employee_execution_rate', 0.45,
    'gav_employer_execution_rate', 0.20,
    'gav_total_execution_rate', 0.65,
    'rate_classification_version', 'opc_payroll_phase1_2_2026',
    'updated_at', NOW()
  ),
  updated_at = NOW()
WHERE rule_year = 2026
  AND status = 'active';

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(v.employee_name, ', ' ORDER BY v.employee_name)
  INTO v_missing
  FROM (
    VALUES
      (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'Emine Zieberi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  'Filip Andjekovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'Herminia Ascensão do Vale Monteiro'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  'Luciano Marangi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  'Maria Angelica Varela Malpica'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'Migel Mirkovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  'Rico / Ylercio'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'Sebastien Jasari'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  'Sara Batista'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  true::boolean, 'BS'::text, 'A0N'::text, 5.20::numeric,
  'Excel: Basel-Stadt Tarif A0N 5.20 %, ausdrücklich provisorisch'::text
),
(
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid,
  'Pravin Manotheepan'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel: keine separate Quellensteuerposition; Status individuell prüfen'::text
)
  ) AS v(
    employee_id, employee_name,
    nbu_employee_rate, ktg_employee_rate,
    gav_subject, gav_employee_rate, gav_employer_rate,
    source_tax_subject, source_tax_canton, source_tax_tariff_code,
    source_tax_rate, source_tax_evidence
  )
  LEFT JOIN public.opc_employees e ON e.id = v.employee_id
  WHERE e.id IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Mitarbeiter nicht gefunden: %', v_missing;
  END IF;
END
$$;

WITH rates(
  employee_id, employee_name,
  nbu_employee_rate, ktg_employee_rate,
  gav_subject, gav_employee_rate, gav_employer_rate,
  source_tax_subject, source_tax_canton, source_tax_tariff_code,
  source_tax_rate, source_tax_evidence
) AS (
  VALUES
    (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'Emine Zieberi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  'Filip Andjekovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'Herminia Ascensão do Vale Monteiro'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  'Luciano Marangi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  'Maria Angelica Varela Malpica'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'Migel Mirkovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  'Rico / Ylercio'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'Sebastien Jasari'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  'Sara Batista'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  true::boolean, 'BS'::text, 'A0N'::text, 5.20::numeric,
  'Excel: Basel-Stadt Tarif A0N 5.20 %, ausdrücklich provisorisch'::text
),
(
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid,
  'Pravin Manotheepan'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel: keine separate Quellensteuerposition; Status individuell prüfen'::text
)
),
selected_profiles AS (
  SELECT DISTINCT ON (p.employee_id)
    p.id,
    p.employee_id
  FROM public.opc_employee_payroll_profiles p
  JOIN rates r ON r.employee_id = p.employee_id
  WHERE p.status = 'active'
    AND p.valid_from <= DATE '2026-07-01'
    AND (p.valid_until IS NULL OR p.valid_until >= DATE '2026-07-01')
  ORDER BY p.employee_id, p.valid_from DESC
)
UPDATE public.opc_employee_payroll_profiles p
SET
  nbu_employee_rate = r.nbu_employee_rate,
  nbu_employer_rate = 0,
  ktg_employee_rate = r.ktg_employee_rate,
  gav_employee_rate = CASE WHEN r.gav_subject THEN r.gav_employee_rate ELSE 0 END,
  gav_employer_rate = CASE WHEN r.gav_subject THEN r.gav_employer_rate ELSE 0 END,
  source_tax_subject = r.source_tax_subject,
  source_tax_canton = r.source_tax_canton,
  source_tax_tariff_code = r.source_tax_tariff_code,
  source_tax_rate = r.source_tax_rate,
  metadata = COALESCE(p.metadata, '{}'::jsonb) || jsonb_build_object(
    'standard_values_version', 'opc_payroll_phase1_2_2026',
    'ahv_alv_basis', 'federal_rule_set_2026',
    'nbu_rate_basis', 'orange_pro_clean_insurance_value_from_excel',
    'nbu_rate_is_statutory', false,
    'nbu_eligibility_threshold_hours', 8,
    'ktg_rate_basis', 'orange_pro_clean_insurance_value_from_excel',
    'ktg_rate_is_statutory', false,
    'ktg_gav_threshold_hours', 12.5,
    'ktg_employer_rate_requires_policy', true,
    'gav_subject', r.gav_subject,
    'gav_rate_basis', CASE WHEN r.gav_subject
      THEN 'GAV Reinigung Deutschschweiz Art. 20'
      ELSE 'not_applied_pending_role_classification'
    END,
    'source_tax_status', 'provisional_excel',
    'source_tax_confirmed', false,
    'source_tax_evidence', r.source_tax_evidence,
    'bvg_amount_confirmed', COALESCE(
      (p.metadata ->> 'bvg_amount_confirmed')::boolean,
      false
    ),
    'updated_at', NOW()
  ),
  updated_at = NOW(),
  updated_by = auth.uid()
FROM rates r
JOIN selected_profiles s ON s.employee_id = r.employee_id
WHERE p.id = s.id;

WITH rates(
  employee_id, employee_name,
  nbu_employee_rate, ktg_employee_rate,
  gav_subject, gav_employee_rate, gav_employer_rate,
  source_tax_subject, source_tax_canton, source_tax_tariff_code,
  source_tax_rate, source_tax_evidence
) AS (
  VALUES
    (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'Emine Zieberi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  'Filip Andjekovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'Herminia Ascensão do Vale Monteiro'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  'Luciano Marangi'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  'Maria Angelica Varela Malpica'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'Migel Mirkovic'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 0 %, provisorisch'::text
),
(
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  'Rico / Ylercio'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'Sebastien Jasari'::text,
  1.38::numeric, 0.80::numeric,
  true::boolean, 0.45::numeric, 0.20::numeric,
  true::boolean, NULL::text, NULL::text, 4.40::numeric,
  'Excel 24.06.–23.07.2026: Quellensteuer 4.40 %, provisorisch'::text
),
(
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  'Sara Batista'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  true::boolean, 'BS'::text, 'A0N'::text, 5.20::numeric,
  'Excel: Basel-Stadt Tarif A0N 5.20 %, ausdrücklich provisorisch'::text
),
(
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid,
  'Pravin Manotheepan'::text,
  1.38::numeric, 0.80::numeric,
  false::boolean, 0.00::numeric, 0.00::numeric,
  false::boolean, NULL::text, NULL::text, 0.00::numeric,
  'Excel: keine separate Quellensteuerposition; Status individuell prüfen'::text
)
)
INSERT INTO public.opc_employee_payroll_profiles (
  employee_id,
  status,
  valid_from,
  valid_until,
  source_tax_subject,
  source_tax_canton,
  source_tax_tariff_code,
  source_tax_rate,
  nbu_employee_rate,
  nbu_employer_rate,
  ktg_employee_rate,
  ktg_employer_rate,
  gav_employee_rate,
  gav_employer_rate,
  notes,
  metadata
)
SELECT
  r.employee_id,
  'active',
  DATE '2026-06-01',
  NULL,
  r.source_tax_subject,
  r.source_tax_canton,
  r.source_tax_tariff_code,
  r.source_tax_rate,
  r.nbu_employee_rate,
  0,
  r.ktg_employee_rate,
  0,
  CASE WHEN r.gav_subject THEN r.gav_employee_rate ELSE 0 END,
  CASE WHEN r.gav_subject THEN r.gav_employer_rate ELSE 0 END,
  'Standardwerte 2026 klassifiziert. NBU/KTG gemäss OPC-Versicherungswerten; BVG und Quellensteuer definitiv anhand Originalunterlagen prüfen.',
  jsonb_build_object(
    'standard_values_version', 'opc_payroll_phase1_2_2026',
    'ahv_alv_basis', 'federal_rule_set_2026',
    'nbu_rate_basis', 'orange_pro_clean_insurance_value_from_excel',
    'nbu_rate_is_statutory', false,
    'nbu_eligibility_threshold_hours', 8,
    'ktg_rate_basis', 'orange_pro_clean_insurance_value_from_excel',
    'ktg_rate_is_statutory', false,
    'ktg_gav_threshold_hours', 12.5,
    'ktg_employer_rate_requires_policy', true,
    'gav_subject', r.gav_subject,
    'gav_rate_basis', CASE WHEN r.gav_subject
      THEN 'GAV Reinigung Deutschschweiz Art. 20'
      ELSE 'not_applied_pending_role_classification'
    END,
    'source_tax_status', 'provisional_excel',
    'source_tax_confirmed', false,
    'source_tax_evidence', r.source_tax_evidence,
    'bvg_amount_confirmed', false,
    'created_at', NOW()
  )
FROM rates r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.opc_employee_payroll_profiles p
  WHERE p.employee_id = r.employee_id
    AND p.status = 'active'
    AND p.valid_from <= DATE '2026-07-01'
    AND (p.valid_until IS NULL OR p.valid_until >= DATE '2026-07-01')
)
ON CONFLICT (employee_id, valid_from) DO NOTHING;

DO $$
DECLARE
  v_rule_count integer;
  v_profile_count integer;
  v_bad_gav integer;
BEGIN
  SELECT COUNT(*) INTO v_rule_count
  FROM public.opc_payroll_rule_sets
  WHERE rule_year = 2026
    AND status = 'active'
    AND ahv_employee_rate = 5.3
    AND ahv_employer_rate = 5.3
    AND alv_employee_rate = 1.1
    AND alv_employer_rate = 1.1
    AND alv_annual_max_chf = 148200
    AND nbu_weekly_hours_threshold = 8
    AND bvg_entry_threshold_chf = 22680;

  IF v_rule_count <> 1 THEN
    RAISE EXCEPTION 'Aktiver Payroll-Regelsatz 2026 ist nicht eindeutig oder nicht korrekt.';
  END IF;

  SELECT COUNT(*) INTO v_profile_count
  FROM public.opc_employee_payroll_profiles p
  WHERE p.employee_id IN (
    'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
    'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
    '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
    'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
    '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
    '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
    'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
    '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
    'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
    '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
  )
    AND p.status = 'active'
    AND p.valid_from <= DATE '2026-07-01'
    AND (p.valid_until IS NULL OR p.valid_until >= DATE '2026-07-01');

  IF v_profile_count <> 10 THEN
    RAISE EXCEPTION 'Erwartet wurden 10 aktive Profile am 01.07.2026, gefunden: %', v_profile_count;
  END IF;

  SELECT COUNT(*) INTO v_bad_gav
  FROM public.opc_employee_payroll_profiles p
  WHERE p.employee_id IN (
    'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
    'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
    '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
    'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
    '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
    '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
    'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
    '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid
  )
    AND p.status = 'active'
    AND p.valid_from <= DATE '2026-07-01'
    AND (p.valid_until IS NULL OR p.valid_until >= DATE '2026-07-01')
    AND (p.gav_employee_rate <> 0.45 OR p.gav_employer_rate <> 0.20);

  IF v_bad_gav <> 0 THEN
    RAISE EXCEPTION 'GAV-Korrektur fehlgeschlagen bei % Profilen.', v_bad_gav;
  END IF;
END
$$;

COMMIT;

SELECT
  e.employee_number,
  concat_ws(' ', e.legal_first_name, e.legal_last_name) AS employee_name,
  p.valid_from,
  p.valid_until,
  p.nbu_employee_rate,
  p.ktg_employee_rate,
  p.gav_employee_rate,
  p.gav_employer_rate,
  p.source_tax_subject,
  p.source_tax_canton,
  p.source_tax_tariff_code,
  p.source_tax_rate,
  p.bvg_employee_amount_chf,
  p.bvg_employer_amount_chf,
  p.metadata ->> 'source_tax_status' AS source_tax_status,
  p.metadata ->> 'gav_rate_basis' AS gav_rate_basis
FROM public.opc_employee_payroll_profiles p
JOIN public.opc_employees e ON e.id = p.employee_id
WHERE p.employee_id IN (
  'da084053-d67a-4d65-984b-bc2ae2880a1c'::uuid,
  'e044673c-2f42-484d-8f8b-5427b696cc1e'::uuid,
  '9ea589e4-5624-4108-bad2-6ab00a63a47d'::uuid,
  'b62debc3-0115-4b4c-b536-240602cd11a2'::uuid,
  '8742eba5-ce71-45a3-a457-489120190cab'::uuid,
  '63a0e241-5383-445e-b778-3136d0e3cdbe'::uuid,
  'c8dc9896-c3b7-4ef1-9f48-b32a8ae295fa'::uuid,
  '0f82f804-f1a4-4eb8-a9da-4bb11d62ff83'::uuid,
  'd1428879-542b-42a0-9555-a7e13a0ea875'::uuid,
  '63f682f1-4c4f-4948-82ba-07bc028fc0c3'::uuid
)
  AND p.status = 'active'
  AND p.valid_from <= DATE '2026-07-01'
  AND (p.valid_until IS NULL OR p.valid_until >= DATE '2026-07-01')
ORDER BY employee_name;
