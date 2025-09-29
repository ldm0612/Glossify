import React from 'react';

interface TabsProps {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => {
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map(t => (
        <button
          key={t.key}
          className={
            "px-4 py-2 -mb-px border-b-2 text-sm " +
            (active === t.key
              ? "border-primary-600 text-primary-700 font-medium"
              : "border-transparent text-gray-600 hover:text-gray-800")
          }
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};
