"use client"

import React, { useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * PROGRESS BAR COMPONENT
 * Provides visual feedback during navigation transitions.
 * - Blue [ #3b82f6 ] for regular pages
 * - Red [ #ef4444 ] for admin pages
 */
export default function ProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isFinishing, setIsFinishing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const isAdmin = pathname?.startsWith('/admin')
  const barColor = isAdmin ? '#ef4444' : '#3b82f6'

  // Reset when path or params change (navigation happens)
  useEffect(() => {
    // Start progress
    setIsVisible(true)
    setIsFinishing(false)
    setProgress(30) // Initial jump

    // Slowly progress to 90
    if (timerRef.current) clearInterval(timerRef.current)
    
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 90
        }
        return prev + (90 - prev) * 0.1
      })
    }, 400)

    // Wait a bit then finish
    const finishTimer = setTimeout(() => {
      setProgress(100)
      setIsFinishing(true)
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, 300)

      return () => clearTimeout(hideTimer)
    }, 500)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      clearTimeout(finishTimer)
    }
  }, [pathname, searchParams])

  if (!isVisible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      zIndex: 99999,
      backgroundColor: 'transparent',
      pointerEvents: 'none'
    }}>
      <div style={{
        height: '100%',
        backgroundColor: barColor,
        width: `${progress}%`,
        boxShadow: `0 0 10px ${barColor}, 0 0 5px ${barColor}`,
        transition: isFinishing ? 'all 300ms ease-out' : 'width 400ms ease-out',
        opacity: isFinishing ? 0 : 1
      }} />
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
