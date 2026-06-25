import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ success: true, message: 'Setup completed. This endpoint is disabled.' })
}
