from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:100]!r}')
    write(path, content.replace(old, new, 1))


replace_once(
    'src/lib/opc-routes.ts',
    "  qrCodes: '/qr-codes',\n  settings: '/einstellungen',",
    "  qrCodes: '/qr-codes',\n  finance: '/finanzen',\n  automations: '/rechnungsautomationen',\n  settings: '/einstellungen',",
)
replace_once(
    'src/lib/opc-routes.ts',
    "    [/^\\/qr-codes$/, OPC_ROUTES.qrCodes],\n    [/^\\/einstellungen$/, OPC_ROUTES.settings],",
    "    [/^\\/qr-codes$/, OPC_ROUTES.qrCodes],\n    [/^\\/finanzen$/, OPC_ROUTES.finance],\n    [/^\\/rechnungsautomationen$/, OPC_ROUTES.automations],\n    [/^\\/einstellungen$/, OPC_ROUTES.settings],",
)

replace_once(
    'src/components/MirakaSidebar.tsx',
    "  WalletCards,\n} from 'lucide-react';",
    "  WalletCards,\n  Workflow,\n} from 'lucide-react';",
)
replace_once(
    'src/components/MirakaSidebar.tsx',
    "      finance: routeFor('finance', '/finanzen'),\n      tickets:",
    "      finance: routeFor('finance', '/finanzen'),\n      automations: routeFor('automations', '/rechnungsautomationen'),\n      tickets:",
)
replace_once(
    'src/components/MirakaSidebar.tsx',
    """      ...(normalizedRole === 'owner'
        ? [
            {
              href: buildUrl(routes.finance),
              label: 'Finanzen',
              icon: WalletCards,
              key: 'finance',
              match: [routes.finance, '/finanzen', '/finance', '/dashboard/finanzen'],
            },
          ]
        : []),""",
    """      ...(normalizedRole === 'owner'
        ? [
            {
              href: buildUrl(routes.finance),
              label: 'Finanzen',
              icon: WalletCards,
              key: 'finance',
              match: [routes.finance, '/finanzen', '/finance', '/dashboard/finanzen'],
            },
            {
              href: buildUrl(routes.automations),
              label: 'Automationen',
              icon: Workflow,
              key: 'automations',
              match: [routes.automations, '/rechnungsautomationen'],
            },
          ]
        : []),""",
)

replace_once(
    'src/components/AdminDashboardHome.tsx',
    "import { baseUrl } from '../lib/base-url';\n",
    "import { baseUrl } from '../lib/base-url';\nimport OwnerBillingReadyWidget from './OwnerBillingReadyWidget';\n",
)
replace_once(
    'src/components/AdminDashboardHome.tsx',
    """      </div>

      {urgentItems.length > 0 && (""",
    """      </div>

      <OwnerBillingReadyWidget />

      {urgentItems.length > 0 && (""",
)

replace_once(
    'supabase/functions/opc-process-invoice-automation/index.ts',
    """function clean(value: unknown) {
  return String(value ?? '').trim();
}
""",
    """function clean(value: unknown) {
  return String(value ?? '').trim();
}

function automationEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(
    clean(Deno.env.get('OPC_INVOICE_AUTOMATION_ENABLED')).toLowerCase(),
  );
}
""",
)
replace_once(
    'supabase/functions/opc-process-invoice-automation/index.ts',
    """      runtime: 'supabase-edge-function',
    });""",
    """      runtime: 'supabase-edge-function',
      enabled: automationEnabled(),
      mode: automationEnabled() ? 'automatic' : 'manual-approval',
    });""",
)
replace_once(
    'supabase/functions/opc-process-invoice-automation/index.ts',
    """    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedLimit = Number(body.limit || 10);""",
    """    if (!automationEnabled()) {
      return json({
        ok: true,
        disabled: true,
        mode: 'manual-approval',
        claimed: 0,
        completed: 0,
        manualReview: 0,
        failed: 0,
        results: [],
      });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedLimit = Number(body.limit || 10);""",
)

replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    "import { readOpcPageCache, writeOpcPageCache } from '../../../lib/opc-page-cache';\n",
    "import { readOpcPageCache, writeOpcPageCache } from '../../../lib/opc-page-cache';\nimport { baseUrl } from '../../../lib/base-url';\n",
)
replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    """type CalendarEvent = {
  id: string;
  calendar_id: string;""",
    """type CalendarEvent = {
  id: string;
  calendar_id: string;
  job_id?: string | null;""",
)
replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    "  const [activeTab, setActiveTab] = useState<CalendarViewFilter>('all');",
    "  const [activeTab, setActiveTab] = useState<CalendarViewFilter>('team');",
)
replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    "    return ownCalendar?.id || teamCalendar?.id || employeeCalendar?.id || calendars[0]?.id || '';",
    "    return teamCalendar?.id || ownCalendar?.id || employeeCalendar?.id || calendars[0]?.id || '';",
)
replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    """  function handleEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.raw as CalendarEvent | undefined;
    if (!event) return;

    setQuickViewEvent(event);
  }
""",
    """  function openCalendarEvent(event: CalendarEvent) {
    const jobId = String(
      event.job_id ||
        event.metadata?.job_id ||
        event.metadata?.source_job_id ||
        '',
    ).trim();

    if (jobId) {
      const query = new URLSearchParams({
        from: 'kalender',
        calendarEventId: event.id,
      });
      window.location.assign(
        `${baseUrl}/einsatz/${encodeURIComponent(jobId)}?${query.toString()}`,
      );
      return;
    }

    setQuickViewEvent(event);
  }

  function handleEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.raw as CalendarEvent | undefined;
    if (!event) return;

    arg.jsEvent.preventDefault();
    openCalendarEvent(event);
  }
""",
)
replace_once(
    'src/components/opc/calendar/OPCCalendarPage.tsx',
    """            <button key={event.id} type="button" onClick={() => setQuickViewEvent(event)} className="opc-calendar-focus-card">""",
    """            <button key={event.id} type="button" onClick={() => openCalendarEvent(event)} className="opc-calendar-focus-card">""",
)

(ROOT / 'scripts/apply_manual_billing_patches.py').unlink(missing_ok=True)
(ROOT / '.github/workflows/apply-manual-billing-patches.yml').unlink(missing_ok=True)

print('Targeted manual billing patches applied.')
