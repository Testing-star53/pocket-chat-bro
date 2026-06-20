import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('reactions')
    .delete()
    .lt('created_at', cutoff)

  await supabase
    .from('messages')
    .delete()
    .lt('created_at', cutoff)

  await supabase
    .from('typing_status')
    .delete()
    .lt('updated_at', cutoff)

  return new Response('Auto-delete done', { status: 200 })
})
