export default async function generateAiResponse({ 
  prompt,
  apiUrl = "/api/ai/completion"
}: { 
  prompt: string;
  apiUrl?: string;
}) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  return response;
}
