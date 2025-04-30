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
    const formData = await req.formData();
    
    // Check if files exist
    const files = formData.getAll('files');
    if (!files || files.length === 0 || !(files[0] instanceof File)) {
      return NextResponse.json({ message: 'No files uploaded.' }, { status: 400 });
    }

    const response = await fetch(`${externalApiUrl}/files/upload-rag`, {
      method: 'POST',
      body: formData,
      // Headers might not be needed as fetch correctly sets multipart boundary
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json(responseData, { status: response.status });
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error proxying file upload:', error);
    let errorMessage = 'Internal Server Error during upload proxy';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: 'Failed to proxy file upload', details: errorMessage },
      { status: 500 }
    );
  }
} 