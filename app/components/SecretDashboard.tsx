'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SecretDashboard() {
  const router = useRouter()

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Secret shortcut: cmd/ctrl + shift + d
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        router.push('/dashboard')
      }
    }

    // Alternative: Listen for konami code for fun
    let konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
    let konamiIndex = 0

    const handleKonami = (e: KeyboardEvent) => {
      if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++
        if (konamiIndex === konamiCode.length) {
          router.push('/dashboard')
          konamiIndex = 0
        }
      } else {
        konamiIndex = 0
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    window.addEventListener('keydown', handleKonami)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      window.removeEventListener('keydown', handleKonami)
    }
  }, [router])

  return null
} 