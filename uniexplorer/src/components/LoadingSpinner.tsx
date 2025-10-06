interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div className={`${className} flex items-center justify-center`}>
      <div className={`${sizeClasses[size]} relative`}>
        {/* Outer rotating ring */}
        <div className={`${sizeClasses[size]} absolute animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400`} />
        
        {/* Inner pulsing core */}
        <div className={`${sizeClasses[size]} absolute animate-pulse rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-60 blur-sm`} />
        
        {/* Central dot */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full animate-pulse`} />
      </div>
    </div>
  )
}

export default LoadingSpinner