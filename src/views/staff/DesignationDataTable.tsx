import React, { useMemo } from 'react';
import DataTable, { Column } from 'datatables.net-react';
import DT from 'datatables.net-bs5';

import 'datatables.net-bs5/css/dataTables.bootstrap5.css';

DataTable.use(DT);

// Compatibility with the installed React adapter's JSX typings.
const BootstrapDataTable =
  DataTable as unknown as React.ComponentType<any>;

export type DesignationRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  staffCount: number;
};

type Props = {
  items: DesignationRow[];
  canManage: boolean;
  busy: boolean;
  onEdit: (item: DesignationRow) => void;
  onRemove: (item: DesignationRow) => void;
};

export const DesignationDataTable: React.FC<Props> = ({
  items,
  canManage,
  busy,
  onEdit,
  onRemove
}) => {
  const byId = useMemo(
    () => new Map<string, DesignationRow>(
      items.map(item => [item.id, item])
    ),
    [items]
  );

  return (
    <BootstrapDataTable
      data={items}
      className="table table-hover w-100 pali-designation-table"
      options={{
        pageLength: 10,
        autoWidth: false,
        language: {
          search: '',
          searchPlaceholder: 'Search designations...',
          lengthMenu: '_MENU_ per page',
          emptyTable: 'No designations found',
          zeroRecords: 'No matching designations',
        },
        layout: {
          topStart: 'pageLength',
          topEnd: 'search',
          bottomStart: 'info',
          bottomEnd: 'paging'
        },
        lengthMenu: [10, 25, 50],
        ordering: true,
        searching: true,
        paging: true,
        order: [[1, 'asc']]
      }}
    >
      <Column title="Code" data="code" />
      <Column title="Designation" data="name" />
      <Column title="Staff Count" data="staffCount" />

      <Column title="Status" data="isActive">
        {(active: boolean) => (
          <span className={active ? 'text-success' : 'text-secondary'}>
            {active ? 'Active' : 'Inactive'}
          </span>
        )}
      </Column>

      {canManage && (
        <Column
          title="Actions"
          data="id"
          options={{
            orderable: false,
            searchable: false
          }}
        >
          {(id: string) => {
            const item = byId.get(id);
            if (!item) return null;

            return (
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm pali-designation-edit"
                  disabled={busy}
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="btn btn-sm pali-designation-toggle"
                  disabled={busy}
                  onClick={() => onRemove(item)}
                >
                  Remove
                </button>
              </div>
            );
          }}
        </Column>
      )}
    </BootstrapDataTable>
  );
};
