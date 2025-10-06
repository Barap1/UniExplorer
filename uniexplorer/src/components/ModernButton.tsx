import type { ReactNode, ButtonHTMLAttributes } from 'react'
import LoadingSpinner from './LoadingSpinner'

interface ModernButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

const ModernButton: React.FC<ModernButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'relative font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group'
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base',
  }

  const variantClasses = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-purple-500/30 hover:from-purple-500 hover:to-pink-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/40 focus:ring-purple-400',
    secondary: 'bg-slate-800/50 backdrop-blur-sm text-white border border-purple-500/30 hover:bg-slate-700/60 hover:border-purple-400/50 hover:shadow-lg focus:ring-purple-400',
    danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white border border-red-500/30 hover:from-red-500 hover:to-red-400 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/40 focus:ring-red-400',
    ghost: 'bg-transparent text-purple-300 border border-transparent hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/30 focus:ring-purple-400',
  }

  const isDisabled = disabled || loading

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -top-full bg-gradient-to-b from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:top-full transition-all duration-700 ease-out" />
      
      {/* Button content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </span>
    </button>
  )
}

export default ModernButton