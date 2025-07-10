'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

interface QRCodeGeneratorProps {
  data: string
  size?: number
  className?: string
}

export default function QRCodeGenerator({ data, size = 128, className = "" }: QRCodeGeneratorProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    generateQRCode()
  }, [data, size])

  const generateQRCode = async () => {
    setIsLoading(true)
    try {
      // For now, we'll use a placeholder. In production, you'd want to use a QR code library
      // like 'qrcode' or 'qr-code-generator'
      
      // Simulate QR code generation
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Create a simple placeholder pattern
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      canvas.width = size
      canvas.height = size
      
      // Create a simple grid pattern as placeholder
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      
      ctx.fillStyle = '#000000'
      const moduleSize = size / 25
      
      // Create a pattern
      for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
          if ((i + j) % 3 === 0 || i === 0 || j === 0 || i === 24 || j === 24) {
            ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize)
          }
        }
      }
      
      // Add corner squares
      const cornerSize = moduleSize * 7
      ctx.fillRect(0, 0, cornerSize, cornerSize)
      ctx.fillRect(size - cornerSize, 0, cornerSize, cornerSize)
      ctx.fillRect(0, size - cornerSize, cornerSize, cornerSize)
      
      // Clear inner corners
      ctx.fillStyle = '#ffffff'
      const innerSize = moduleSize * 5
      const offset = moduleSize
      ctx.fillRect(offset, offset, innerSize, innerSize)
      ctx.fillRect(size - cornerSize + offset, offset, innerSize, innerSize)
      ctx.fillRect(offset, size - cornerSize + offset, innerSize, innerSize)
      
      setQrCodeDataUrl(canvas.toDataURL())
    } catch (error) {
      console.error('Error generating QR code:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl`} style={{ width: size, height: size }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`${className} overflow-hidden rounded-2xl border border-white/10`}
      style={{ width: size, height: size }}
    >
      {qrCodeDataUrl ? (
        <img 
          src={qrCodeDataUrl} 
          alt="QR Code" 
          className="w-full h-full object-cover"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <span className="text-gray-500 text-xs">QR Error</span>
        </div>
      )}
    </motion.div>
  )
}