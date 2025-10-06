import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
}

const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const animationRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const generateStars = () => {
      const stars: Star[] = []
      const starCount = Math.floor((window.innerWidth * window.innerHeight) / 8000)
      
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
        })
      }
      
      starsRef.current = stars
    }

    const drawStars = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase)
        const currentOpacity = star.opacity + twinkle * 0.3
        
        ctx.save()
        ctx.globalAlpha = Math.max(0.1, currentOpacity)
        
        // Create a subtle glow effect
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3
        )
        
        gradient.addColorStop(0, '#ffffff')
        gradient.addColorStop(0.3, '#e0e7ff')
        gradient.addColorStop(0.6, '#c7d2fe')
        gradient.addColorStop(1, 'transparent')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2)
        ctx.fill()
        
        // Draw the core star
        ctx.globalAlpha = Math.max(0.3, currentOpacity + 0.2)
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      })
    }

    const animate = (time: number) => {
      drawStars(time)
      animationRef.current = requestAnimationFrame(animate)
    }

    resizeCanvas()
    generateStars()
    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      resizeCanvas()
      generateStars()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10"
      style={{
        background: 'radial-gradient(ellipse at center, #0f0a1e 0%, #000000 70%)',
      }}
    />
  )
}

export default StarfieldBackground