import React, { ReactNode } from 'react';

interface Column {
  header: string;
  key: string;
}

interface TableProps {
  columns: Column[];
  data: Record<string, any>[];
}

export default function Table({ columns, data }: TableProps) {
  const tableStyles: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const thStyles: React.CSSProperties = {
    backgroundColor: '#f3f4f6',
    padding: '12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#1f2937',
    borderBottom: '2px solid #e5e7eb',
  };

  const tdStyles: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    color: '#374151',
  };

  const trHoverStyles: React.CSSProperties = {
    backgroundColor: '#f9fafb',
  };

  return (
    <table style={tableStyles}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={thStyles}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx} style={idx % 2 === 1 ? trHoverStyles : {}}>
            {columns.map((col) => (
              <td key={col.key} style={tdStyles}>
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
