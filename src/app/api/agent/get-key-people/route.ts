import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const externalApiUrl = process.env.EXTERNAL_API_URL;
  const agentId = process.env.GET_KEY_PEOPLE_AGENT_ID;

  if (!externalApiUrl || !agentId) {
    return NextResponse.json(
      { error: 'External API URL or Agent ID is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const response = await fetch(`${externalApiUrl}/agent/get-key-people`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, agentId }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(responseData, { status: response.status });
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error proxying get key people agent:', error);
    let errorMessage = 'Internal Server Error during agent proxy';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: 'Failed to proxy get key people agent', details: errorMessage },
      { status: 500 }
    );
  }
} 