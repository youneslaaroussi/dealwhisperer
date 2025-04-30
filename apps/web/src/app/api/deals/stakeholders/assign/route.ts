import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const externalApiUrl = process.env.EXTERNAL_API_URL;

  if (!externalApiUrl) {
    return NextResponse.json(
      { error: 'External API URL is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    // Basic validation example (could use Zod for more robust validation)
    if (!body.mappings || !Array.isArray(body.mappings)) {
      return NextResponse.json({ error: 'Invalid input: mappings array is required.' }, { status: 400 });
    }

    const response = await fetch(`${externalApiUrl}/deals/stakeholders/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
        // Try to parse potential array error messages from backend
        let details = responseData.message;
        if (Array.isArray(details)) {
            details = details.join(', ');
        }
      return NextResponse.json({ error: `External API Error: ${response.statusText}`, details }, { status: response.status });
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error proxying assign stakeholders:', error);
    let errorMessage = 'Internal Server Error during assignment proxy';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: 'Failed to proxy assign stakeholders', details: errorMessage },
      { status: 500 }
    );
  }
} 