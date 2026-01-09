import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading,
  size = 'md',
  ...props 
}) => {
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const baseStyles = "rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-brand-primary/50";
  
  const variants = {
    primary: "bg-brand-primary hover:bg-brand-hover text-white shadow-[0_0_15px_rgba(0,82,255,0.3)] hover:shadow-[0_0_20px_rgba(0,82,255,0.5)] border border-transparent",
    secondary: "bg-white text-black hover:bg-gray-200 border border-transparent shadow-lg shadow-white/5",
    outline: "bg-transparent border border-glass text-vault-text hover:bg-white/5",
    ghost: "text-vault-subtext hover:text-white hover:bg-white/5",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
      ) : children}
    </button>
  );
};