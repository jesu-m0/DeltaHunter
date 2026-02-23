import { NextRequest, NextResponse } from 'next/server';

export const config = {
  maxDuration: 60,
  runtime: 'nodejs',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // In development, call Python server if available
    // In production (Vercel), the Python function is available at /api/analyze
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // Try local Python server first (for local development with dev_server.py)
      try {
        const res = await fetch('http://localhost:5328/api/analyze', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        });

        const data = await res.json();
        if (!res.ok) {
          return NextResponse.json(
            { error: data.error || `API error: ${res.status}` },
            { status: res.status }
          );
        }
        return NextResponse.json(data);
      } catch (err) {
        // Fall through to error below
        console.error('Local Python server not available:', err);
      }
    }

    // In production, the request will be handled by the Python serverless function at api/analyze
    // This route shouldn't be called in production, but if it is, return an error
    return NextResponse.json(
      { error: 'API endpoint not properly configured. Please check your deployment.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
