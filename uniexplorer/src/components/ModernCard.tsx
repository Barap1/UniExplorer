import type { ReactNode } from 'react'

interface ModernCardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient'
  padding?: 'sm' | 'md' | 'lg'
}

const ModernCard: React.FC<ModernCardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  }

  const variantClasses = {
    default: 'bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-2xl',
    elevated: 'bg-slate-900/80 backdrop-blur-xl border border-white/20 shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/30 transition-all duration-300',
    bordered: 'bg-slate-800/50 backdrop-blur-sm border border-purple-500/30 shadow-lg',
    gradient: 'bg-gradient-to-br from-slate-900/70 via-purple-900/20 to-slate-900/70 backdrop-blur-xl border border-purple-500/20 shadow-2xl',
  }

  return (
    <div className={`
      ${variantClasses[variant]}
      ${paddingClasses[padding]}
      rounded-2xl
      ${className}
    `}>
      {children}
    </div>
  )
}

export default ModernCard