import { useEffect, useState } from 'react';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

function normalizeRole(value: unknown) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'inhaber') return 'owner';
  if (role === 'super_admin') return 'superadmin';
  return role;
}

function requiresApproval(row: Record<string, any>) {
  const status = String(row.status || '').toLowerCase();
  const billingStatus = String(row.billing_status || '').toLowerCase();
  const blockerCode = String(row.blocker_code || '').toLowerCase();

  if (status === 'completed' || billingStatus === 'invoice_sent') return false;
  if (billingStatus === 'ready_for_billing' || blockerCode === 'approved_for_manual_billing') return false;
  if (billingStatus === 'billing_blocked' || blockerCode === 'billing_on_hold') return false;

  return true;
}

export default function OwnerBillingReadyWidget() {
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      const sessionResponse = await supabase.auth.getSession();
      const userId = sessionResponse.data.session?.user.id;
      if (!userId) return;

      const roleResponse = await supabase
        .from('opc_staff_roles')
        .select('role,status,can_access_portal')
        .eq('user_id', userId)
        .in('status', ['active', 'aktiv', 'enabled']);

      if (roleResponse.error) return;

      const isOwner = (roleResponse.data || []).some((row: Record<string, any>) => {
        return row.can_access_portal !== false &&
          ['owner', 'godmode', 'superadmin'].includes(normalizeRole(row.role));
      });

      if (!isOwner || !active) return;

      setVisible(true);

      const queueResponse = await supabase
        .from('opc_invoice_automation_overview')
        .select('*')
        .limit(500);

      if (!queueResponse.error && active) {
        setCount((queueResponse.data || []).filter(requiresApproval).length);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <a
      href={`${baseUrl}/rechnungsautomationen`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 18,
        padding: '17px 18px',
        borderRadius: 18,
        border: count > 0 ? '1px solid #FDE68A' : '1px solid #E5E7EB',
        background: count > 0 ? '#FFFBEB' : '#FFFFFF',
        color: '#111827',
        textDecoration: 'none',
        boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <ReceiptText size={18} />
        </span>

        <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <strong style={{ fontSize: 15 }}>Bereit zur Verrechnung</strong>
          <span style={{ color: '#6B7280', fontSize: 12, fontWeight: 650 }}>
            {count === 1
              ? '1 abgeschlossener Einsatz wartet auf Freigabe'
              : `${count} abgeschlossene Einsätze warten auf Freigabe`}
          </span>
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <strong style={{ fontSize: 24 }}>{count}</strong>
        <ChevronRight size={18} />
      </span>
    </a>
  );
}
