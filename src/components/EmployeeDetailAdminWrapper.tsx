import { useState } from 'react';
import EmployeeAdminControl from './EmployeeAdminControl';
import EmployeeDetailPage from './EmployeeDetailPage';

type Props = {
  employeeId: string;
};

export default function EmployeeDetailAdminWrapper({ employeeId }: Props) {
  const [version, setVersion] = useState(0);

  return (
    <div className="opc-employee-admin-wrapper">
      <EmployeeAdminControl employeeId={employeeId} onSaved={() => setVersion((value) => value + 1)} />
      <EmployeeDetailPage key={`${employeeId}:${version}`} employeeId={employeeId} />
      <style>{`
        .opc-employee-admin-wrapper > .opc-admin-control {
          position: relative;
          z-index: 4;
        }
        .opc-employee-admin-wrapper .opc-employee-hero-actions > button.opc-btn-dark {
          display: none !important;
        }
        .opc-employee-admin-wrapper .opc-employee-edit-panel {
          display: none !important;
        }
        .opc-employee-admin-wrapper section:has(.opc-note-form) {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
