import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SYSTEM_PROMPT = `You are a senior QA engineer generating Playwright test cases from requirements. Output ONLY valid JSON with no markdown, backticks, or explanation. For each requirement, generate thorough test cases covering: happy path, input validation, negative cases, and edge cases where relevant. Use realistic selectors preferring data-testid attributes. Each step should be atomic and testable. Respond with a JSON array: [{"name":string,"description":string,"priority":"P0"|"P1"|"P2"|"P3","tags":string[],"pageUrl":string,"steps":[{"selector":string,"selectorStrategy":"css"|"data-testid"|"role"|"text","action":"click"|"fill"|"check"|"uncheck"|"select"|"navigate"|"hover"|"press"|"wait"|"scrollTo","value":string,"assertion":"none"|"toBeVisible"|"toBeHidden"|"toHaveText"|"toContainText"|"toHaveValue"|"toBeChecked"|"toBeDisabled"|"toBeEnabled"|"toHaveURL"|"toHaveTitle","assertionValue":string}]}]`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate auth token
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on the server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify the user is authenticated via Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: {
    requirements: string
    context?: string
    baseUrl?: string
    selectorStrategy?: string
    defaultPriority?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { requirements, context, baseUrl, selectorStrategy, defaultPriority } = body
  if (!requirements?.trim()) {
    return new Response(
      JSON.stringify({ error: 'requirements field is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build prompt (mirrors frontend buildPrompt)
  let prompt = `Requirements:\n${requirements}`
  if (context?.trim()) prompt += `\n\nAdditional context: ${context}`
  if (baseUrl) prompt += `\n\nBase URL: ${baseUrl}`
  if (selectorStrategy) prompt += `\n\nPreferred selector strategy: ${selectorStrategy}`
  if (defaultPriority) prompt += `\nDefault priority if unspecified: ${defaultPriority}`

  // Call Claude API
  let claudeResponse: Response
  try {
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to reach Claude API: ${err}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!claudeResponse.ok) {
    const errBody = await claudeResponse.text()
    return new Response(
      JSON.stringify({ error: `Claude API error ${claudeResponse.status}: ${errBody}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const claudeData = await claudeResponse.json()
  const raw: string = claudeData?.content?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array')
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to parse Claude response', raw }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
