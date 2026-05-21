import React from 'react';
import { Shield, Check, X, Eye, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface FilePermission {
  user_id: string;
  role: 'admin' | 'owner' | 'client';
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface FilePermissionsMatrixProps {
  permissions: FilePermission[];
}

export default function FilePermissionsMatrix({
  permissions,
}: FilePermissionsMatrixProps) {
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-[#1A1A1A] text-[#FFFFFF] hover:bg-[#2A2A2A]';
      case 'owner':
        return 'bg-[#1A1A1A] text-[#FFFFFF] hover:bg-[#2A2A2A]';
      case 'client':
        return 'bg-[#1A1A1A] text-[#FFFFFF] hover:bg-[#2A2A2A]';
      default:
        return 'bg-[#FAFAFA] text-[#6B6B6B]';
    }
  };

  const getRoleDisplayName = (role: string): string => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const PermissionIndicator = ({ granted }: { granted: boolean }) => {
    return granted ? (
      <div className="flex items-center justify-center">
        <div className="bg-green-50 rounded-full p-1">
          <Check className="h-4 w-4 text-green-600" strokeWidth={3} />
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-center">
        <div className="bg-red-50 rounded-full p-1">
          <X className="h-4 w-4 text-red-500" strokeWidth={3} />
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#1A1A1A]" />
          File Permissions
        </CardTitle>
        <CardDescription>
          {permissions.length === 0
            ? 'No permissions configured'
            : `${permissions.length} user${permissions.length === 1 ? '' : 's'} with access`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {permissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-[#9A9A9A] mb-4" />
            <p className="text-[#6B6B6B] font-medium">No permissions set</p>
            <p className="text-sm text-[#9A9A9A] mt-1">
              Permissions will be displayed here once configured
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E6E6E6]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
                    Role
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span>Read</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
                    <div className="flex items-center justify-center gap-2">
                      <Edit className="h-4 w-4" />
                      <span>Write</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[#1A1A1A] uppercase tracking-wide">
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <tr
                    key={permission.user_id}
                    className="border-b border-[#E6E6E6] last:border-0 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#E5E5E5] flex items-center justify-center text-[#1A1A1A] font-semibold text-sm">
                          {permission.user_id.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-[#1A1A1A] font-mono">
                          {permission.user_id.substring(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className={`${getRoleBadgeVariant(permission.role)} font-semibold text-xs uppercase tracking-wide`}>
                        {getRoleDisplayName(permission.role)}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <PermissionIndicator granted={permission.can_read} />
                    </td>
                    <td className="py-4 px-4">
                      <PermissionIndicator granted={permission.can_write} />
                    </td>
                    <td className="py-4 px-4">
                      <PermissionIndicator granted={permission.can_delete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {permissions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#E6E6E6]">
            <div className="flex items-center gap-6 text-xs text-[#6B6B6B]">
              <div className="flex items-center gap-2">
                <div className="bg-green-50 rounded-full p-1">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                <span>Permission Granted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-red-50 rounded-full p-1">
                  <X className="h-3 w-3 text-red-500" />
                </div>
                <span>Permission Denied</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
