import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { message, timestamp } = await request.json()
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    if (message.length > 500) {
      return NextResponse.json(
        { error: 'Message too long (max 500 characters)' },
        { status: 400 }
      )
    }

    // Store the message in Supabase
    const { error } = await supabase
      .from('confessional_messages')
      .insert([
        {
          message: message.trim(),
          created_at: timestamp || new Date().toISOString(),
          // No IP address or user identification stored for privacy
        }
      ])

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to store message' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Message received' },
      { status: 200 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}