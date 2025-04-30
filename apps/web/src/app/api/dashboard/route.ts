import { NextResponse } from 'next/server';

export async function GET() {
  const externalApiUrl = process.env.EXTERNAL_API_URL;

  if (!externalApiUrl) {
    return NextResponse.json(
      { error: 'External API URL is not configured.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${externalApiUrl}/dashboard`);

    if (!res.ok) {
      // Forward the error status and message if possible
      const errorData = await res.text();
      return NextResponse.json(
        { error: `External API Error: ${res.statusText}`, details: errorData },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from external API:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: 'Failed to fetch data from external API', details: errorMessage },
      { status: 500 }
    );
  }
} 