function replaceOne(code, search, replacement, id) {
  const parts = code.split(search);
  if (parts.length !== 2) {
    throw new Error(`[opc-manual-billing-source-patches] ${id}: expected one source match, found ${parts.length - 1}.`);
  }
  return `${parts[0]}${replacement}${parts[1]}`;
}

export default function opcManualBillingSourcePatches() {
  return {
    name: 'opc-manual-billing-source-patches',
    enforce: 'pre',
    transform(source, rawId) {
      const id = rawId.split('?')[0].replaceAll('\\', '/');
      let code = source;

      if (id.endsWith('/src/components/MirakaSidebar.tsx')) {
        code = replaceOne(
          code,
          "  WalletCards,\n} from 'lucide-react';",
          "  WalletCards,\n  Workflow,\n} from 'lucide-react';",
          id,
        );
        code = replaceOne(
          code,
          "      finance: routeFor('finance', '/finanzen'),\n      tickets:",
          "      finance: routeFor('finance', '/finanzen'),\n      automations: routeFor('automations', '/rechnungsautomationen'),\n      tickets:",
          id,
        );
        code = replaceOne(
          code,
          `      ...(normalizedRole === 'owner'
        ? [
            {
              href: buildUrl(routes.finance),
              label: 'Finanzen',
              icon: WalletCards,
              key: 'finance',
              match: [routes.finance, '/finanzen', '/finance', '/dashboard/finanzen'],
            },
          ]
        : []),`,
          `      ...(normalizedRole === 'owner'
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
        : []),`,
          id,
        );
        return { code, map: null };
      }

      if (id.endsWith('/src/components/AdminDashboardHome.tsx')) {
        code = replaceOne(
          code,
          "import { baseUrl } from '../lib/base-url';\n",
          "import { baseUrl } from '../lib/base-url';\nimport OwnerBillingReadyWidget from './OwnerBillingReadyWidget';\n",
          id,
        );
        code = replaceOne(
          code,
          `      </div>

      {urgentItems.length > 0 && (`,
          `      </div>

      <OwnerBillingReadyWidget />

      {urgentItems.length > 0 && (`,
          id,
        );
        return { code, map: null };
      }

      if (id.endsWith('/src/components/opc/calendar/OPCCalendarPage.tsx')) {
        code = replaceOne(
          code,
          "import { readOpcPageCache, writeOpcPageCache } from '../../../lib/opc-page-cache';\n",
          "import { readOpcPageCache, writeOpcPageCache } from '../../../lib/opc-page-cache';\nimport { baseUrl } from '../../../lib/base-url';\n",
          id,
        );
        code = replaceOne(
          code,
          `type CalendarEvent = {
  id: string;
  calendar_id: string;`,
          `type CalendarEvent = {
  id: string;
  calendar_id: string;
  job_id?: string | null;`,
          id,
        );
        code = replaceOne(
          code,
          "  const [activeTab, setActiveTab] = useState<CalendarViewFilter>('all');",
          "  const [activeTab, setActiveTab] = useState<CalendarViewFilter>('team');",
          id,
        );
        code = replaceOne(
          code,
          "    return ownCalendar?.id || teamCalendar?.id || employeeCalendar?.id || calendars[0]?.id || '';",
          "    return teamCalendar?.id || ownCalendar?.id || employeeCalendar?.id || calendars[0]?.id || '';",
          id,
        );
        code = replaceOne(
          code,
          `  function handleEventClick(arg: EventClickArg) {
    const event = arg.event.extendedProps.raw as CalendarEvent | undefined;
    if (!event) return;

    setQuickViewEvent(event);
  }
`,
          `  function openCalendarEvent(event: CalendarEvent) {
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
        \`${'${baseUrl}'}/einsatz/${'${encodeURIComponent(jobId)}'}?${'${query.toString()}'}\`,
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
`,
          id,
        );
        code = replaceOne(
          code,
          `            <button key={event.id} type="button" onClick={() => setQuickViewEvent(event)} className="opc-calendar-focus-card">`,
          `            <button key={event.id} type="button" onClick={() => openCalendarEvent(event)} className="opc-calendar-focus-card">`,
          id,
        );
        return { code, map: null };
      }

      return null;
    },
  };
}
