import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const externalApiUrl = process.env.EXTERNAL_API_URL;
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');

  if (!externalApiUrl) {
    return NextResponse.json(
      { error: 'External API URL is not configured.' },
      { status: 500 }
    );
  }

  if (!name) {
    return NextResponse.json(
      { error: 'Missing required query parameter: name' },
      { status: 400 }
    );
  }

  try {
    // Construct the URL correctly for query parameters
    const url = new URL(`${externalApiUrl}/slack/search-user`);
    url.searchParams.append('name', name);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(responseData, { status: response.status });
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error proxying Slack user search:', error);
    let errorMessage = 'Internal Server Error during Slack search proxy';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: 'Failed to proxy Slack user search', details: errorMessage },
      { status: 500 }
    );
  }
} 