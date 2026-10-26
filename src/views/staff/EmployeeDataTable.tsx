import React from 'react';
import DataTable, { Column } from 'datatables.net-react';
import DT from 'datatables.net-bs5';

import 'datatables.net-bs5/css/dataTables.bootstrap5.css';

DataTable.use(DT);

const BootstrapDataTable =
  DataTable as unknown as React.ComponentType<any>;

export type EmployeeTableRow = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
  outlet: string;
  status: string;
};

type Props = {
  items: EmployeeTableRow[];
  canEdit: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

export const EmployeeDataTable: React.FC<Props> = ({
  items,
  canEdit,
  onView,
  onEdit
}) => {
  const handleActionClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(
      'button[data-employee-action]'
    );

    if (!button || !event.currentTarget.contains(button)) {
      return;
    }

    const id = button.dataset.employeeId;
    const action = button.dataset.employeeAction;

    if (!id || !items.some(item => item.id === id)) {
      return;
    }

    if (action === 'view') {
      onView(id);
    } else if (action === 'edit' && canEdit) {
      onEdit(id);
    }
  };

  return (
    <div onClickCapture={handleActionClick}>
      <BootstrapDataTable
        key={canEdit ? 'staff-edit-enabled' : 'staff-view-only'}
        data={items}
        className="table table-striped table-hover w-100"
        options={{
          pageLength: 10,
          lengthMenu: [10, 25, 50],
          searching: true,
          ordering: true,
          paging: true,
          order: [[1, 'asc']]
        }}
      >
        <Column title="Employee Code" data="employeeCode" />
        <Column title="Name" data="name" />
        <Column title="Designation" data="designation" />
        <Column title="Phone" data="phone" />
        <Column title="Email" data="email" />
        <Column title="Assigned Outlet" data="outlet" />

        <Column
          title="Status"
          data="status"
          options={{
            render: (value: unknown, type: string) => {
              const active = value === 'active';

              if (type !== 'display') {
                return active ? 'Active' : 'Inactive';
              }

              return active
                ? '<span class="text-success">Active</span>'
                : '<span class="text-secondary">Inactive</span>';
            }
          }}
        />

        <Column
          title="Actions"
          data="id"
          options={{
            orderable: false,
            searchable: false,
            render: (value: unknown, type: string) => {
              if (type !== 'display') return '';

              const id = escapeHtml(value);

              const viewButton = `
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary"
                  data-employee-action="view"
                  data-employee-id="${id}"
                >View</button>
              `;

              const editButton = canEdit ? `
                <button
                  type="button"
                  class="btn btn-sm btn-outline-success"
                  data-employee-action="edit"
                  data-employee-id="${id}"
                >Edit</button>
              ` : '';

              return `
                <div class="d-flex gap-2">
                  ${viewButton}
                  ${editButton}
                </div>
              `;
            }
          }}
        />
      </BootstrapDataTable>
    </div>
  );
};
