import React from 'react';

interface Props {
  locale: 'de' | 'en';
  onChange: (locale: 'de' | 'en') => void;
}

export const LanguageToggle: React.FC<Props> = ({ locale, onChange }) => {
  return (
    <div className="flex bg-white rounded-full p-1 border shadow-sm">
      <button
        onClick={() => onChange('de')}
        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
          locale === 'de' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'
        }`}
      >
        DE
      </button>
      <button
        onClick={() => onChange('en')}
        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
          locale === 'en' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'
        }`}
      >
        EN
      </button>
    </div>
  );
};
