import React from 'react';

type ModalCloseButtonProps = {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  color?: string;
};

const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
  onClick,
  title,
  disabled = false,
  color = 'var(--text-secondary)',
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color,
        cursor: disabled ? 'default' : 'pointer',
        padding: 4,
      }}
      title={title}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
};

export default ModalCloseButton;

